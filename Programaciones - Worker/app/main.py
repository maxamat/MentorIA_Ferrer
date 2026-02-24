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
from pathlib import Path
import time as time_sleep
from datetime import datetime, time, timezone
from google import genai


#Se inicializan las variables de entorno:
PROJECT_ID = os.getenv("PROJECT_ID", "")
DATASET_ID = os.getenv("DATASET_ID", "")
REGION = os.getenv("REGION", "")
GCS_BUCKET_CURRICULUMS = os.getenv("GCS_BUCKET_CURRICULUMS", "")
GCS_BUCKET_CONTENIDO = os.getenv("GCS_BUCKET_CONTENIDO", "")
GOOGLE_CLOUD_GEMINI_API_KEY=os.getenv("GOOGLE_CLOUD_GEMINI_API_KEY", "")

#Se establecen algunas variables de configuración adicionales:
NO_WORDS_DESC=400
VERTEX_AI_RETIRES=10
VERTEX_AI_SECONDS_SLEEP=60
TIMEOUT_HOURS_OVERLAP_FUNCTIONS = 3

app = FastAPI(title="Programaciones Worker - PubSub Receiver", version="1.0")

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

def generar_programacion(id_centro: str, clase: str, asignatura: str, num_unidades: int, curriculums: list, consideraciones_adicionales: str = ""):
    
    #Lo primero que se hace es eliminar las programaciones preexistentes:  
    print(f"[PASO 1 INICIADO] Eliminando programaciones preexistentes | {id_centro} {clase} {asignatura}", flush=True)
  
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES` 
              WHERE centro_id = @centro_id 
              AND clase = @clase 
              AND asignatura = @asignatura"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    job.result()

    print(f"[PASO 1 FINALIZADO] Eliminando programaciones preexistentes | {id_centro} {clase} {asignatura}", flush=True)
  

    #Y también las unidades:
    print(f"[PASO 2 INICIADO] Eliminando unidades preexistentes | {id_centro} {clase} {asignatura}", flush=True)
  
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES` 
              WHERE centro_id = @centro_id 
              AND clase = @clase 
              AND asignatura = @asignatura"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    job.result()

    print(f"[PASO 2 FINALIZADO] Eliminando unidades preexistentes | {id_centro} {clase} {asignatura}", flush=True)
    
    #Y también las secciones:
    print(f"[PASO 3 INICIADO] Eliminando secciones preexistentes | {id_centro} {clase} {asignatura}", flush=True)
  
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES_SECCIONES` 
              WHERE centro_id = @centro_id 
              AND clase = @clase 
              AND asignatura = @asignatura"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    job.result()
    
    print(f"[PASO 3 FINALIZADO] Eliminando secciones preexistentes | {id_centro} {clase} {asignatura}", flush=True)

    #Y también del contenido disponible:
    print(f"[PASO 4 INICIADO] Eliminando contenido disponible preexistente | {id_centro} {clase} {asignatura}", flush=True)
  
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE` 
              WHERE centro_id = @centro_id 
              AND clase = @clase 
              AND asignatura = @asignatura"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    job.result()

    print(f"[PASO 4 FINALIZADO] Eliminando contenido disponible preexistente | {id_centro} {clase} {asignatura}", flush=True)


    # Limpiar archivos del bucket de contenidos
    print(f"[PASO 5 INICIADO] Eliminando los contenidos del bucket | {id_centro} {clase} {asignatura}", flush=True)
    
    bucket = client_storage.bucket(GCS_BUCKET_CONTENIDO)
    prefix = f"{id_centro}/{clase}/{asignatura}/"
    blobs = bucket.list_blobs(prefix=prefix)
    
    for blob in blobs:
        blob.delete()
    
    print(f"[PASO 5 FINALIZADO] Eliminando los contenidos del bucket | {id_centro} {clase} {asignatura}", flush=True)
    

    #Se inserta el nuevo registro en la tabla de programaciones:
    print(f"[PASO 6 INICIADO] Insertando nuevo registro en la tabla de programaciones | {id_centro} {clase} {asignatura}", flush=True)

    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES` 
                      (centro_id, clase, asignatura, unidades, curriculums, consideraciones_adicionales, status) 
                      VALUES (@centro_id, @clase, @asignatura, @unidades, @curriculums, @consideraciones_adicionales, @status)"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
            bigquery.ScalarQueryParameter("unidades", "INT64", num_unidades),
            bigquery.ScalarQueryParameter("curriculums", "STRING", ', '.join(curriculums) if curriculums else ''),
            bigquery.ScalarQueryParameter("consideraciones_adicionales", "STRING", consideraciones_adicionales),
            bigquery.ScalarQueryParameter("status", "BOOL", False),
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    job.result()
    
    print(f"[PASO 6 FINALIZADO] Insertando nuevo registro en la tabla de programaciones | {id_centro} {clase} {asignatura}", flush=True)

    #Y se genera, para cada unidad, el contenido de las diferentes unidades:
    print(f"[PASO 7 INICIADO] Generando contenido de las unidades | {id_centro} {clase} {asignatura}", flush=True)

    model = "gemini-2.5-pro"
    
    parts=[]
    parts.append(genai.types.Part.from_text(text=f"Eres un experto en diseño curricular y planificación de contenido educativo para alumnos de {clase}."))
    parts.append(genai.types.Part.from_text(text=f"Tu tarea es diseñar {num_unidades} unidades formativas para la asignatura de {asignatura}, adaptadas específicamente al nivel de {clase}."))
    if len(curriculums) == 1:
        parts.append(genai.types.Part.from_text(text="A continuación se adjunta el siguiente documento formativo que debes tomar como referencia para elaborar documento."))
    else:
        parts.append(genai.types.Part.from_text(text="A continuación se adjuntan los siguientes documentos formativos que debes tomar como referencia para elaborar documento."))
    for idx, curriculum in enumerate(curriculums, start=1):
        metaprompt_curriculum=None
        document=None
        descripcion_curriculum=None

        sql = f"""SELECT descripcion, metaprompt FROM `{PROJECT_ID}.{DATASET_ID}.T_CURRICULUMS` 
              WHERE centro_id = @centro_id 
              AND nombre = @curriculum"""
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
                bigquery.ScalarQueryParameter("curriculum", "STRING", curriculum),
            ]
        )
        job = client_bigquery.query(sql, job_config=job_config)
        curr=job.result()
        for row in curr:
            descripcion_curriculum = row.descripcion
            metaprompt_curriculum = row.metaprompt
            break
        
        # Leer el PDF del bucket de GCS
        bucket = client_storage.bucket(GCS_BUCKET_CURRICULUMS)
        blob_path = f"{id_centro}/{curriculum}"
        blob = bucket.blob(blob_path)
        pdf_bytes = blob.download_as_bytes()
        pdf_b64 = base64.b64encode(pdf_bytes).decode('utf-8')
        document=genai.types.Part.from_bytes(data=base64.b64decode(pdf_b64),mime_type="application/pdf")

        parts.append(genai.types.Part.from_text(text=f"\t- Documento Nº{idx}: {curriculum}"))
        if descripcion_curriculum is not None:
            parts.append(genai.types.Part.from_text(text=f"\t\t- Descripción Documento {descripcion_curriculum}"))
        if metaprompt_curriculum is not None:
            parts.append(genai.types.Part.from_text(text=f"\t\t- Anotación Documento {metaprompt_curriculum}"))
        parts.append(genai.types.Part.from_text(text=f"\t- Contenido:"))
        parts.append(document)

    if consideraciones_adicionales != "":
        parts.append(genai.types.Part.from_text(text="Importante:"))
        parts.append(genai.types.Part.from_text(text=f"Ten en cuenta las siguientes consideraciones adicionales para la creación de las unidades: {consideraciones_adicionales}"))
    parts.append(genai.types.Part.from_text(text="Instrucciones:"))
    if len(curriculums) == 1:
        parts.append(genai.types.Part.from_text(text=f"1. Analiza el contenido del documento."))
    else:
        parts.append(genai.types.Part.from_text(text=f"1. Analiza el contenido de los documentos."))
    parts.append(genai.types.Part.from_text(text=f"2. Genera EXACTAMENTE {num_unidades} unidades formativas progresivas y coherentes."))
    parts.append(genai.types.Part.from_text(text="3. Para cada unidad, proporciona:"))
    parts.append(genai.types.Part.from_text(text="\t- Un título claro y descriptivo. Sin incluir el número de la unidad, solo el título."))
    parts.append(genai.types.Part.from_text(text=f"\t- Un contenido descriptivo detallado que explique QUÉ se va a aprender en esa unidad (mínimo {NO_WORDS_DESC} palabras)"))
    parts.append(genai.types.Part.from_text(text=f"4. Asegúrate de que el contenido sea apropiado para el nivel de {clase} y esté redactado en castellano."))
    parts.append(genai.types.Part.from_text(text="5. Las unidades deben tener una progresión lógica, de conceptos más básicos a más avanzados."))
    if len(curriculums) == 1:
        parts.append(genai.types.Part.from_text(text="6. Si el documento contiene información de varios cursos, SOLO utiliza el contenido relevante para el curso especificado."))
    else:
        parts.append(genai.types.Part.from_text(text="6. Si los documentos contienen información de varios cursos, SOLO utiliza el contenido relevante para el curso especificado."))
    if consideraciones_adicionales != "":
        parts.append(genai.types.Part.from_text(text=f"7. Ten en cuenta las consideraciones adicionales mencionadas anteriormente a la hora de adaptar el contenido de las unidades."))


    json_properties={}
    json_required=[]
    for unidad in range(1, num_unidades + 1):
        json_properties[f"titulo_{unidad}"] = {"type": "STRING", "description": f"Título claro y descriptivo de la unidad formativa {unidad}"}
        json_properties[f"contenido_{unidad}"] = {"type": "STRING", "description": f"Descripción detallada del contenido de la unidad {unidad}: qué conceptos, temas y habilidades se trabajarán. Mínimo {NO_WORDS_DESC} palabras."}
        json_required.append(f"titulo_{unidad}")
        json_required.append(f"contenido_{unidad}")

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
        
    resultado_unidades = response.candidates[0].content.parts[0].text
    resultado_unidades = json.loads(resultado_unidades)

    print(f"[PASO 7 FINALIZADO] Generando contenido de las unidades | {id_centro} {clase} {asignatura}", flush=True)

    #Se almacena en la base de datos el contenido generado para cada unidad:
    print(f"[PASO 8 INICIADO] Almacenando contenido de las unidades | {id_centro} {clase} {asignatura}", flush=True)

    for unidad in range(1, num_unidades + 1):

        print(f"[PASO 8 PROCESANDO] Step {unidad}/{num_unidades} | {id_centro} {clase} {asignatura}", flush=True)

        titulo_dummy=resultado_unidades[f"titulo_{unidad}"]
        contenido_dummy=resultado_unidades[f"contenido_{unidad}"]
        sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES` 
                      (centro_id, clase, asignatura, unidad, titulo, contenido, status, secciones, consideraciones_adicionales) 
                      VALUES (@centro_id, @clase, @asignatura, @unidad, @titulo, @contenido, @status, @secciones, @consideraciones_adicionales)"""
            
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
                bigquery.ScalarQueryParameter("clase", "STRING", clase),
                bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
                bigquery.ScalarQueryParameter("unidad", "INT64", unidad),
                bigquery.ScalarQueryParameter("titulo", "STRING", titulo_dummy),
                bigquery.ScalarQueryParameter("contenido", "STRING", contenido_dummy),
                bigquery.ScalarQueryParameter("status", "BOOL", False),
                bigquery.ScalarQueryParameter("secciones", "STRING", "0"),
                bigquery.ScalarQueryParameter("consideraciones_adicionales", "STRING", "")
            ]
        )
            
        job = client_bigquery.query(sql, job_config=job_config)
        job.result()

    print(f"[PASO 8 FINALIZADO] Almacenando contenido de las unidades | {id_centro} {clase} {asignatura}", flush=True)


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
        "service": "Programaciones Worker",
        "status": "running",
        "version": "1.0",
        "description": "Worker para procesar mensajes de PubSub"
    }

@app.get("/health")
def health():
    """Health check para Cloud Run"""
    return {"status": "healthy", "service": "programaciones-worker"}

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
        
        action = message_json.get("action", "generar_programacion")
        
        if action == "generar_programacion":
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
            num_unidades = message_json.get("num_unidades", 10)
            curriculums = message_json.get("curriculums", [])
            consideraciones_adicionales = message_json.get("consideraciones_adicionales", "")
            
            # Generar job_id único para esta tarea
            parameters = {
                "centro_id": id_centro,
                "clase": clase,
                "asignatura": asignatura,
                "num_unidades": num_unidades,
                "curriculums": curriculums,
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
                generar_programacion(
                    id_centro, 
                    clase, 
                    asignatura, 
                    num_unidades, 
                    curriculums, 
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
