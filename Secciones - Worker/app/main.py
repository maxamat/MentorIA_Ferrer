import os
import base64
import json
import hashlib
from typing import Optional
import pandas as pd

from fastapi import FastAPI, Header, HTTPException, Request, types
from pydantic import BaseModel, Field

from google.cloud import bigquery, storage
from google.oauth2 import service_account
import time as time_sleep
from pathlib import Path
from datetime import datetime, time, timezone
from google import genai


#Se inicializan las variables de entorno:
PROJECT_ID = os.getenv("PROJECT_ID", "")
DATASET_ID = os.getenv("DATASET_ID", "")
REGION = os.getenv("REGION", "")
GCS_BUCKET_CONTENIDO = os.getenv("GCS_BUCKET_CONTENIDO", "")
GOOGLE_CLOUD_GEMINI_API_KEY=os.getenv("GOOGLE_CLOUD_GEMINI_API_KEY", "")

#Se establecen algunas variables de configuración adicionales:
NO_WORDS_DESC=400
VERTEX_AI_RETIRES=10
VERTEX_AI_SECONDS_SLEEP=60
TIMEOUT_HOURS_OVERLAP_FUNCTIONS = 3

app = FastAPI(title="Secciones Worker - PubSub Receiver", version="1.0")

#Se obtiene el directorio de las credenciales de Google Cloud:
SCRIPT_DIR = Path(__file__).parent
GOOGLE_CREDENTIALS = "credentials/credentials.json"
GOOGLE_CREDENTIALS_PATH = SCRIPT_DIR / GOOGLE_CREDENTIALS

#Se inicializa el cliente de BigQuery:
credentials = service_account.Credentials.from_service_account_file(str(GOOGLE_CREDENTIALS_PATH))
client_bigquery = bigquery.Client(project=PROJECT_ID, credentials=credentials)

#Se inicializa el cliente de Google Cloud Storage:
client_storage = storage.Client(project=PROJECT_ID, credentials=credentials)

#Se inicializa el cliente de Gemini:
client_genai = genai.Client(
    vertexai=True,
    api_key=GOOGLE_CLOUD_GEMINI_API_KEY
)

# ---------- Schemas ----------

class PubSubMessage(BaseModel):
    """Estructura del mensaje de PubSub"""
    message: dict
    subscription: Optional[str] = None

# ---------- Helpers ----------

def generar_secciones(id_centro: str, clase: str, asignatura: str, unidad: int, num_secciones: int, consideraciones_adicionales: str = ""):
    
    #Lo primero que se hace es eliminar las secciones preexistentes:
    print(f"[PASO 1 INICIADO] Borrando secciones preexistentes | {id_centro} {clase} {asignatura} {unidad}", flush=True)
  
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES_SECCIONES` 
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
    job.result()

    print(f"[PASO 1 FINALIZADO] Borrando secciones preexistentes | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Tras esto se elimina el contenido generado previamente:
    print(f"[PASO 2 INICIADO] Borrando contenido generado previamente | {id_centro} {clase} {asignatura} {unidad}", flush=True)
  

    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE` 
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
    job.result()

    print(f"[PASO 2 FINALIZADO] Borrando contenido generado previamente | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Y también el contenido de BigQuery:
    print(f"[PASO 3 INICIADO] Borrando contenido en BigQuery | {id_centro} {clase} {asignatura} {unidad}", flush=True)
  

    bucket = client_storage.bucket(GCS_BUCKET_CONTENIDO)
    prefix = f"{id_centro}/{clase}/{asignatura}/{unidad}"
    blobs = bucket.list_blobs(prefix=prefix)
    
    for blob in blobs:
        blob.delete()

    print(f"[PASO 3 FINALIZADO] Borrando contenido en BigQuery | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Se actualiza el número de secciones y las consideraciones adicionales:
    print(f"[PASO 4 INICIADO] Actualizando número de secciones y consideraciones adicionales | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    sql = f"""
    UPDATE `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES`
    SET secciones = @secciones,
        consideraciones_adicionales = @consideraciones_adicionales
    WHERE centro_id = @centro_id
    AND clase = @clase
    AND asignatura = @asignatura
    AND unidad = @unidad
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", unidad),
            bigquery.ScalarQueryParameter("secciones", "STRING", str(num_secciones)),
            bigquery.ScalarQueryParameter("consideraciones_adicionales", "STRING", consideraciones_adicionales)
        ]
    )
    query_job = client_bigquery.query(sql, job_config=job_config)
    query_job.result()

    print(f"[PASO 4 FINALIZADO] Actualizando número de secciones y consideraciones adicionales | {id_centro} {clase} {asignatura} {unidad}", flush=True)


    #Se genera el contenido para cada sección:
    print(f"[PASO 5 INICIADO] Generando contenido para cada sección | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    model = "gemini-2.5-pro"

    parts=[]
    parts.append(genai.types.Part.from_text(text=f"Eres un experto en diseño de contenido educativo para alumnos de {clase}."))
    parts.append(genai.types.Part.from_text(text=f"Tu tarea es diseñar {num_secciones} secciones formativas para la asignatura de {asignatura}, adaptadas específicamente al nivel de {clase}"))

    sql = f"""SELECT titulo, contenido FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES` 
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
    curr=job.result()
    for row in curr:
        titulo = row.titulo
        contenido = row.contenido
        break

    parts.append(genai.types.Part.from_text(text=f"Más concretamente el título de la unidad sobre la que crearás las secciones se titula {titulo} y su contenido es el siguiente: {contenido}."))
    
    if consideraciones_adicionales != "":
        parts.append(genai.types.Part.from_text(text="Importante:"))
        parts.append(genai.types.Part.from_text(text=f"Ten en cuenta las siguientes consideraciones adicionales para la creación de las secciones: {consideraciones_adicionales}"))
    
    parts.append(genai.types.Part.from_text(text="Instrucciones:"))
    parts.append(genai.types.Part.from_text(text=f"1. Analiza el título y el contenido de la unidad formativa."))
    parts.append(genai.types.Part.from_text(text=f"2. Genera EXACTAMENTE {num_secciones} secciones formativas progresivas y coherentes."))
    parts.append(genai.types.Part.from_text(text="3. Para cada sección, proporciona:"))
    parts.append(genai.types.Part.from_text(text="\t- Un título claro y descriptivo. Sin incluir el número de la sección, solo el título."))
    parts.append(genai.types.Part.from_text(text=f"\t- Un contenido descriptivo detallado que explique QUÉ se va a aprender en esa sección (mínimo {NO_WORDS_DESC} palabras)"))
    parts.append(genai.types.Part.from_text(text=f"4. Asegúrate de que el contenido sea apropiado para el nivel de {clase} y esté redactado en castellano."))
    parts.append(genai.types.Part.from_text(text="5. Las secciones deben tener una progresión lógica, de conceptos más básicos a más avanzados."))
    if consideraciones_adicionales != "":
        parts.append(genai.types.Part.from_text(text=f"6. Ten en cuenta las consideraciones adicionales mencionadas anteriormente a la hora de adaptar el contenido de las secciones."))

    json_properties={}
    json_required=[]
    for seccion in range(1, num_secciones + 1):
        json_properties[f"titulo_{seccion}"] = {"type": "STRING", "description": f"Título claro y descriptivo de la sección formativa {seccion}"}
        json_properties[f"contenido_{seccion}"] = {"type": "STRING", "description": f"Descripción detallada del contenido de la sección {seccion}: qué conceptos, temas y habilidades se trabajarán. Mínimo {NO_WORDS_DESC} palabras."}
        json_required.append(f"titulo_{seccion}")
        json_required.append(f"contenido_{seccion}")

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
        response_schema = {
            "type": "OBJECT",
            "properties": json_properties,
            "required": json_required
        },
    )

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

    resultado_secciones = response.candidates[0].content.parts[0].text
    resultado_secciones = json.loads(resultado_secciones)

    print(f"[PASO 5 INICIADO] Generando contenido para cada sección | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Guardado de las secciones generadas en BigQuery:
    print(f"[PASO 6 INICIADO] Guardando contenido generado en BigQuery | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    for seccion in range(1, num_secciones + 1):

        print(f"[PASO 6 PROCESANDO] Step {seccion}/{num_secciones} | {id_centro} {clase} {asignatura} {unidad}", flush=True)

        titulo_dummy=resultado_secciones[f"titulo_{seccion}"]
        contenido_dummy=resultado_secciones[f"contenido_{seccion}"]
        sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES_SECCIONES` 
                      (centro_id, clase, asignatura, unidad, seccion, titulo, contenido, status) 
                      VALUES (@centro_id, @clase, @asignatura, @unidad, @seccion, @titulo, @contenido, @status)"""
            
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
                bigquery.ScalarQueryParameter("clase", "STRING", clase),
                bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
                bigquery.ScalarQueryParameter("unidad", "INT64", unidad),
                bigquery.ScalarQueryParameter("seccion", "STRING", str(seccion)),
                bigquery.ScalarQueryParameter("titulo", "STRING", titulo_dummy),
                bigquery.ScalarQueryParameter("contenido", "STRING", contenido_dummy),
                bigquery.ScalarQueryParameter("status", "BOOL", False)
            ]
        )
        job = client_bigquery.query(sql, job_config=job_config)
        job.result()

    print(f"[PASO 6 FINALIZADO] Contenido generado guardado en BigQuery | {id_centro} {clase} {asignatura} {unidad}", flush=True)


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
        "service": "Secciones Worker",
        "status": "running",
        "version": "1.0",
        "description": "Worker para procesar mensajes de PubSub"
    }

@app.get("/health")
def health():
    """Health check para Cloud Run"""
    return {"status": "healthy", "service": "secciones-worker"}

@app.post("/")
async def task_handler(request: Request):
    """
    Endpoint principal que recibe tareas de Cloud Tasks.
    Cloud Tasks envía JSON directo.
    Implementa idempotencia mediante tracking en OP_WORKERS_EXECUTIONS.
    """
    try:
        # Obtener el cuerpo del mensaje
        message_json = await request.json()
        print(f"Mensaje recibido: {message_json}", flush=True)
        
        action = message_json.get("action", "generar_secciones")
        
        if action == "generar_secciones":
            # Obtener parámetros (sin profesor_id)
            id_centro = message_json.get("centro_id")
            if not id_centro:
                raise HTTPException(status_code=400, detail="Missing centro_id")
            clase = message_json.get("clase")
            if not clase:
                raise HTTPException(status_code=400, detail="Missing clase")
            asignatura = message_json.get("asignatura")
            if not asignatura:
                raise HTTPException(status_code=400, detail="Missing asignatura")
            unidad = message_json.get("unidad")
            if not unidad:
                raise HTTPException(status_code=400, detail="Missing unidad")
            num_secciones = message_json.get("num_secciones", 10)
            consideraciones_adicionales = message_json.get("consideraciones_adicionales", "")
            
            # Generar job_id único para esta tarea
            parameters = {
                "centro_id": id_centro,
                "clase": clase,
                "asignatura": asignatura,
                "unidad": unidad,
                "num_secciones": num_secciones,
                "consideraciones_adicionales": consideraciones_adicionales
            }
            job_id = generate_job_id(action, parameters)
            
            # Verificar si el job ya existe y su estado
            current_status, updated_at = check_job_status(job_id)
            
            # Definir timeout de 3 horas
            now = datetime.now(timezone.utc)
            
            # Si el job existe, verificar si han pasado más de 3 horas
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
                generar_secciones(
                    id_centro, 
                    clase, 
                    asignatura,
                    unidad, 
                    num_secciones,
                    consideraciones_adicionales
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
