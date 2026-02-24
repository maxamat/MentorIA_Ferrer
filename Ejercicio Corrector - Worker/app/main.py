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
GCS_BUCKET_EJERCICIO = os.getenv("GCS_BUCKET_EJERCICIO", "")
GCS_BUCKET_EJERCICIO_TMP = os.getenv("GCS_BUCKET_EJERCICIO_TMP", "")

#Se establecen algunas variables de configuración adicionales:

VERTEX_AI_RETIRES=10
VERTEX_AI_SECONDS_SLEEP=60
TIMEOUT_HOURS_OVERLAP_FUNCTIONS = 3

WORDS_COMENTARIO_ALUMNO = 75
WORDS_COMENTARIO_PROFESOR = 150

app = FastAPI(title="Ejercicio Corrector Worker - PubSub Receiver", version="1.0")

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

def corregir_ejercicio(id_centro: str, id_alumno: str, clase: str, asignatura: str, unidad: int, id_ejercicio: str, imagen_gcs_path: str):
    
    #Leemos los documentos en los que se basará el ejercicio:
    print(f"[PASO 1 INICIADO] Leemos el documento pdf del ejercicio | {id_centro} {id_alumno} {clase} {asignatura} {unidad} {id_ejercicio}", flush=True)

    blob_name=f"{id_centro}/{clase}/{asignatura}/{unidad}/{id_alumno}/{id_ejercicio}.pdf"
    document =genai.types.Part.from_uri(
        file_uri=f"gs://{GCS_BUCKET_EJERCICIO}/{blob_name}",
        mime_type="application/pdf",
    )
    
    print(f"[PASO 1 FINALIZADO] Leemos el documento pdf del ejercicio | {id_centro} {id_alumno} {clase} {asignatura} {unidad} {id_ejercicio}", flush=True)

    # Leer imagen desde GCS
    print(f"[PASO 2 INICIADO] Leer imagen desde GCS: {imagen_gcs_path}", flush=True)
    bucket = storage_client.bucket(GCS_BUCKET_EJERCICIO_TMP)
    blob = bucket.blob(imagen_gcs_path)
    imagen_bytes = blob.download_as_bytes()
    print(f"[PASO 2 FINALIZADO] Imagen leída desde GCS", flush=True)

    #Tras esto realizamos la evaluación:
    print(f"[PASO 3 INICIADO] Generando el ejercicio | {id_centro} {id_alumno} {clase} {asignatura} {unidad} {id_ejercicio}", flush=True)

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
        response_schema = {"type":"OBJECT","properties":{"nota":{"type":"INTEGER","description":"Nota obtenida por el alumno en el ejercicio."},"comentarios_alumno":{"type":"STRING","description":"Comentarios que debe recibir el alumno sobre su desempeño en el ejercicio de manera que le ayuden a mejorar. Debe tener una extensión aproximada de {WORDS_COMENTARIO_ALUMNO} palabras."},"comentarios_profesor":{"type":"STRING","description":"Comentarios que debe recibir el profesor del alumno para indicarle en qué cosas se ha equivocado el alumno sobre la resolución del ejercicio. Debe tener una extensión aproximada de {WORDS_COMENTARIO_PROFESOR} palabras."}},"required":["nota","comentarios_alumno","comentarios_profesor"]},
    )

    parts=[]
    parts.append(genai.types.Part.from_text(text=f"Eres un profesor auxiliar de {asignatura}."))
    parts.append(genai.types.Part.from_text(text="Estás ayudando al profesor de la asignatura a evaluar a sus alumnos."))
    parts.append(genai.types.Part.from_text(text="Un alumno, al que le habías puesto el siguiente ejercicio:"))
    parts.append(document)
    parts.append(genai.types.Part.from_text(text="Te adjunta su respuesta:"))
    parts.append(genai.types.Part.from_bytes(data=imagen_bytes,mime_type="image/png"))
    parts.append(genai.types.Part.from_text(text="Tu tarea:"))
    parts.append(genai.types.Part.from_text(text="\t 1) Evalua la nota que se merecería un alumno en base a la respuesta proporcionada."))
    parts.append(genai.types.Part.from_text(text="\t 2) Si el ejercicio contiene erratas genera algún comentario de mejora al alumno sin indicarle cual es la respuesta correcta."))
    parts.append(genai.types.Part.from_text(text="\t 3) Si el ejercicio contiene erratas genera comentario para el profesor de la asignatura de manera que pueda ver donde comete más errores el alumno."))
    parts.append(genai.types.Part.from_text(text="Importante:"))
    parts.append(genai.types.Part.from_text(text="\t - No corrijas ningun ejercicio que no esté manuscrito. Si alguien te envía una resolución y no está manuscrita asignale una nota de 0 e indícale al alumno que debe resolver al ejercicio con su propia letra."))
    parts.append(genai.types.Part.from_text(text="\t - Si detectas algún error en la corrección debes darles pistas que le ayuden a dar con la solución correcta pero no debes decirle la respuesta correcta, pues debe ser él quien de con esta."))
    parts.append(genai.types.Part.from_text(text=f"\t - En caso de no haber resuelto correctamente el ejercicio el alumno, el comentario hacia el alumno debe tener una extensión aproximada de {WORDS_COMENTARIO_ALUMNO} palabras, mientras que el del profesor debe tener aproxiamdamente {WORDS_COMENTARIO_PROFESOR} palabras."))
    parts.append(genai.types.Part.from_text(text=f"\t - Debes usar ** para encapsular aquellos fragmentos en los comentarios al profesor como al alumno para enfatizar lo realmente importante. Por ejemplo, si quieres enfatizar que el alumno no ha entendido un concepto concreto, deberías escribir algo como: 'El alumno no ha entendido el concepto de **X**'."))
    parts.append(genai.types.Part.from_text(text=f"\t - El comentario para el alumno tiene que ser motivador y enriquecedor."))
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
    nota = str(output.get("nota", ""))
    comentarios_alumno = output.get("comentarios_alumno", "")
    comentarios_profesor = output.get("comentarios_profesor", "")

    print(f"[PASO 3 FINALIZADO] Generando el ejercicio  | {id_centro} {id_alumno} {clase} {asignatura} {unidad} {id_ejercicio}", flush=True)

    #Actualizamos el contenido generado:

    print(f"[PASO 4 INICIADO] Actualizar el contenido generado | {id_centro} {id_alumno} {clase} {asignatura} {unidad} {id_ejercicio}", flush=True)

    sql = f"""
                UPDATE `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE_EJERCICIOS`
                SET 
                    nota = @nota,
                    comentarios_alumno = @comentarios_alumno,
                    comentarios_profesor = @comentarios_profesor
                WHERE centro_id = @centro_id
                AND alumno_id = @alumno_id
                AND clase = @clase
                AND asignatura = @asignatura
                AND unidad = @unidad
                AND id = @id
                """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("alumno_id", "STRING", id_alumno),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", unidad),
            bigquery.ScalarQueryParameter("id", "STRING", id_ejercicio),
            bigquery.ScalarQueryParameter("nota", "STRING", nota),
            bigquery.ScalarQueryParameter("comentarios_alumno", "STRING", comentarios_alumno),
            bigquery.ScalarQueryParameter("comentarios_profesor", "STRING", comentarios_profesor),
        ]
    )
    query_job = client_bigquery.query(sql, job_config=job_config)
    query_job.result()

    print(f"[PASO 4 FINALIZADO] Actualizar el contenido generado | {id_centro} {id_alumno} {clase} {asignatura} {unidad} {id_ejercicio}", flush=True)

    #Registramos la interacción en T_ACCION_ALUMNO_EJERCICIO:

    print(f"[PASO 5 INICIADO] Registrar interacción | {id_centro} {id_alumno} {clase} {asignatura} {unidad} {id_ejercicio}", flush=True)

    sql = f"""
                INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ACCION_ALUMNO_EJERCICIO`
                (centro_id, clase, asignatura, unidad, id, alumno_id, timestamp, nota, comentarios_alumno, comentarios_profesor)
                VALUES (@centro_id, @clase, @asignatura, @unidad, @id, @alumno_id, CURRENT_TIMESTAMP(), @nota, @comentarios_alumno, @comentarios_profesor)
                """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("alumno_id", "STRING", id_alumno),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", unidad),
            bigquery.ScalarQueryParameter("id", "STRING", id_ejercicio),
            bigquery.ScalarQueryParameter("nota", "STRING", nota),
            bigquery.ScalarQueryParameter("comentarios_alumno", "STRING", comentarios_alumno),
            bigquery.ScalarQueryParameter("comentarios_profesor", "STRING", comentarios_profesor),
        ]
    )
    query_job = client_bigquery.query(sql, job_config=job_config)
    query_job.result()

    print(f"[PASO 5 FINALIZADO] Registrar interacción | {id_centro} {id_alumno} {clase} {asignatura} {unidad} {id_ejercicio}", flush=True)



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
        "service": "Ejercicio Corrector Worker",
        "status": "running",
        "version": "1.0",
        "description": "Worker para procesar mensajes de PubSub"
    }

@app.get("/health")
def health():
    """Health check para Cloud Run"""
    return {"status": "healthy", "service": "ejercicio-corrector-worker"}

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
        action = message_json.get("action", "corregir_ejercicio")
        
        if action == "corregir_ejercicio":
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
            id_ejercicio = message_json.get("id_ejercicio")
            if not id_ejercicio:
                raise HTTPException(status_code=400, detail="Missing id_ejercicio")
            imagen_gcs_path = message_json.get("imagen_gcs_path")
            if not imagen_gcs_path:
                raise HTTPException(status_code=400, detail="Missing imagen_gcs_path")
            
            # Generar job_id único para esta tarea
            parameters = {
                "centro_id": id_centro,
                "alumno_id":id_alumno,
                "clase": clase,
                "asignatura": asignatura,
                "unidad": unidad,
                "id_ejercicio": id_ejercicio,
                "imagen_gcs_path": imagen_gcs_path
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
                corregir_ejercicio(
                    id_centro, 
                    id_alumno,
                    clase, 
                    asignatura,
                    unidad,
                    id_ejercicio,
                    imagen_gcs_path
                )
                
                # Eliminar imagen temporal de GCS
                try:
                    bucket = storage_client.bucket(GCS_BUCKET_EJERCICIO)
                    blob = bucket.blob(imagen_gcs_path)
                    blob.delete()
                    print(f"Imagen temporal eliminada de GCS: {imagen_gcs_path}", flush=True)
                except Exception as del_err:
                    print(f"Error al eliminar imagen temporal: {del_err}", flush=True)
                
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
