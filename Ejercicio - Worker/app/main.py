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
ELEVENLABS_API_KEY=os.getenv("ELEVENLABS_API_KEY", "")
GCS_BUCKET_CONTENIDO = os.getenv("GCS_BUCKET_CONTENIDO", "")
GCS_BUCKET_EJERCICIO= os.getenv("GCS_BUCKET_EJERCICIO", "")

#Se establecen algunas variables de configuración adicionales:

MARKED_CONTENT = "****"
NO_WORDS_HINT=150
NO_WORDS_TITLE=10
NO_WORDS_EXERCISE=200
NO_WORDS_FUTURO=200
NO_WORDS_CONSEJO=150

VERTEX_AI_RETIRES=10
VERTEX_AI_SECONDS_SLEEP=60
TIMEOUT_HOURS_OVERLAP_FUNCTIONS = 3

MULETILLAS_EMOCION =["[Enfasis]","[Silencio breve]","[Silencio largo]","[Pausa breve]","[Pausa larga]","[Respiro breve]","[Respiro profundo]","[Risa breve]","[Risa intensa]","[Usa un tono emocionante]","[Usa un tono triste]"]
ELEVENLAB_VOICE_ID="gD1IexrzCvsXPHUuT0s3"
ELEVENLABS_RETIRES=10
ELEVENLABS_SECONDS_SLEEP=60

CSS_RULES = """
<style>
  html, body{
    font-family: "Century Gothic", "CenturyGothic", AppleGothic, "URW Gothic L", "Franklin Gothic Medium", Arial, sans-serif;
    font-size: 10.5px;
  }
  .verde{
    color: #7EB900;
  }
  .azul{
    color: #0066A4;
  }
  .blanco{
    color: #FFFFFF;
  }
  .negro{
    color:#000000;
  }
  .negrita{
    font-weight: 700;
  }
  .cabecera{
    font-size: 10px;
  }
  .unidad{
    font-size: 24px;
  }
  .capitulo{
    font-size: 16px;
  }
  .seccion{
    font-size: 16px;
  }
  .texto, .ejemplo, .ejercicio{
    text-align: justify;
  }
  .dina4{
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
    padding: 3mm;
    box-sizing: border-box;
  }
  .justificado{
    text-align: justify !important;
   }
  .qr_panel{
    display: inline-flex;
    align-items: center;
    background: #0098A7;
    padding: 1px 1px;
    border-radius: 50px 0 0 50px;
    gap: 12px;
    float: right;
    width: 230px;
  }
  .qr_panel__img{
    padding: 0px;
    margin-left: 25px;
    display: grid;
    place-items: center;
  }
  .qr_panel__img img{
    width: 50px;
    height: 50px;
    object-fit: cover;
    display: block;
  }
  .panel__text{
    white-space: nowrap;
  }
  .main_imagen {
    display: flex;
    justify-content: center;
  }
  .main_imagen img {
    max-width: 500px;
  }
  .cabecera-row{
    display: flex;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    box-sizing: border-box;
  }
  .cabecera-left, .cabecera-right{
    flex: 0 0 auto;
  }
  .cabecera-center{
    flex: 1 1 auto;
    text-align: center;
  }
  .imagen_cabecera{
    display: block;
    max-height: 36px;
    width: auto;
  }


  /* --- Sección "El Desafío" (responsive) --- */
  .desafio{
    margin-top: 28px;
  }
  .desafio__title{
    font-size: 26px;
    font-weight: 900;
    margin: 0 0 8px 0;
    color: #1f1f1f;
  }
  .desafio__text{
    font-size: 13px;
    line-height: 1.45;
    margin: 0 0 18px 0;
    color: #6b6b6b;
    max-width: 980px;
  }
  .desafio__subtitle{
    font-size: 20px;
    font-weight: 900;
    margin: 0 0 14px 0;
    color: #1f1f1f;
  }
  .desafio__grid{
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  @media (max-width: 840px){
    .desafio__grid{ grid-template-columns: 1fr; }
  }
  .scenario{
    border-radius: 12px;
    padding: 18px 18px 16px 18px;
    box-shadow: 0 8px 18px rgba(0,0,0,.06);
    border: 1px solid rgba(0,0,0,.06);
  }
  .scenario__head{
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .scenario__icon{
    width: 22px;
    height: 22px;
    flex: 0 0 22px;
  }
  .scenario__title{
    font-size: 16px;
    font-weight: 900;
    margin: 0;
    color: #1f1f1f;
  }
  .scenario__desc{
    font-size: 12.5px;
    line-height: 1.45;
    margin: 0;
    color: #515151;
  }
  .scenario--blue{ background: #d9e9ff; }
  .scenario--green{ background: #dff7e8; }
  .scenario--yellow{ background: #fbf1c9; }
  .scenario--pink{ background: #f8dbe8; }
  .scenario--green .scenario__icon{ color: #2e8b57; }
  .scenario--pink .scenario__icon{ color: #cc3f6a; }
  .scenario--blue .scenario__icon{ color: #3a75c4; }
  .scenario--yellow .scenario__icon{ color: #a36b00; }


  /* --- Componentes "¿Cómo entregar tu trabajo?" (responsive) --- */
  .entrega{
    margin-top: 28px;
  }
  .entrega__title{
    font-size: 22px;
    font-weight: 800;
    margin: 0 0 8px 0;
    color: #1f1f1f;
  }
  .entrega__subtitle{
    font-size: 13px;
    margin: 0 0 14px 0;
    color: #6b6b6b;
  }
  .entrega__cards{
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin: 14px 0 18px 0;
  }
  .entrega__card{
    background: #ffffff;
    border: 1px solid #e9e9e9;
    border-radius: 14px;
    padding: 18px 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,.04);
    min-height: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 10px;
  }
  .entrega__icon{
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
  }
  .entrega__card-title{
    font-size: 14px;
    font-weight: 800;
    margin: 0;
    color: #1f1f1f;
  }
  .entrega__card-text{
    font-size: 12px;
    margin: 0;
    color: #7a7a7a;
    max-width: 260px;
  }

  .info-box{
    background: #DCEFC4; /* verde suave */
    border: 1px solid rgba(0,0,0,.08);
    border-radius: 10px;
    padding: 14px 14px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-top: 14px;
  }
  .info-box__icon{
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    margin-top: 2px;
  }
  .info-box__title{
    font-size: 14px;
    font-weight: 800;
    margin: 0 0 6px 0;
    color: #1f1f1f;
  }
  .info-box__text{
    font-size: 12.5px;
    margin: 0;
    color: #2d2d2d;
    line-height: 1.35;
  }

  /* Responsivo */
  @media (max-width: 900px){
    .entrega__cards{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 560px){
    .dina4{ padding: 14mm; }
    .entrega__cards{ grid-template-columns: 1fr; }
    .entrega__title{ font-size: 19px; }
  }


  /* Bloque: Diseñador de videojuegos */
  .videojuego{ margin: 0 0 18px 0; }
  .videojuego__title{
    font-size: 20px;
    font-weight: 900;
    margin: 0 0 10px 0;
    color: #1f1f1f;
  }
  .videojuego__box{
    background: #f3f4f6;
    border: 1px solid rgba(0,0,0,.06);
    border-radius: 12px;
    padding: 14px 16px;
    color: #4a4a4a;
  }
  .videojuego__box p{
    margin: 0 0 10px 0;
    font-size: 12.5px;
    line-height: 1.45;
  }
  .videojuego__box p:last-child{ margin-bottom: 0; }
</style>
"""

app = FastAPI(title="Ejercicio Worker - PubSub Receiver", version="1.0")

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

#Y también en ElevenLabs:
client_elevenlabs = ElevenLabs(
    api_key=ELEVENLABS_API_KEY
)

# ---------- Helpers ----------

def generar_ejercicio(id_centro: str, id_alumno: str, clase: str, asignatura: str, unidad: int):
    
    #Comenzamos obteniendo las secciones disponibles:
    print(f"[PASO 1 INICIADO] Consultando secciones en BigQuery | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)
    
    sql = f"""SELECT DISTINCT seccion FROM `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE` 
              WHERE centro_id = @centro_id 
              AND clase = @clase
              AND asignatura = @asignatura
              AND unidad = @unidad
              AND flag_creado = @flag_creado
              AND flag_aprobado = @flag_aprobado"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", unidad),
            bigquery.ScalarQueryParameter("flag_creado", "BOOL", True),
            bigquery.ScalarQueryParameter("flag_aprobado", "BOOL", True),
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    secciones = job.to_dataframe()

    print(f"[PASO 1 COMPLETADO] Se obtuvieron {len(secciones)} secciones | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    #Se obtiene el título de la unidad:

    print(f"[PASO 2 INICIADO] Consultando el título de la unidad en BigQuery | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    sql = f"""SELECT DISTINCT titulo FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES` 
              WHERE centro_id = @centro_id 
              AND clase = @clase
              AND asignatura = @asignatura
              AND unidad = @unidad"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", unidad),
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    titulo_unidad = job.to_dataframe()['titulo'].iloc[0]

    print(f"[PASO 2 FINALIZADO] Consultando el título de la unidad en BigQuery | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    #Para no repetir contenido realizamos una consulta a la tabla T_CONTENIDO_DISPONIBLE_EJERCICIOS para ver el contneido generado previamente por el alumno:
    print(f"[PASO 3 INICIADO] Consultando los ejercicios generados previamente por el alumno en BigQuery | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)
    
    sql = f"""SELECT DISTINCT id FROM `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE_EJERCICIOS` 
              WHERE centro_id = @centro_id 
              AND clase = @clase
              AND asignatura = @asignatura
              AND unidad = @unidad
              AND alumno_id = @alumno_id"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", unidad),
            bigquery.ScalarQueryParameter("alumno_id", "STRING", id_alumno)
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    ejercicios_previos = job.to_dataframe()

    print(f"[PASO 3 FINALIZADO] Se obtuvieron {len(ejercicios_previos)} ejercicios | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    #Leemos los intereses del alumno:
    print(f"[PASO 4 INICIADO] Leemos los intereses del alumno | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

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
            bigquery.ScalarQueryParameter("id_alumno", "STRING", id_alumno)
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    intereses = job.to_dataframe()
    texto_tiempo_libre = intereses['texto_tiempo_libre'].iloc[0] if len(intereses) > 0 and 'texto_tiempo_libre' in intereses.columns else ""
    texto_que_te_motiva = intereses['texto_que_te_motiva'].iloc[0] if len(intereses) > 0 and 'texto_que_te_motiva' in intereses.columns else ""
    texto_que_te_ayuda_a_entender = intereses['texto_que_te_ayuda_a_entender'].iloc[0] if len(intereses) > 0 and 'texto_que_te_ayuda_a_entender' in intereses.columns else ""
    texto_que_te_frustra_a_estudiar = intereses['texto_que_te_frustra_a_estudiar'].iloc[0] if len(intereses) > 0 and 'texto_que_te_frustra_a_estudiar' in intereses.columns else ""
    texto_que_asignaturas_se_te_dan_mejor = intereses['texto_que_asignaturas_se_te_dan_mejor'].iloc[0] if len(intereses) > 0 and 'texto_que_asignaturas_se_te_dan_mejor' in intereses.columns else ""
    
    print(f"[PASO 4 FINALIZADO] Leemos los intereses del alumno | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    #Procesamos los intereses del alumno:
    print(f"[PASO 5 INICIADO] Procesamos los intereses del alumno | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

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

    print(f"[PASO 5 FINALIZADO] Procesamos los intereses del alumno | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    #Leemos los documentos en los que se basará el ejercicio:
    print(f"[PASO 6 INICIADO] Leemos los documentos PDF generados | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    documents=[]
    for idx, row in secciones.iterrows():
        
        print(f"[PASO 6 PROCESANDO] Step {idx+1}/{len(secciones)} | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

        blob_name=f"{id_centro}/{clase}/{asignatura}/{unidad}/{row['seccion']}.pdf"
        documents.append(genai.types.Part.from_uri(
            file_uri=f"gs://{GCS_BUCKET_CONTENIDO}/{blob_name}",
            mime_type="application/pdf",
        ))
    
    print(f"[PASO 6 FINALIZADO] Leemos los documentos PDF generados | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    #Leemos los diferentes ejercicios realizados por el alumno:
    print(f"[PASO 7 INICIADO] Leemos los ejercicios PDF generados | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    ejercicios=[]
    for idx, row in ejercicios_previos.iterrows():
        
        print(f"[PASO 7 PROCESANDO] Step {idx+1}/{len(ejercicios_previos)} | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

        blob_name=f"{id_centro}/{clase}/{asignatura}/{unidad}/{id_alumno}/{row['id']}.pdf"
        ejercicios.append(genai.types.Part.from_uri(
            file_uri=f"gs://{GCS_BUCKET_EJERCICIO}/{blob_name}",
            mime_type="application/pdf",
        ))
    
    print(f"[PASO 7 FINALIZADO] Leemos los ejercicios PDF generados | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)


    #Tras esto generamos el ejercicio:
    print(f"[PASO 8 INICIADO] Generando el ejercicio | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

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
        response_schema = {"type":"OBJECT","properties":{"exercise":{"type":"STRING","description":f"Enunciado del ejercicio planteado al alumno en formato HTML. Debe tener una extensión aproximada de {NO_WORDS_EXERCISE} palabras."},"exercise_title":{"type":"STRING","description":f"Título del ejercicio planteado al alumno en formato texto plano. Debe tener una extensión aproximada de {NO_WORDS_TITLE} palabras."},"consejo":{"type":"STRING","description":f"Consejos practicos para afrontar el ejercicio. Debe tener una extension aproximada de {NO_WORDS_CONSEJO} palabras."},"futuro":{"type":"STRING","description":f"Aplicabilidad futura de la actividad para el alumno en su dia a dia a futuro. Debe tener una extension aproximada de {NO_WORDS_FUTURO} palabras."}},"required":["exercise","exercise_title","consejo","futuro"]},
    )

    parts=[]
    parts.append(genai.types.Part.from_text(text=f"Eres un profesor de {asignatura} que imparte clase para los alumnos de la clase {clase}."))
    parts.append(genai.types.Part.from_text(text=f"Uno de tus alumnos te pide que elabores un ejercicio para que pueda practicar los contenidos que ha estado viendo en clase sobre la unidad {unidad}."))
    parts.append(genai.types.Part.from_text(text="Para tu información, el contenido de la asignatura lo componen los siguientes documentos:"))
    parts+=documents
    if not intereses_txt == "":
        parts.append(genai.types.Part.from_text(text="El alumno te pide que en la medida de lo posible elabores un ejercicio que tenga en cuenta sus intereses y para ello decides revisar un formulario que se les envió a principio de curso en el que el alumno respondió a varias preguntas sobre sus intereses, motivaciones, frustraciones y asignaturas que se le dan mejor. El contenido de dicho formulario es el siguiente:"))
        parts.append(genai.types.Part.from_text(text=intereses_txt))
    if len(ejercicios) > 0:
        parts.append(genai.types.Part.from_text(text="Además, decides revisar los ejercicios que el alumno ha ido realizando a lo largo del curso para no repetir temáticas ni formatos de ejercicio y para intentar elaborar un ejercicio que sea diferente a los anteriores pero que a la vez mantenga cierta coherencia con ellos. Los ejercicios previos realizados por el alumno son los siguientes:"))
        parts+=ejercicios
    parts.append(genai.types.Part.from_text(text="Tu tarea:"))
    parts.append(genai.types.Part.from_text(text="\t 1) Leer atentamente el contenido de la asignatura."))
    if not intereses_txt == "":
        parts.append(genai.types.Part.from_text(text="\t 2) Perfilar los intereses del alumno para conocer qué es aquello que realmente le interesa."))
        if len(ejercicios) == 1:
            parts.append(genai.types.Part.from_text(text="\t 3) Revisar los ejercicios previos del alumno para evitar repetir ejercicios similares."))
            parts.append(genai.types.Part.from_text(text="\t 4) Generar el ejercicio para el alumno."))
            parts.append(genai.types.Part.from_text(text="\t 5) Buscar un título interesante para el ejercicio."))
            parts.append(genai.types.Part.from_text(text="\t 6) Proporcionar entre 3 y 5 consejos para la resolución del ejercicio."))
            parts.append(genai.types.Part.from_text(text="\t 7) Listar con, entre 3 y 5 utilidades prácticas que el alumno podría obtener a futuro al fortalecer los contenidos explicados en la unidad {unidad} de la asignatura {asignatura} con la realización del ejercicio."))
        else:
            parts.append(genai.types.Part.from_text(text="\t 3) Generar el ejercicio para el alumno."))
            parts.append(genai.types.Part.from_text(text="\t 4) Buscar un título interesante para el ejercicio."))
            parts.append(genai.types.Part.from_text(text="\t 5) Proporcionar entre 3 y 5 consejos para la resolución del ejercicio."))
            parts.append(genai.types.Part.from_text(text="\t 6) Listar con, entre 3 y 5 utilidades prácticas que el alumno podría obtener a futuro al fortalecer los contenidos explicados en la unidad {unidad} de la asignatura {asignatura} con la realización del ejercicio."))
    else:
        if len(ejercicios) == 1:
            parts.append(genai.types.Part.from_text(text="\t 2) Revisar los ejercicios previos del alumno para evitar repetir ejercicios similares."))
            parts.append(genai.types.Part.from_text(text="\t 3) Generar el ejercicio para el alumno."))
            parts.append(genai.types.Part.from_text(text="\t 4) Buscar un título interesante para el ejercicio."))
            parts.append(genai.types.Part.from_text(text="\t 5) Proporcionar entre 3 y 5 consejos para la resolución del ejercicio."))
            parts.append(genai.types.Part.from_text(text="\t 6) Listar con, entre 3 y 5 utilidades prácticas que el alumno podría obtener a futuro al fortalecer los contenidos explicados en la unidad {unidad} de la asignatura {asignatura} con la realización del ejercicio."))
        else:
            parts.append(genai.types.Part.from_text(text="\t 2) Generar el ejercicio para el alumno."))
            parts.append(genai.types.Part.from_text(text="\t 3) Buscar un título interesante para el ejercicio."))
            parts.append(genai.types.Part.from_text(text="\t 4) Proporcionar entre 3 y 5 consejos para la resolución del ejercicio."))
            parts.append(genai.types.Part.from_text(text="\t 5) Listar con, entre 3 y 5 utilidades prácticas que el alumno podría obtener a futuro al fortalecer los contenidos explicados en la unidad {unidad} de la asignatura {asignatura} con la realización del ejercicio."))
    parts.append(genai.types.Part.from_text(text="Importante:"))
    parts.append(genai.types.Part.from_text(text="- El ejercicio debe ser breve con lo que EVITA SALUDARLE Y VE AL GRANO."))
    parts.append(genai.types.Part.from_text(text="- Las referencias que hagas sobre los intereses del alumno deben ser sutiles. El alumno no tiene que saber que el ejercicio ha sido hecho por y para él. Probablemente se sienta más cómodo si, por ejemplo, destacar en negrita los términos relacionados con sus intereses."))
    parts.append(genai.types.Part.from_text(text="- Proporciona la respuesta al ejercicio, el consejo y las utilidades prácticas usando HTML que únicamente utilice las etiquetas <p>, <b>, <ul>, <ol> y <li>). No incluyas ningún otro tipo de etiqueta HTML ni estilos CSS."))
    parts.append(genai.types.Part.from_text(text="- El título del ejercicio debe ser texto plano, no HTML."))
    parts.append(genai.types.Part.from_text(text=f"- Recuerda que la extensión del ejercicio deben ser aproximadamente {NO_WORDS_EXERCISE} palabras y la del título {NO_WORDS_TITLE} palabras."))

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
    html_exercise = output.get("exercise")
    html_exercise_title = output.get("exercise_title")
    consejo = output.get("consejo")
    futuro = output.get("futuro")

    print(f"[PASO 8 FINALIZADO] Generando el ejercicio | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    #Construimos el ejercicio final creando un documento HTML y guardándolo en GCS:

    print(f"[PASO 9 INICIADO] Construyendo el ejercicio final en HTML y guardándolo en GCS | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)
    
    html_content=f"<!doctype html><html lang=\"es\"><head>{CSS_RULES}</head><body><div class=\"dina4\">"
    html_content+=f"""
        <section class="videojuego">
        <h2 class="videojuego__title justificado">{html_exercise_title}</h2>
        <div class="videojuego__box">
        {html_exercise}
        </div>
    </section>
    """

    html_content+=f"""
    <div class="info-box">
      <div class="info-box__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3a7 7 0 0 0-4 12.8V18a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.2A7 7 0 0 0 12 3z" stroke="#1f1f1f" stroke-width="2" opacity=".75"/>
          <path d="M9 22h6" stroke="#1f1f1f" stroke-width="2" stroke-linecap="round" opacity=".75"/>
        </svg>
      </div>
      <div>
        <p class="info-box__title">Objetivo del ejercicio</p>
        <p class="info-box__text justificado">{consejo}</p>
      </div>
    </div>
    """

    html_content+=f"""
    <div class="info-box">
      <div class="info-box__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 2h12" stroke="#1f1f1f" stroke-width="2" stroke-linecap="round" opacity=".75"/>
          <path d="M6 22h12" stroke="#1f1f1f" stroke-width="2" stroke-linecap="round" opacity=".75"/>
          <path d="M8 2v4c0 2.2 1.2 3.4 2.7 4.7L12 12l1.3-1.3C14.8 9.4 16 8.2 16 6V2" stroke="#1f1f1f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>
          <path d="M8 22v-4c0-2.2 1.2-3.4 2.7-4.7L12 12l1.3 1.3C14.8 14.6 16 15.8 16 18v4" stroke="#1f1f1f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>
        </svg>
      </div>
      <div>
        <p class="info-box__title">Aplicación futura del ejercicio</p>
        <p class="info-box__text justificado">{futuro}</p>
      </div>
    </div>"""

    html_content+="</div></body></html>"

    bucket = storage_client.bucket(GCS_BUCKET_EJERCICIO)
    blob_path = f"{id_centro}/{clase}/{asignatura}/{unidad}/{id_alumno}/{len(ejercicios_previos)+1}.html"
    blob = bucket.blob(blob_path)
    blob.upload_from_string(html_content, content_type="text/html; charset=utf-8")

    print(f"[PASO 9 FINALIZADO] Construyendo el ejercicio final en HTML y guardándolo en GCS | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    # Ahora lo que hacemos es guardarlo en formato PDF:

    print(f"[PASO 10 INICIADO] Construyendo el ejercicio final en PDF y guardándolo en GCS | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    pdf_bytes = WeasyHTML(string=html_content).write_pdf()
    bucket = storage_client.bucket(GCS_BUCKET_EJERCICIO)
    pdf_blob_path = f"{id_centro}/{clase}/{asignatura}/{unidad}/{id_alumno}/{len(ejercicios_previos)+1}.pdf"
    pdf_blob = bucket.blob(pdf_blob_path)
    pdf_blob.upload_from_string(pdf_bytes, content_type='application/pdf')

    print(f"[PASO 10 FINALIZADO] Construyendo el ejercicio final en PDF y guardándolo en GCS | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    # Lo siguiente que hacemos es generar un "hint":

    print(f"[PASO 11 INICIADO] Generando un hint para el ejercicio | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

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
        response_schema = {"type":"OBJECT","properties":{"hint":{"type":"STRING","description":"Ayuda explicativa que se le brinda al alumno para ayudarle en la resolución del ejercicio con una extensión aproximada de {NO_WORDS_HINT} palabras"}},"required":["hint"]},
    )

    parts=[]
    parts.append(genai.types.Part.from_text(text=f"Eres un profesor de {asignatura} que imparte clase para los alumnos de la clase {clase}."))
    parts.append(genai.types.Part.from_text(text=f"El otro día le pusiste el siguiente ejercicio a uno de tus alumnos:"))
    parts.append(genai.types.Part.from_bytes(data=pdf_bytes,mime_type="application/pdf"))
    parts.append(genai.types.Part.from_text(text=f"Ahora, ese alumno te pide que le ayudes a resolverlo ya que no puede hacerlo por su propia cuenta."))
    parts.append(genai.types.Part.from_text(text="Para ayudarle a resolverlo decides revisar el contenido de la asignatura:"))
    parts+=documents
    if not intereses_txt == "":
        parts.append(genai.types.Part.from_text(text="Decides ayudar a alumno pero para ello decides hacerlo adaptado a su interés, y para ello decides revisar un formulario que se les envió a principio de curso en el que el alumno respondió a varias preguntas sobre sus intereses, motivaciones, frustraciones y asignaturas que se le dan mejor. El contenido de dicho formulario es el siguiente:"))
        parts.append(genai.types.Part.from_text(text=intereses_txt))
    parts.append(genai.types.Part.from_text(text="Tu tarea:"))
    parts.append(genai.types.Part.from_text(text="\t 1) Leer atentamente el ejercicio que le pusiste al alumno."))
    parts.append(genai.types.Part.from_text(text="\t 2) Leer atentamente el contenido de la asignatura."))
    if not intereses_txt == "":
        parts.append(genai.types.Part.from_text(text="\t 3) Perfilar los intereses del alumno para conocer qué es aquello que realmente le interesa."))
        parts.append(genai.types.Part.from_text(text=f"\t 4) Dale un consejo al alumno con unas {NO_WORDS_HINT} palabras aproximadamente."))

    else:
        parts.append(genai.types.Part.from_text(text=f"\t 3) Dale un consejo al alumno con unas {NO_WORDS_HINT} palabras aproximadamente."))
    parts.append(genai.types.Part.from_text(text="Importante:"))
    parts.append(genai.types.Part.from_text(text="- La aclaración debe ser breve con lo que EVITA SALUDARLE Y VE AL GRANO."))
    parts.append(genai.types.Part.from_text(text="- Las referencias que hagas sobre los intereses del alumno deben ser sutiles."))
    parts.append(genai.types.Part.from_text(text=f"- Recuerda que la extensión debe ser de aproximadamente {NO_WORDS_HINT} palabras."))

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
    hint = output.get("hint")

    print(f"[PASO 11 FINALIZADO] Hint generado para el ejercicio | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    #El siguiente paso será formatear el texto para evitar que contenga caracteres no legibles:

    print(f"[PASO 12 INICIADO] Formatear el hint | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    model = "gemini-2.5-flash"
    generate_content_config = genai.types.GenerateContentConfig(
        temperature = 0.7,
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
        response_schema = {"type": "OBJECT","properties": {"Bloque adaptado": {"type": "STRING", "description": "Bloque de texto adaptado para síntesis de voz"}},"required": ["Bloque adaptado"]},
    )
    
    parts=[]
    parts.append(genai.types.Part.from_text(text=f"Eres un experto adaptando bloques de texto para que puedan ser leídos por un sistema de síntesis de voz."))
    parts.append(genai.types.Part.from_text(text="A continuación debes ser capaz de adaptar el siguiente bloque de texto:"))
    parts.append(genai.types.Part.from_text(text=hint))
    parts.append(genai.types.Part.from_text(text="Tu tarea:"))
    parts.append(genai.types.Part.from_text(text="\t 1) Le el bloque de texto con detenimiento."))
    parts.append(genai.types.Part.from_text(text="\t 2) Adapta el texto sin cambiar el contenido para ello tendrás que hacer cambios como:"))
    parts.append(genai.types.Part.from_text(text="\t\t - Los signos como €, %, & deben ser adaptados a su forma textual, es decir, 'euros', 'por ciento', 'y' respectivamente."))
    parts.append(genai.types.Part.from_text(text="\t\t - Los números deben ser adaptados a su forma textual, es decir, '1' se convierte en 'uno', '2' en 'dos', etc."))
    parts.append(genai.types.Part.from_text(text="\t\t - Los números decimales también deben ser adaptados a su forma textual, es decir, '1.5' se convierte en 'uno coma cinco', '2.75' en 'dos coma setenta y cinco', etc."))
    parts.append(genai.types.Part.from_text(text="\t\t - Los números negativos también deben ser adaptados a su forma textual, es decir, '-1' se convierte en 'menos uno', '-2.5' en 'menos dos coma cinco', etc."))
    parts.append(genai.types.Part.from_text(text="\t\t - Las fracciones también deben ser adaptadas a su forma textual, es decir, '1/2' se convierte en 'un medio', '3/4' en 'tres cuartos', etc."))
    parts.append(genai.types.Part.from_text(text="\t\t - Las expresiones matemáticas deben ser adaptadas a su forma textual, es decir, '1 + 1' se convierte en 'uno más uno', '2 - 1' en 'dos menos uno', etc."))
    parts.append(genai.types.Part.from_text(text="IMPORTANTE:"))
    parts.append(genai.types.Part.from_text(text="\t -Tu función es traducir es adaptar ese fragmento de texto pero sin modificar su contenido. Tu respuesta debe ser un calco al texto original habiendo hecho las adaptaciones oportunas."))
    contents = [genai.types.Content(role="user",parts=parts)]

    iter=0
    flag_success=False
    while iter < VERTEX_AI_RETIRES and flag_success==False:
        iter+=1
        try:
            response = client_genai.models.generate_content(model=model,contents=contents,config=generate_content_config)
            flag_success = True
            break
        except Exception as e:
            time_sleep.sleep(VERTEX_AI_SECONDS_SLEEP)
    if flag_success==False:
        raise Exception("No se ha podido realizar la llamada a VertexAI")
    
    resultado = response.candidates[0].content.parts[0].text
    resultado = json.loads(resultado)
    hint_adaptada = resultado["Bloque adaptado"]

    print(f"[PASO 12 FINALIZADO] Formatear el hint | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    #Tras esto intentamso enfatizar el mensaje por audio añadiendo pequeñas tips para la resolución:

    print(f"[PASO 13 INICIADO] Enfatizar el hint | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    generate_content_config = genai.types.GenerateContentConfig(
        temperature = 0.7,
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
        response_schema = {"type": "OBJECT","properties": {"Bloque adaptado": {"type": "STRING", "description": "Bloque de texto adaptado para síntesis de voz"}},"required": ["Bloque adaptado"]},
    )

    parts=[]
    parts.append(genai.types.Part.from_text(text=f"Eres un experto en comunicación expresiva."))
    parts.append(genai.types.Part.from_text(text=f"Tu papel es incluir muletillas que permitan transmitir un mensaje con mucha más naturalidad."))
    parts.append(genai.types.Part.from_text(text=f"Para ello incorporas, a los fragmentos de texto que te proporiconan expresiones entre corchetes que indican acciones o emociones, por ejemplo, [respira profundamente], [con tono de sorpresa], [con voz baja], etc."))
    parts.append(genai.types.Part.from_text(text="A continuación debes ser capaz de adaptar el siguiente bloque de texto para que traslade una mayor naturalidad:"))
    parts.append(genai.types.Part.from_text(text=hint_adaptada))
    parts.append(genai.types.Part.from_text(text="Tu tarea:"))
    parts.append(genai.types.Part.from_text(text="\t 1) Le el bloque de texto con detenimiento."))
    parts.append(genai.types.Part.from_text(text="\t 2) Incorpora algunas de las siguientes muletillas pero sin hacer que el resultado parezca forzado:"))
    for item in MULETILLAS_EMOCION:
        parts.append(genai.types.Part.from_text(text=f"\t - {item}"))
        parts.append(genai.types.Part.from_text(text="Importante:"))
    parts.append(genai.types.Part.from_text(text="\t -No modifiques el contenido del bloque de texto. Solo debes proporcionar el mismo fragmento habiendo incluido muletillas entre corchetes donde puedas denotar emociones y hacer que el discuro sea mucho más natural."))
    contents = [genai.types.Content(role="user",parts=parts)]

    iter=0
    flag_success=False
    while iter < VERTEX_AI_RETIRES and flag_success==False:
        iter+=1
        try:
            response = client_genai.models.generate_content(model=model,contents=contents,config=generate_content_config)
            flag_success = True
            break
        except Exception as e:
            time_sleep.sleep(VERTEX_AI_SECONDS_SLEEP)
    if flag_success==False:
        raise Exception("No se ha podido realizar la llamada a VertexAI")
    
    resultado = response.candidates[0].content.parts[0].text
    resultado = json.loads(resultado)
    hint_adapatada_enfatizada=resultado["Bloque adaptado"]

    print(f"[PASO 13 FINALIZADO] Enfatizar el hint | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    #Tras esto generamos el audio y lo gaurdamso en GCP:

    print(f"[PASO 14 INICIADO] Generar el audio y almacenarlo en GCP | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    all_audios = []
    iter=0
    flag_success=False
    while iter < ELEVENLABS_RETIRES and flag_success==False:
        iter+=1
        try:
            audio_stream = client_elevenlabs.text_to_speech.convert(
                text=hint_adapatada_enfatizada,
                voice_id=ELEVENLAB_VOICE_ID,
                model_id="eleven_v3",
                language_code="es",
                output_format="mp3_44100_128"
            )
            all_audios.append(b"".join(audio_stream))
            flag_success = True
            break
        except Exception as e:
            time_sleep.sleep(ELEVENLABS_SECONDS_SLEEP)
    if flag_success==False:
        raise Exception("No se ha podido realizar la llamada a ElevenLabs")

    audio_data = b"".join(all_audios)
    bucket = storage_client.bucket(GCS_BUCKET_EJERCICIO)
    blob_path = f"{id_centro}/{clase}/{asignatura}/{unidad}/{id_alumno}/{len(ejercicios_previos)+1}.mp3"
    blob = bucket.blob(blob_path)
    blob.upload_from_string(audio_data, content_type='audio/mpeg')

    print(f"[PASO 14 FINALIZADO] Generar el audio y almacenarlo en GCP | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    #Actualizamos el contenido generado:

    print(f"[PASO 15 INICIADO] Actualizar el contenido generado | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

    sql = f"""
                INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE_EJERCICIOS`
                (centro_id, alumno_id, clase, asignatura, unidad, id, nota, comentarios_alumno, comentarios_profesor)
                VALUES (@centro_id, @alumno_id, @clase, @asignatura, @unidad, @id, @nota, @comentarios_alumno, @comentarios_profesor)"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("alumno_id", "STRING", id_alumno),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", unidad),
            bigquery.ScalarQueryParameter("id", "STRING", str(len(ejercicios_previos)+1)),
            bigquery.ScalarQueryParameter("nota", "STRING", ""),
            bigquery.ScalarQueryParameter("comentarios_alumno", "STRING", ""),
            bigquery.ScalarQueryParameter("comentarios_profesor", "STRING", ""),
        ]
    )
    query_job = client_bigquery.query(sql, job_config=job_config)
    query_job.result()

    print(f"[PASO 15 FINALIZADO] Actualizar el contenido generado | {id_centro} {id_alumno} {clase} {asignatura} {unidad}", flush=True)

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
        "service": "Ejercicio Worker",
        "status": "running",
        "version": "1.0",
        "description": "Worker para procesar mensajes de PubSub"
    }

@app.get("/health")
def health():
    """Health check para Cloud Run"""
    return {"status": "healthy", "service": "ejercicio-worker"}

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
        action = message_json.get("action", "generar_ejercicio")
        
        if action == "generar_ejercicio":
            # Obtener parámetros
            id_centro = message_json.get("centro_id")
            if not id_centro:
                raise HTTPException(status_code=400, detail="Missing centro_id")
            id_alumno = message_json.get("alumno_id")
            if not id_alumno:
                raise HTTPException(status_code=400, detail="Missing alumno_id")
            clase = message_json.get("clase")
            if not clase:
                raise HTTPException(status_code=400, detail="Missing clase")
            asignatura = message_json.get("asignatura")
            if not asignatura:
                raise HTTPException(status_code=400, detail="Missing asignatura")
            unidad = message_json.get("unidad")
            if not unidad:
                raise HTTPException(status_code=400, detail="Missing unidad")
            
            # Generar job_id único para esta tarea
            parameters = {
                "centro_id": id_centro,
                "alumno_id":id_alumno,
                "clase": clase,
                "asignatura": asignatura,
                "unidad": unidad
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
                generar_ejercicio(
                    id_centro, 
                    id_alumno,
                    clase, 
                    asignatura,
                    unidad
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
