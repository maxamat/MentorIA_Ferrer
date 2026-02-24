import os
import base64
import json
import hashlib
from typing import Optional
import pandas as pd

from fastapi import FastAPI, HTTPException, Request
import time as time_sleep

from google.cloud import bigquery, storage
from google.oauth2 import service_account
from pathlib import Path
from datetime import datetime, timezone
from google import genai
from weasyprint import HTML as WeasyHTML

from elevenlabs.client import ElevenLabs

#Se inicializan las variables de entorno:
PROJECT_ID = os.getenv("PROJECT_ID", "")
DATASET_ID = os.getenv("DATASET_ID", "")
REGION = os.getenv("REGION", "")
GOOGLE_CLOUD_GEMINI_API_KEY=os.getenv("GOOGLE_CLOUD_GEMINI_API_KEY", "")

#Se establecen algunas variables de configuración adicionales:

MARKED_CONTENT = "****"
NO_WORDS=75
NO_WORDS_MICRORECOMENDACION=20

VERTEX_AI_RETIRES=10
VERTEX_AI_SECONDS_SLEEP=60
TIMEOUT_HOURS_OVERLAP_FUNCTIONS = 3

app = FastAPI(title="Recomendador Profesor Worker - PubSub Receiver", version="1.0")

#Se obtiene el directorio de las credenciales de Google Cloud:
SCRIPT_DIR = Path(__file__).parent
GOOGLE_CREDENTIALS = "credentials/credentials.json"
GOOGLE_CREDENTIALS_PATH = SCRIPT_DIR / GOOGLE_CREDENTIALS

#Se inicializa el cliente de BigQuery:
credentials = service_account.Credentials.from_service_account_file(str(GOOGLE_CREDENTIALS_PATH))
client_bigquery = bigquery.Client(project=PROJECT_ID, credentials=credentials)

#Se inicializa el cliente de Gemini:
client_genai = genai.Client(
    vertexai=True,
    api_key=GOOGLE_CLOUD_GEMINI_API_KEY
)

#También para el cliente de Storage (para guardar los HTML generados):
storage_client = storage.Client(project=PROJECT_ID, credentials=credentials)

# ---------- Helpers ----------

def generar_recomendaciones_profesor(id_centro: str, asignatura: str, clase: str, alumno_id: str):

    #Se obtienen los intereses del alumno:

    print(f"[PASO 1 INICIADO] Consultando los intereses del alumno | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    sql = f"""SELECT DISTINCT
                    texto_tiempo_libre,
                    texto_que_te_motiva,
                    texto_que_te_ayuda_a_entender,
                    texto_que_te_frustra_a_estudiar,
                    texto_que_asignaturas_se_te_dan_mejor
            FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_INTERES` 
            WHERE id_centro = @id_centro 
            AND id_alumno = @id_alumno
            LIMIT 1"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("id_centro", "STRING", id_centro),
            bigquery.ScalarQueryParameter("id_alumno", "STRING", alumno_id)
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    intereses = job.to_dataframe()
    texto_tiempo_libre = intereses['texto_tiempo_libre'].iloc[0] if len(intereses) > 0 and 'texto_tiempo_libre' in intereses.columns else ""
    texto_que_te_motiva = intereses['texto_que_te_motiva'].iloc[0] if len(intereses) > 0 and 'texto_que_te_motiva' in intereses.columns else ""
    texto_que_te_ayuda_a_entender = intereses['texto_que_te_ayuda_a_entender'].iloc[0] if len(intereses) > 0 and 'texto_que_te_ayuda_a_entender' in intereses.columns else ""
    texto_que_te_frustra_a_estudiar = intereses['texto_que_te_frustra_a_estudiar'].iloc[0] if len(intereses) > 0 and 'texto_que_te_frustra_a_estudiar' in intereses.columns else ""
    texto_que_asignaturas_se_te_dan_mejor = intereses['texto_que_asignaturas_se_te_dan_mejor'].iloc[0] if len(intereses) > 0 and 'texto_que_asignaturas_se_te_dan_mejor' in intereses.columns else ""
    
    print(f"[PASO 1 FINALIZADO] Consultando los intereses del alumno | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    #Procesamos los intereses del alumno:

    print(f"[PASO 2 INICIADO] Procesando los intereses del alumno | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    intereses_txt=""
    contains_masked_content=False
    if texto_tiempo_libre:
        intereses_txt = f"\t -Pregunta: ¿Qué te encanta hacer cuando tienes tiempo libre?\n"
        intereses_txt += f"\t -Respuesta: {texto_tiempo_libre}\n"
        if MARKED_CONTENT in intereses_txt:
            contains_masked_content = True
    if texto_que_te_motiva:
        intereses_txt = f"\t -Pregunta: ¿Qué te motiva a estudiar?\n"
        intereses_txt += f"\t -Respuesta: {texto_que_te_motiva}\n"
        if MARKED_CONTENT in intereses_txt:
            contains_masked_content = True
    if texto_que_te_ayuda_a_entender:
        intereses_txt = f"\t -Pregunta: ¿Qué te ayuda a entender mejor los temas?\n"
        intereses_txt += f"\t -Respuesta: {texto_que_te_ayuda_a_entender}\n"
        if MARKED_CONTENT in intereses_txt:
            contains_masked_content = True
    if texto_que_te_frustra_a_estudiar:
        intereses_txt = f"\t -Pregunta: ¿Qué te frustra al estudiar?\n"
        intereses_txt += f"\t -Respuesta: {texto_que_te_frustra_a_estudiar}\n"
        if MARKED_CONTENT in intereses_txt:
            contains_masked_content = True
    if texto_que_asignaturas_se_te_dan_mejor:
        intereses_txt = f"\t -Pregunta: ¿Qué asignaturas se te dan mejor?\n"
        intereses_txt += f"\t -Respuesta: {texto_que_asignaturas_se_te_dan_mejor}\n"
        if MARKED_CONTENT in intereses_txt:
            contains_masked_content = True

    if contains_masked_content == True:
        intereses_txt += f"\n\n\t -Importante: Alguna respuesta del alumno contiene {MARKED_CONTENT} debido a que algunos campos han sido enmascarados dado que podrían contener información sensible.\n"

    print(f"[PASO 2 FINALIZADO] Procesando los intereses del alumno | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    #Tras esto obtenemos todos los comentarios recibidos por el profesor en los ejercicios:

    print(f"[PASO 3 INICIADO] Consultando los comentarios del profesor sobre los ejercicios | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    sql = f"""select * from (select
            B.id,
            B.timestamp,
            B.comentarios_profesor,
            A.titulo,
            B.unidad
            from
            (SELECT DISTINCT centro_id, clase, asignatura, unidad, titulo FROM
            `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES`
            WHERE centro_id = @centro_id 
            AND clase = @clase
            AND asignatura = @asignatura) A
            inner join
            (SELECT DISTINCT
                    centro_id,
                    clase,
                    asignatura,
                    unidad,
                    id,
                    timestamp,
                    nota,
                    comentarios_profesor
            FROM `{PROJECT_ID}.{DATASET_ID}.T_ACCION_ALUMNO_EJERCICIO` 
            WHERE centro_id = @centro_id 
            AND alumno_id = @alumno_id
            AND clase = @clase
            AND asignatura = @asignatura) B
            on A.centro_id = B.centro_id
            AND A.clase = B.clase
            AND A.asignatura = B.asignatura
            AND A.unidad = B.unidad
            )
            ORDER BY unidad asc, id asc, timestamp asc
            """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
            bigquery.ScalarQueryParameter("alumno_id", "STRING", alumno_id),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    acciones = job.to_dataframe()

    print(f"[PASO 3 FINALIZADO] Consultando los comentarios del profesor sobre los ejercicios | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    #Se procesan los comentarios hacia el profesor:

    print(f"[PASO 4 INICIADO] Procesando los comentarios del profesor sobre los ejercicios | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    comentarios_profesor_ejercicios=""
    for idx, row in acciones.iterrows():
        if comentarios_profesor_ejercicios!="":
            comentarios_profesor_ejercicios+="\n"
        comentarios_profesor_ejercicios += f"\t - Unidad: {row['unidad']} | Ejercicio: {row['id']} | Hora: {row['timestamp'].strftime('%Y-%m-%d %H:%M:%S')} | Comentario del profesor: {row['comentarios_profesor'].replace('**', '')}."
        
    print(f"[PASO 4 FINALIZADO] Procesando los comentarios del profesor sobre los ejercicios | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    #Tras esto obtenemos todos los comentarios recibidos por el profesor en los ejercicios:

    print(f"[PASO 5 INICIADO] Consultando los comentarios del profesor sobre los trabajos | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    sql = f"""select * from (select
            B.id,
            B.timestamp,
            B.comentarios_profesor,
            A.titulo,
            B.unidad
            from
            (SELECT DISTINCT centro_id, clase, asignatura, unidad, titulo FROM
            `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES`
            WHERE centro_id = @centro_id 
            AND clase = @clase
            AND asignatura = @asignatura) A
            inner join
            (SELECT DISTINCT
                    centro_id,
                    clase,
                    asignatura,
                    unidad,
                    id,
                    timestamp,
                    nota,
                    comentarios_profesor
            FROM `{PROJECT_ID}.{DATASET_ID}.T_ACCION_ALUMNO_EJERCICIO` 
            WHERE centro_id = @centro_id 
            AND alumno_id = @alumno_id
            AND clase = @clase
            AND asignatura = @asignatura) B
            on A.centro_id = B.centro_id
            AND A.clase = B.clase
            AND A.asignatura = B.asignatura
            AND A.unidad = B.unidad
            )
            ORDER BY unidad asc, id asc, timestamp asc
            """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
            bigquery.ScalarQueryParameter("alumno_id", "STRING", alumno_id),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    acciones = job.to_dataframe()

    print(f"[PASO 5 FINALIZADO] Consultando los comentarios del profesor sobre los trabajos | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    #Se procesan los comentarios hacia el profesor:

    print(f"[PASO 6 INICIADO] Procesando los comentarios del profesor sobre los trabajos | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    comentarios_profesor_trabajos=""
    for idx, row in acciones.iterrows():
        if comentarios_profesor_trabajos!="":
            comentarios_profesor_trabajos+="\n"
        comentarios_profesor_trabajos += f"\t - Unidad: {row['unidad']} | Ejercicio: {row['id']} | Hora: {row['timestamp'].strftime('%Y-%m-%d %H:%M:%S')} | Comentario del profesor: {row['comentarios_profesor'].replace('**', '')}."
        
    print(f"[PASO 6 FINALIZADO] Procesando los comentarios del profesor sobre los trabajos | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    #Tras esto obtenemos una recomendación del LLM:

    print(f"[PASO 7 INICIADO] Obteniendo recomendación del LLM | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    if intereses_txt=="" and comentarios_profesor_ejercicios=="" and comentarios_profesor_trabajos=="":

        recomendacion = ""
    
    else:

        model = "gemini-2.5-flash"

        generate_content_config = genai.types.GenerateContentConfig(
            temperature = 1,
            top_p = 0.95,
            seed = 0,
            max_output_tokens = 65535,
            safety_settings = [
                genai.types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",threshold="OFF"),
                genai.types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT",threshold="OFF"),
                genai.types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT",threshold="OFF"),
                genai.types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",threshold="OFF")
            ],
            response_mime_type = "application/json",
            response_schema = {"type":"OBJECT","properties":{"recomendacion":{"type":"STRING","description":f"Recomendación realizada por el orientador hacia el profesor. Debe tener una extensión aproximada de {NO_WORDS} palabras."},"microrecomendacion_1":{"type":"STRING","description":f"Primera microrecomendación realizada por el orientador hacia el profesor. Debe tener una extensión aproximada de {NO_WORDS_MICRORECOMENDACION} palabras."},"microrecomendacion_2":{"type":"STRING","description":f"Segunda microrecomendación realizada por el orientador hacia el profesor. Debe tener una extensión aproximada de {NO_WORDS_MICRORECOMENDACION} palabras."},"microrecomendacion_3":{"type":"STRING","description":f"Tercera microrecomendación realizada por el orientador hacia el profesor. Debe tener una extensión aproximada de {NO_WORDS_MICRORECOMENDACION} palabras."},"microrecomendacion_4":{"type":"STRING","description":f"Cuarta microrecomendación realizada por el orientador hacia el profesor. Debe tener una extensión aproximada de {NO_WORDS_MICRORECOMENDACION} palabras."},"microrecomendacion_5":{"type":"STRING","description":f"Quinta microrecomendación realizada por el orientador hacia el profesor. Debe tener una extensión aproximada de {NO_WORDS_MICRORECOMENDACION} palabras."}},"required":["recomendacion","microrecomendacion_1","microrecomendacion_2","microrecomendacion_3","microrecomendacion_4","microrecomendacion_5"]},
        )

        parts=[]
        parts.append(genai.types.Part.from_text(text=f"Eres un orientador educativo que ayuda a los alumnos de la clase {clase}."))
        parts.append(genai.types.Part.from_text(text=f"En la asignatura {asignatura}, el profesor te ha pedido consejo sobre uno de sus alumnos."))
        if not intereses_txt == "":
            parts.append(genai.types.Part.from_text(text="Como buen orientador decides, antes de dar un consejo, revisar los intereses del alumno y para ello te remontas a un formulario que les realizasteis a principio de curso en el que el alumno respondió a varias preguntas sobre sus intereses, motivaciones, frustraciones y asignaturas que se le dan mejor. El contenido de dicho formulario es el siguiente:"))
            parts.append(genai.types.Part.from_text(text=intereses_txt))
        if not comentarios_profesor_ejercicios == "":
            if not intereses_txt == "":
                parts.append(genai.types.Part.from_text(text="Decides también poner foco en los comentarios que el profesor ha ido realizando a lo largo del curso en los ejercicios que el alumno ha ido realizando para intentar entender mejor al alumno y así poder darle un consejo más personalizado. Los comentarios del profesor sobre los ejercicios realizados por el alumno son los siguientes:"))
            else:
                parts.append(genai.types.Part.from_text(text="Decides poner foco en los comentarios que el profesor ha ido realizando a lo largo del curso en los ejercicios que el alumno ha ido realizando para intentar entender mejor al alumno y así poder darle un consejo más personalizado. Los comentarios del profesor sobre los ejercicios realizados por el alumno son los siguientes:"))
            parts.append(genai.types.Part.from_text(text=comentarios_profesor_ejercicios))
        
        if not comentarios_profesor_trabajos == "":
            if not intereses_txt == "":
                if not comentarios_profesor_ejercicios == "":
                    parts.append(genai.types.Part.from_text(text="Aparte de los ejercicios decides también poner foco en los comentarios que el profesor ha ido realizando a lo largo del curso en los trabajos que el alumno ha ido realizando para intentar entender mejor al alumno y así poder darle un consejo más personalizado. Los comentarios del profesor sobre los trabajos realizados por el alumno son los siguientes:"))
                else:
                    parts.append(genai.types.Part.from_text(text="Decides también poner foco en los comentarios que el profesor ha ido realizando a lo largo del curso en los trabajos que el alumno ha ido realizando para intentar entender mejor al alumno y así poder darle un consejo más personalizado. Los comentarios del profesor sobre los trabajos realizados por el alumno son los siguientes:"))
            else:
                if not comentarios_profesor_ejercicios == "":
                    parts.append(genai.types.Part.from_text(text="Aparte de los ejercicios decides también poner foco en los comentarios que el profesor ha ido realizando a lo largo del curso en los trabajos que el alumno ha ido realizando para intentar entender mejor al alumno y así poder darle un consejo más personalizado. Los comentarios del profesor sobre los trabajos realizados por el alumno son los siguientes:"))
                else:
                    parts.append(genai.types.Part.from_text(text="Decides poner foco en los comentarios que el profesor ha ido realizando a lo largo del curso en los trabajos que el alumno ha ido realizando para intentar entender mejor al alumno y así poder darle un consejo más personalizado. Los comentarios del profesor sobre los trabajos realizados por el alumno son los siguientes:"))
            parts.append(genai.types.Part.from_text(text=comentarios_profesor_trabajos))
        parts.append(genai.types.Part.from_text(text="Tu tarea:"))
        if not intereses_txt == "":
            parts.append(genai.types.Part.from_text(text="\t 1) Perfilar los intereses del alumno para conocer qué es aquello que realmente le interesa, qué le llama la atención, qué le frustra, etc."))
            if comentarios_profesor_ejercicios != "":
                parts.append(genai.types.Part.from_text(text="\t 2) Analizar los comentarios del profesor sobre los ejercicios realizados por el alumno para entender mejor sus fortalezas y áreas de mejora."))
                if comentarios_profesor_trabajos != "":
                    parts.append(genai.types.Part.from_text(text="\t 3) Analizar los comentarios del profesor sobre los trabajos realizados por el alumno para entender mejor sus fortalezas y áreas de mejora."))
                    parts.append(genai.types.Part.from_text(text="\t 4) Generar una recomendación para el profesor con el objetivo de ayudarle a entender mejor a su alumno y así poder ayudarle mejor."))
                    parts.append(genai.types.Part.from_text(text=f"\t 5) Define 5 micro-recomendaciones que podría adoptar el profesor para ayudar al alumno a mejorar en base a sus intereses y a los comentarios realizados por el profesor a lo largo del curso. Cada micro-recomendación debe tener aproximadamente {NO_WORDS_MICRORECOMENDACION} palabras."))

                else:
                    parts.append(genai.types.Part.from_text(text="\t 3) Generar una recomendación para el profesor con el objetivo de ayudarle a entender mejor a su alumno y así poder ayudarle mejor."))
                    parts.append(genai.types.Part.from_text(text=f"\t 4) Define 5 micro-recomendaciones que podría adoptar el profesor para ayudar al alumno a mejorar en base a sus intereses y a los comentarios realizados por el profesor a lo largo del curso. Cada micro-recomendación debe tener aproximadamente {NO_WORDS_MICRORECOMENDACION} palabras."))

            else:
                if comentarios_profesor_trabajos != "":
                    parts.append(genai.types.Part.from_text(text="\t 2) Analizar los comentarios del profesor sobre los trabajos realizados por el alumno para entender mejor sus fortalezas y áreas de mejora."))
                    parts.append(genai.types.Part.from_text(text="\t 3) Generar una recomendación para el profesor con el objetivo de ayudarle a entender mejor a su alumno y así poder ayudarle mejor."))
                    parts.append(genai.types.Part.from_text(text=f"\t 4) Define 5 micro-recomendaciones que podría adoptar el profesor para ayudar al alumno a mejorar en base a sus intereses y a los comentarios realizados por el profesor a lo largo del curso. Cada micro-recomendación debe tener aproximadamente {NO_WORDS_MICRORECOMENDACION} palabras."))
                else:
                    parts.append(genai.types.Part.from_text(text="\t 2) Generar una recomendación para el profesor con el objetivo de ayudarle a entender mejor a su alumno y así poder ayudarle mejor."))
                    parts.append(genai.types.Part.from_text(text=f"\t 3) Define 5 micro-recomendaciones que podría adoptar el profesor para ayudar al alumno a mejorar en base a sus intereses y a los comentarios realizados por el profesor a lo largo del curso. Cada micro-recomendación debe tener aproximadamente {NO_WORDS_MICRORECOMENDACION} palabras."))
        
        parts.append(genai.types.Part.from_text(text="Importante:"))
        parts.append(genai.types.Part.from_text(text="- La recomendación debe ser breve y concreta con lo que EVITA SALUDARLE Y VE AL GRANO."))
        parts.append(genai.types.Part.from_text(text=f"- La extensión de la recomendación debe ser aproximadamente {NO_WORDS} palabras."))
        parts.append(genai.types.Part.from_text(text="- Resalta entre ** los términso más relevantes de la recomendación."))
        parts.append(genai.types.Part.from_text(text="- Procura que la recomendación sea constructiva y motivadora tanto para el profesor que la va a leer como para el alumno para el que esta se dirige."))
        parts.append(genai.types.Part.from_text(text="- Las mcirorecomendaciones son acciones que el profesor debe implementar. Redactalas usando la segunda persona del singular como si te dirigieses al propio profesor."))

        contents = [genai.types.Content(role="user",parts=parts)]

        iter=0
        flag_success=False
        while iter < VERTEX_AI_RETIRES and flag_success==False:
            iter+=1
            try:
                response = client_genai.models.generate_content(model=model,contents=contents,config=generate_content_config)
                flag_success = True
                break
            except:
                time_sleep.sleep(VERTEX_AI_SECONDS_SLEEP)
        if flag_success==False:
            raise Exception("No se ha podido realizar la llamada a VertexAI")
        
        output=response.candidates[0].content.parts[0].text
        output = json.loads(output)
        recomendacion = output.get("recomendacion")
        recomendacion+="\n\nTe recomiendo lo siguiente:"
        recomendacion+=f'\n\n\t **(1)** {output.get("microrecomendacion_1")}'
        recomendacion+=f'\n\n\t **(2)** {output.get("microrecomendacion_2")}'
        recomendacion+=f'\n\n\t **(3)** {output.get("microrecomendacion_3")}'
        recomendacion+=f'\n\n\t **(4)** {output.get("microrecomendacion_4")}'
        recomendacion+=f'\n\n\t **(5)** {output.get("microrecomendacion_5")}'

    print(f"[PASO 7 FINALIZADO] Obteniendo recomendación del LLM | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    #Tras esto se actualiza la tabla de recomendaciones con la nueva recomendación generada:

    print(f"[PASO 8 INICIADO] Actualizar recomendación en T_RECOMENDACIONES_ALUMNO_PROFESOR | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

    sql = f"""
    MERGE `{PROJECT_ID}.{DATASET_ID}.T_RECOMENDACIONES_ALUMNO_PROFESOR` AS target
    USING (SELECT @centro_id AS centro_id, @alumno_id AS alumno_id, @clase AS clase, @asignatura AS asignatura) AS source
    ON target.centro_id = source.centro_id
       AND target.alumno_id = source.alumno_id
       AND target.clase = source.clase
       AND target.asignatura = source.asignatura
    WHEN MATCHED THEN
      UPDATE SET 
        recomendacion = @recomendacion
    WHEN NOT MATCHED THEN
      INSERT (centro_id, alumno_id, clase, asignatura, recomendacion)
      VALUES (@centro_id, @alumno_id, @clase, @asignatura, @recomendacion)
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("alumno_id", "STRING", alumno_id),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
            bigquery.ScalarQueryParameter("recomendacion", "STRING", recomendacion),
        ]
    )
    query_job = client_bigquery.query(sql, job_config=job_config)
    query_job.result()

    print(f"[PASO 8 FINALIZADO] Recomendación actualizada en T_RECOMENDACIONES_ALUMNO_PROFESOR | {id_centro} {clase} {asignatura} {alumno_id}", flush=True)

# ---------- Funciones de Idempotencia ----------

def generate_job_id(function_name: str, parameters: dict) -> str:
    """Genera un job_id único basado en el nombre de función y parámetros"""
    params_str = json.dumps(parameters, sort_keys=True, ensure_ascii=False)
    unique_str = f"{function_name}:{params_str}"
    return hashlib.sha256(unique_str.encode('utf-8')).hexdigest()

def check_job_status(job_id: str) -> tuple[Optional[str], Optional[datetime]]:
    """Verifica el estado actual de un job. Retorna (status, updated_at) o (None, None) si no existe."""
    sql = f"""
    SELECT status, updated_at
    FROM `{PROJECT_ID}.{DATASET_ID}.OP_WORKERS_EXECUTIONS`
    WHERE job_id = @job_id
    ORDER BY updated_at DESC
    LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("job_id", "STRING", job_id)
        ]
    )
    query_job = client_bigquery.query(sql, job_config=job_config)
    results = list(query_job.result())
    
    if results:
        return results[0].status, results[0].updated_at
    return None, None

def register_job_start(job_id: str, function_name: str, parameters: dict):
    """Registra el inicio de un job con status='processing'"""
    sql = f"""
    MERGE `{PROJECT_ID}.{DATASET_ID}.OP_WORKERS_EXECUTIONS` AS target
    USING (SELECT @job_id AS job_id) AS source
    ON target.job_id = source.job_id
    WHEN MATCHED THEN
      UPDATE SET 
        status = @status,
        updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
      INSERT (job_id, function_name, parameters, status, updated_at)
      VALUES (@job_id, @function_name, TO_JSON(@parameters), @status, CURRENT_TIMESTAMP())
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("job_id", "STRING", job_id),
            bigquery.ScalarQueryParameter("function_name", "STRING", function_name),
            bigquery.ScalarQueryParameter("parameters", "STRING", json.dumps(parameters, ensure_ascii=False)),
            bigquery.ScalarQueryParameter("status", "STRING", "processing")
        ]
    )
    query_job = client_bigquery.query(sql, job_config=job_config)
    query_job.result()
    print(f"[JOB TRACKING] Job {job_id[:8]}... registrado como 'processing'", flush=True)

def register_job_completed(job_id: str):
    """Marca un job como completado"""
    sql = f"""
    UPDATE `{PROJECT_ID}.{DATASET_ID}.OP_WORKERS_EXECUTIONS`
    SET status = @status, updated_at = CURRENT_TIMESTAMP()
    WHERE job_id = @job_id
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("job_id", "STRING", job_id),
            bigquery.ScalarQueryParameter("status", "STRING", "completed")
        ]
    )
    query_job = client_bigquery.query(sql, job_config=job_config)
    query_job.result()
    print(f"[JOB TRACKING] Job {job_id[:8]}... marcado como 'completed'", flush=True)

def register_job_failed(job_id: str, error_message: str):
    """Marca un job como fallido"""
    sql = f"""
    UPDATE `{PROJECT_ID}.{DATASET_ID}.OP_WORKERS_EXECUTIONS`
    SET status = @status, updated_at = CURRENT_TIMESTAMP()
    WHERE job_id = @job_id
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("job_id", "STRING", job_id),
            bigquery.ScalarQueryParameter("status", "STRING", "failed")
        ]
    )
    query_job = client_bigquery.query(sql, job_config=job_config)
    query_job.result()
    print(f"[JOB TRACKING] Job {job_id[:8]}... marcado como 'failed': {error_message}", flush=True)


# ---------- Endpoints ----------
@app.get("/")
def root():
    """Endpoint raíz para verificar que el servicio está activo"""
    return {
        "service": "Recomendador Profesor Worker",
        "status": "running",
        "version": "1.0",
        "description": "Worker para procesar mensajes de PubSub"
    }

@app.get("/health")
def health():
    """Health check para Cloud Run"""
    return {"status": "healthy", "service": "recomendador-profesor-worker"}

@app.post("/")
async def task_handler(request: Request):
    """
    Endpoint principal que recibe tareas de Cloud Tasks o PubSub.
    Cloud Tasks envía JSON directo, PubSub envía con wrapper.
    Implementa idempotencia mediante tracking en OP_WORKERS_EXECUTIONS.
    """
    try:
        # Obtener el cuerpo del mensaje
        message_json = await request.json()
        print(f"Mensaje recibido: {message_json}", flush=True)
        action = message_json.get("action", "generar_recomendaciones_profesor")
        
        if action == "generar_recomendaciones_profesor":
            # Obtener parámetros
            id_centro = message_json.get("centro_id")
            if not id_centro:
                raise HTTPException(status_code=400, detail="Missing centro_id")
            clase = message_json.get("clase")
            if not clase:
                raise HTTPException(status_code=400, detail="Missing clase")
            asignatura = message_json.get("asignatura")
            if not asignatura:
                raise HTTPException(status_code=400, detail="Missing asignatura")
            alumno_id = message_json.get("alumno_id")
            if not alumno_id:
                raise HTTPException(status_code=400, detail="Missing alumno_id")
            
            # Generar job_id único para esta tarea
            parameters = {
                "centro_id": id_centro,
                "asignatura": asignatura,
                "clase": clase,
                "alumno_id": alumno_id
            }
            job_id = generate_job_id(action, parameters)
            
            # Verificar si el job ya existe y su estado
            current_status, updated_at = check_job_status(job_id)
            
            # Definir timeout de 2 horas
            now = datetime.now(timezone.utc)
            
            # Si el job existe, verificar si han pasado más de 2 horas
            if current_status is not None and updated_at is not None:
                # Asegurar que updated_at tenga timezone
                if updated_at.tzinfo is None:
                    updated_at = updated_at.replace(tzinfo=timezone.utc)
                
                time_elapsed = now - updated_at
                hours_elapsed = time_elapsed.total_seconds() / 3600
                                
                if hours_elapsed < TIMEOUT_HOURS_OVERLAP_FUNCTIONS:
                    if current_status == "processing":
                        return {"status": "already_processing", "job_id": job_id, "hours_elapsed": hours_elapsed}
                    if current_status == "completed":
                        return {"status": "already_completed", "job_id": job_id, "hours_elapsed": hours_elapsed}
                
            # Registrar inicio del job
            register_job_start(job_id, action, parameters)
            
            try:
                # Ejecutar el procesamiento
                generar_recomendaciones_profesor(
                    id_centro, 
                    asignatura,
                    clase,
                    alumno_id
                )
                
                # Marcar como completado
                register_job_completed(job_id)
                
                return {"status": "success", "job_id": job_id}
                
            except Exception as e:
                error_msg = str(e)
                register_job_failed(job_id, error_msg)
                print(f"[ERROR] Job {job_id[:8]}... falló: {error_msg}", flush=True)
                raise
        else:
            raise HTTPException(status_code=400, detail="Acción desconocida")
    
    except Exception as e:
        print(f"[ERROR] {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))
