import os
import base64
from typing import Optional
import requests
from datetime import datetime,timedelta

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from google.cloud import bigquery, storage, tasks_v2
from google.oauth2 import service_account
from pathlib import Path
import json
import traceback
from google import genai
import time as time_sleep
import pandas as pd

#Se inicializan las variables de entorno:
PROJECT_ID = os.getenv("PROJECT_ID", "")
DATASET_ID = os.getenv("DATASET_ID", "")
REGION = os.getenv("REGION", "")
GCS_BUCKET_ASIGNATURAS = os.getenv("GCS_BUCKET_ASIGNATURAS", "")
GCS_BUCKET_AVATARES = os.getenv("GCS_BUCKET_AVATARES", "")
GCS_BUCKET_SALIDAS = os.getenv("GCS_BUCKET_SALIDAS", "")
GCS_BUCKET_CURRICULUMS = os.getenv("GCS_BUCKET_CURRICULUMS", "")
GCS_BUCKET_CONTENIDO = os.getenv("GCS_BUCKET_CONTENIDO", "")
GCS_BUCKET_TRABAJO = os.getenv("GCS_BUCKET_TRABAJO", "")
GCS_BUCKET_EJERCICIO = os.getenv("GCS_BUCKET_EJERCICIO", "")
GCS_BUCKET_EJERCICIO_TMP = os.getenv("GCS_BUCKET_EJERCICIO_TMP", "")
GCS_BUCKET_TRABAJO_TMP= os.getenv("GCS_BUCKET_TRABAJO_TMP", "")
GOOGLE_CLOUD_GEMINI_API_KEY=os.getenv("GOOGLE_CLOUD_GEMINI_API_KEY", "")

#Se inicializan otra serie de variables de configuración:
CONTENT_SECONDS_ACCESS = 3600
VERTEX_AI_RETIRES=10
VERTEX_AI_SECONDS_SLEEP=60
MARKED_CONTENT="*****"
MAX_WORDS_CHAT=60

app = FastAPI(title="App API (Database)", version="1.0")

#Se obtiene el directorio de las credenciales de Google Cloud:
SCRIPT_DIR = Path(__file__).parent
GOOGLE_CREDENTIALS = "credentials/credentials.json"
GOOGLE_CREDENTIALS_PATH = SCRIPT_DIR / GOOGLE_CREDENTIALS

#Se inicializa el cliente de BigQuery:
credentials = service_account.Credentials.from_service_account_file(str(GOOGLE_CREDENTIALS_PATH))
client = bigquery.Client(project=PROJECT_ID, credentials=credentials, location=REGION)

# Inicializar cliente de Cloud Storage:
storage_client = storage.Client(project=PROJECT_ID, credentials=credentials)


#Inicializar Cloud Tasks:
tasks_client = tasks_v2.CloudTasksClient(credentials=credentials)

#Se inicializa el cliente de Gemini:
client_genai = genai.Client(
    vertexai=True,
    api_key=GOOGLE_CLOUD_GEMINI_API_KEY
)


# Variable global para tracking de inicialización
_initialized = False

def ensure_database_setup():
    """Inicializa el dataset y tabla si no existen. Se ejecuta bajo demanda."""
    global _initialized
    if _initialized:
        return
    
    try:
        # Crear dataset si no existe
        dataset_ref = bigquery.Dataset(f"{PROJECT_ID}.{DATASET_ID}")
        dataset_ref.location = REGION
        try:
            client.get_dataset(dataset_ref)
        except Exception:
            client.create_dataset(dataset_ref, timeout=30)
        
        # Crear tabla de centros si no existe
        table_name = "T_CENTROS"
        schema = [
            bigquery.SchemaField("id_centro", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de profesores si no existe
        table_name = "T_PROFESORES"
        schema = [
            bigquery.SchemaField("id_profesor", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_centro", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de alumnos si no existe
        table_name = "T_ALUMNOS"
        schema = [
            bigquery.SchemaField("id_alumno", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_centro", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de clases si no existe
        table_name = "T_CLASES"
        schema = [
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_centro", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de asignaturas si no existe
        table_name = "T_ASIGNATURAS"
        schema = [
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("descripcion", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_centro", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de materias si no existe
        table_name = "T_ASIGNATURAS_PROFESORES"
        schema = [
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_profesor", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_centro", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de asignaciones de alumnos a clases si no existe
        table_name = "T_ALUMNO_CLASE"
        schema = [
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_alumno", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_centro", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de experiencias de antiguos alumnos:
        table_name = "T_ANTIGUAS_EXPERIENCIAS"
        schema = [
            bigquery.SchemaField("salida_id", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("experiencia", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de intereses de los alumnos a clases si no existe
        table_name = "T_ALUMNO_INTERES"
        schema = [
            bigquery.SchemaField("texto_tiempo_libre", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("texto_que_te_motiva", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("texto_que_te_ayuda_a_entender", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("texto_que_te_frustra_a_estudiar", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("texto_que_asignaturas_se_te_dan_mejor", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_alumno", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_centro", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("turno_formativo", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("max_tiempo_desplazamiento", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("color_camiseta", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("color_labios", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("color_ojos", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("color_pelo", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("color_piel", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("genero", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("tipo_peinado", "STRING", mode="REQUIRED")
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        table_name = "T_MEJORA_SEMANAL"
        schema = [
            bigquery.SchemaField("alumno_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("recomendacion", "STRING", mode="REQUIRED")
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de salidas profesionales:
        table_name = "T_SALIDAS_PROFESIONALES"
        schema = [
            bigquery.SchemaField("id_salida", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("tipo", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("titulo", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("centro", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("municipio", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("provincia", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("ccaa", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("pais", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("perfiles", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("curriculo", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de recomendaciones alumno-profesor:

        table_name = "T_RECOMENDACIONES_ALUMNO_PROFESOR"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("alumno_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("recomendacion", "STRING", mode="REQUIRED")
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de salidas profesionales:
        table_name = "T_ALUMNOS_SALIDAS"
        schema = [
            bigquery.SchemaField("id_centro", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_alumno", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_salida", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("titulo", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("ranking", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("flag_like", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("municipio", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("provincia", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("curriculo_mecd", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("curriculo_ccaa", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("perfiles_profesionales", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("tipo", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("centro", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        table_name = "T_ANTIGUAS_EXPERIENCIAS_CONVERSACIONES"
        schema = [
            bigquery.SchemaField("role", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("content", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("alumno_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("salida_id", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de salidas profesionales:
        table_name = "T_DIRECCIONES_CENTROS"
        schema = [
            bigquery.SchemaField("id_centro", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("pais", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("ccaa", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("provincia", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("municipio", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de salidas profesionales:
        table_name = "T_PROVINCIAS_CERCANAS"
        schema = [
            bigquery.SchemaField("provincia", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("provincia_cercana", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de salidas profesionales:
        table_name = "T_DIRECCIONES"
        schema = [
            bigquery.SchemaField("pais", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("ccaa", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("provincia", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("municipio", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de salidas profesionales:
        table_name = "T_CURRICULUMS"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("nombre", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("descripcion", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("metaprompt", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("fecha", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de programaciones:
        table_name = "T_PROGRAMACIONES"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unidades", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("curriculums", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("consideraciones_adicionales", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("status", "BOOLEAN", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        
        table_name = "T_PROGRAMACIONES_UNIDADES"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unidad", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("titulo", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("contenido", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("secciones", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("consideraciones_adicionales", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("status", "BOOLEAN", mode="REQUIRED")
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        table_name = "T_PROGRAMACIONES_UNIDADES_SECCIONES"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unidad", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("seccion", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("titulo", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("contenido", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("status", "BOOLEAN", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        table_name = "T_ACCION_ALUMNO_CONTENIDO_FORMATIVO_HTML"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unidad", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("seccion", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("alumno_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        table_name = "T_ACCION_ALUMNO_CONTENIDO_FORMATIVO_AUDIO"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unidad", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("seccion", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("alumno_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        table_name = "T_ACCION_ALUMNO_EJERCICIO"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unidad", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("alumno_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("nota", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("comentarios_alumno", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("comentarios_profesor", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        table_name = "T_ACCION_ALUMNO_TRABAJO"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unidad", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("alumno_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("nota", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("comentarios_alumno", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("comentarios_profesor", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        table_name = "T_CONTENIDO_DISPONIBLE"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unidad", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("seccion", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("tipo", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("flag_creado", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("flag_aprobado", "BOOLEAN", mode="REQUIRED"),
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        table_name = "T_CONTENIDO_DISPONIBLE_EJERCICIOS"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("alumno_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unidad", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("nota", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("comentarios_alumno", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("comentarios_profesor", "STRING", mode="REQUIRED")
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        table_name = "T_CONTENIDO_DISPONIBLE_TRABAJOS"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("alumno_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("clase", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("asignatura", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unidad", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("nota", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("comentarios_alumno", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("comentarios_profesor", "STRING", mode="REQUIRED")
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        table_name = "OP_WORKERS_EXECUTIONS"
        schema = [
            bigquery.SchemaField("job_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("function_name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("parameters", "JSON", mode="REQUIRED"),
            bigquery.SchemaField("status", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="REQUIRED")
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        table_name = "T_CONSENTIMIENTO"
        schema = [
            bigquery.SchemaField("centro_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("user_id", "STRING", mode="REQUIRED")
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)
        
        # Crear vista V_ASIGNATURAS_ALUMNO para listar asignaturas por alumno
        view_name = "V_ASIGNATURAS_ALUMNO"
        view_query = f"""
        SELECT 
            ac.id_alumno,
            ac.id_centro,
            ap.asignatura
        FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_CLASE` ac
        INNER JOIN `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` ap
            ON ac.clase = ap.clase AND ac.id_centro = ap.id_centro
        """
        view = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{view_name}")
        view.view_query = view_query
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{view_name}")
        except Exception:
            client.create_table(view, timeout=30)

        # Crear vista V_SALIDAS_ALUMNOS para listar salidas por alumno
        view_name = "V_SALIDAS_ALUMNOS"
        view_query = f"""
        SELECT 
            ac.id_alumno,
            ac.id_centro,
            sp.titulo,
            sp.centro,
            sp.municipio,
            sp.perfiles,
            sp.curriculo,
            ac.id_salida,
            ac.ranking,
            ac.flag_like,
            sp.tipo
        FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNOS_SALIDAS` as ac
        INNER JOIN `{PROJECT_ID}.{DATASET_ID}.T_SALIDAS_PROFESIONALES` sp
            ON ac.id_salida = sp.id_salida
        """
        view = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{view_name}")
        view.view_query = view_query
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{view_name}")
        except Exception:
            client.create_table(view, timeout=30)

        # Crear vista V_CONTENIDO_DISPONIBLE_ALUMNOS para listar contenido disponible por alumno
        view_name = "V_CONTENIDO_DISPONIBLE_ALUMNOS"
        view_query = f"""
        SELECT DISTINCT
            ac.id_alumno,
            ac.id_centro,
            ap.asignatura,
            ap.clase,
            co.unidad,
            co.seccion
        FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_CLASE` ac
        INNER JOIN `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` ap
            ON ac.clase = ap.clase AND ac.id_centro = ap.id_centro
        INNER JOIN `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE` co
            ON ac.clase = co.clase AND ac.id_centro = co.centro_id AND ap.asignatura=co.asignatura
        WHERE co.flag_aprobado=TRUE AND co.flag_creado=TRUE AND co.tipo = 'Contenido Formativo';
        """
        view = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{view_name}")
        view.view_query = view_query
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{view_name}")
        except Exception:
            client.create_table(view, timeout=30)

        view_name = "V_DASHBOARD_EJERCICIOS_PROFESORES"
        view_query = f"""
                select
        a.centro_id,
        a.clase,
        a.asignatura,
        a.unidad,
        a.alumno_id,
        c.id_profesor as profesor_id,
        b.total_ejercicios,
        a.ejercicios_resueltos,
        a.nota_media
        FROM
        (SELECT centro_id, clase, asignatura, unidad, alumno_id, count(distinct id) as ejercicios_resueltos, avg(CAST(nota AS INT64)) as nota_media FROM `{PROJECT_ID}.{DATASET_ID}.T_ACCION_ALUMNO_EJERCICIO`
        group by centro_id, clase, asignatura, unidad, alumno_id)A
        INNER JOIN
        (select centro_id, clase, asignatura, unidad, alumno_id, count(distinct id) AS total_ejercicios from `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE_EJERCICIOS` group by centro_id, clase, asignatura, unidad, alumno_id) B
        ON A.centro_id=b.centro_id and A.clase=b.clase and A.asignatura=b.asignatura and A.unidad=b.unidad
        and A.alumno_id=b.alumno_id
        INNER JOIN
        (SELECT clase, asignatura, id_centro, id_profesor FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES`) C
        on A.clase=C.clase and A.asignatura=C.asignatura and A.centro_id=C.id_centro;
        """
        view = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{view_name}")
        view.view_query = view_query
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{view_name}")
        except Exception:
            client.create_table(view, timeout=30)


        view_name = "V_DASHBOARD_TRABAJOS_PROFESORES"
        view_query = f"""
                select
        a.centro_id,
        a.clase,
        a.asignatura,
        a.unidad,
        a.alumno_id,
        c.id_profesor as profesor_id,
        b.total_trabajos,
        a.trabajos_resueltos,
        a.nota_media
        FROM
        (SELECT centro_id, clase, asignatura, unidad, alumno_id, count(distinct id) as trabajos_resueltos, avg(CAST(nota AS INT64)) as nota_media FROM `{PROJECT_ID}.{DATASET_ID}.T_ACCION_ALUMNO_TRABAJO`
        group by centro_id, clase, asignatura, unidad, alumno_id)A
        INNER JOIN
        (select centro_id, clase, asignatura, unidad, alumno_id, count(distinct id) AS total_trabajos from `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE_TRABAJOS` group by centro_id, clase, asignatura, unidad, alumno_id) B
        ON A.centro_id=b.centro_id and A.clase=b.clase and A.asignatura=b.asignatura and A.unidad=b.unidad
        and A.alumno_id=b.alumno_id
        INNER JOIN
        (SELECT clase, asignatura, id_centro, id_profesor FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES`) C
        on A.clase=C.clase and A.asignatura=C.asignatura and A.centro_id=C.id_centro;
        """
        view = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{view_name}")
        view.view_query = view_query
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{view_name}")
        except Exception:
            client.create_table(view, timeout=30)
        
        _initialized = True

    except Exception as e:
        print(f"Error durante inicialización de database: {e}")
        raise

    

# Configurar CORS para permitir llamadas desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitir todos los orígenes
    allow_credentials=False,  # Debe ser False cuando allow_origins es "*"
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Schemas ----------
class CentroIn(BaseModel):
    centro_id: Optional[str] = None

class CentroOut(BaseModel):
    centro_id: str
    success: bool

class ProfesorIn(BaseModel):
    centro_id: Optional[str] = None
    profesor_id: Optional[str] = None

class ProfesorClaseIn(BaseModel):
    centro_id: Optional[str] = None
    profesor_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None

class ProfesorOut(BaseModel):
    centro_id: str
    profesor_id: str
    success: bool

class AlumnoIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None

class AlumnoOut(BaseModel):
    centro_id: str
    alumno_id: str
    success: bool

class ClaseIn(BaseModel):
    centro_id: Optional[str] = None
    clase: Optional[str] = None
    clase_antigua: Optional[str] = None

class ClaseOut(BaseModel):
    centro_id: str
    clase: str
    success: bool

class AsignaturaIn(BaseModel):
    centro_id: Optional[str] = None
    asignatura: Optional[str] = None
    imagebase64: Optional[str] = None
    descripcion: Optional[str] = None
    asignatura_antigua: Optional[str] = None

class AsignaturaOut(BaseModel):
    centro_id: str
    asignatura: str
    imagebase64: Optional[str] = None
    success: bool

class AsignaturaProfesorIn(BaseModel):
    centro_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    profesor_id: Optional[str] = None
    clase_antigua: Optional[str] = None
    asignatura_antigua: Optional[str] = None
    profesor_id_antiguo: Optional[str] = None

class AsignaturaProfesorOut(BaseModel):
    centro_id: str
    clase: str
    asignatura: str
    profesor_id: str
    success: bool

class ListarClasesOut(BaseModel):
    centro_id: str
    clases: list[str]
    success: bool

class AsignacionProfesor(BaseModel):
    clase: str
    asignatura: str
    profesor_id: str

class ListarAsignacionesOut(BaseModel):
    centro_id: str
    asignaciones: list[AsignacionProfesor]
    success: bool

class ListarAsignaturasOut(BaseModel):
    centro_id: str
    asignaturas: list[str]
    imagebase64: list[str]
    success: bool

class ListarAsignaturasProfesorOut(BaseModel):
    centro_id: str
    asignaturas: list[str]
    success: bool

class ListarProfesoresOut(BaseModel):
    centro_id: str
    profesores: list[str]
    success: bool

class ListarAlumnosOut(BaseModel):
    centro_id: str
    alumnos: list[str]
    success: bool

class AlumnoClaseIn(BaseModel):
    centro_id: Optional[str] = None
    clase: Optional[str] = None
    alumno_id: Optional[str] = None
    clase_antigua: Optional[str] = None
    alumno_id_antiguo: Optional[str] = None

class AlumnoClaseOut(BaseModel):
    centro_id: str
    clase: str
    alumno_id: str
    success: bool

class AlumnoInteresIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None
    texto_tiempo_libre: Optional[str] = None
    texto_que_te_motiva: Optional[str] = None
    texto_que_te_ayuda_a_entender: Optional[str] = None
    texto_que_te_frustra_a_estudiar: Optional[str] = None
    texto_que_asignaturas_se_te_dan_mejor: Optional[str] = None
    turno_formativo: Optional[str] = None
    max_tiempo_desplazamiento: Optional[int] = None
    color_camiseta: Optional[str] = None
    color_pelo: Optional[str] = None
    color_ojos: Optional[str] = None
    color_piel: Optional[str] = None
    color_labios: Optional[str] = None
    genero: Optional[str] = None
    tipo_peinado: Optional[str] = None

class AlumnoInteresOut(BaseModel):
    centro_id: str
    alumno_id: str
    success: bool

class AsignacionAlumno(BaseModel):
    clase: str
    alumno_id: str

class ListarAsignacionesAlumnosOut(BaseModel):
    centro_id: str
    asignaciones: list[AsignacionAlumno]
    success: bool

class InteresAlumno(BaseModel):
    texto_tiempo_libre: str
    texto_que_te_motiva: str
    texto_que_te_ayuda_a_entender: str
    texto_que_te_frustra_a_estudiar: str
    texto_que_asignaturas_se_te_dan_mejor: str
    turno_formativo: str
    max_tiempo_desplazamiento: int
    color_camiseta: str
    color_pelo: str
    color_ojos: str
    color_piel: str
    color_labios: str
    genero: str
    tipo_peinado: str

class ListarInteresesAlumnosOut(BaseModel):
    centro_id: str
    alumno_id: str
    intereses: list[InteresAlumno]
    success: bool

class AvatarConfigIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None
    color_pelo: Optional[str] = None
    color_ojos: Optional[str] = None
    color_piel: Optional[str] = None
    color_labios: Optional[str] = None
    color_camiseta: Optional[str] = None
    genero: Optional[str] = None
    tipo_peinado: Optional[str] = None

class AvatarConfigOut(BaseModel):
    centro_id: str
    alumno_id: str
    imagebase64: Optional[str] = None
    success: bool

class AvatarConfig(BaseModel):
    color_pelo: str
    color_ojos: str
    color_piel: str
    color_labios: str
    color_camiseta: str
    genero: str
    tipo_peinado: str

class ListarAvatarConfigOut(BaseModel):
    centro_id: str
    alumno_id: str
    avatar: Optional[AvatarConfig]
    imagebase64: Optional[str] = None
    success: bool

class ObtenerAvatarImagenIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None

class AsignaturaValor(BaseModel):
    asignatura: str
    unidad: int
    valor: float

class ObtenerAvatarImagenOut(BaseModel):
    centro_id: str
    alumno_id: str
    recomendacion: str
    imagebase64: Optional[str] = None
    asignaturas_ejercicios: list[AsignaturaValor]
    asignaturas_trabajos: list[AsignaturaValor]
    asignaturas_iconos: dict[str, str]
    success: bool

class AsignaturaAlumno(BaseModel):
    asignatura: str
    imagebase64: str

class SalidaAlumno(BaseModel):
    salida_id: str
    ranking: int
    flag_like: bool
    titulo: str
    centro: str
    localidad: str
    distancia: int
    co2: int
    perfiles: str
    curriculo: str
    tipo: str

class ListarAsignaturasAlumnoIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None

class ListarAsignaturasAlumnoOut(BaseModel):
    centro_id: str
    alumno_id: str
    asignaturas: list[AsignaturaAlumno]
    success: bool

class ComentarioAlumnoItem(BaseModel):
    id: str
    tipo: str  # "ejercicio" o "trabajo"
    timestamp: str
    nota: str
    comentarios_profesor: str
    comentarios_alumno: str

class ListarComentariosAlumnoIn(BaseModel):
    centro_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None
    alumno_id: Optional[str] = None

class ListarComentariosAlumnoOut(BaseModel):
    centro_id: str
    alumno_id: str
    comentarios: list[ComentarioAlumnoItem]
    success: bool


class ObtenerRecomendacionAlumnoIn(BaseModel):
    centro_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    alumno_id: Optional[str] = None

class ObtenerRecomendacionAlumnoOut(BaseModel):
    centro_id: str
    alumno_id: str
    recomendacion: Optional[str] = None
    success: bool


class ListarSalidasAlumnoIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None

class ListarSalidasAlumnoOut(BaseModel):
    centro_id: str
    alumno_id: str
    salidas: list[SalidaAlumno]
    success: bool

class ModificarSalidasAlumnoIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None
    salida_id: Optional[str] = None
    flag_like: Optional[bool] = None

class ModificarSalidasAlumnoOut(BaseModel):
    centro_id: str
    alumno_id: str
    success: bool

class AsignaturaConContenido(BaseModel):
    asignatura: str
    clase: str
    imagebase64: Optional[str] = ""
    descripcion: Optional[str] = ""

class ListarAsignaturasContenidoAlumnoIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None

class ListarAsignaturasContenidoAlumnoOut(BaseModel):
    centro_id: str
    alumno_id: str
    asignaturas: list[AsignaturaConContenido]
    success: bool

class Direcciones(BaseModel):
    pais: str
    ccaa: str
    provincia: str
    municipio: str

class ListarDireccionesCentrosOut(BaseModel):
    centro_id: str
    direcciones: list[Direcciones]
    success: bool

class SuccessOut(BaseModel):
    success: bool

class CentroDireccionesIn(BaseModel):
    centro_id: Optional[str] = None
    pais: Optional[str] = None
    ccaa: Optional[str] = None
    provincia: Optional[str] = None
    municipio: Optional[str] = None

class ListarPaisesOut(BaseModel):
    client_id: str
    paises: list[str]
    success: bool

class ListarCCAAsOut(BaseModel):
    client_id: str
    ccaa: list[str]
    success: bool

class ListarProvinciasOut(BaseModel):
    client_id: str
    provincias: list[str]
    success: bool

class ListarMunicipiosOut(BaseModel):
    client_id: str
    municipios: list[str]
    success: bool

class CentroPaisIn(BaseModel):
    centro_id: Optional[str] = None
    pais: Optional[str] = None

class CentroCCAAIn(BaseModel):
    centro_id: Optional[str] = None
    pais: Optional[str] = None
    ccaa: Optional[str] = None

class CentroProvinciaIn(BaseModel):
    centro_id: Optional[str] = None
    pais: Optional[str] = None
    ccaa: Optional[str] = None
    provincia: Optional[str] = None

class Curriculums(BaseModel):
    nombre: str
    fecha: str
    descripcion: str
    metaprompt: str

class ListarCurriculumsOut(BaseModel):
    centro_id: str
    curriculums: list[Curriculums]
    success: bool

class CurriculumIn(BaseModel):
    centro_id: Optional[str] = None
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    metaprompt: Optional[str] = None
    fecha: Optional[str] = None
    base64_pdf: Optional[str] = None

class CurriculumBorrarIn(BaseModel):
    centro_id: Optional[str] = None
    nombre: Optional[str] = None

class GenerarProgramacionIn(BaseModel):
    centro_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    num_unidades: Optional[int] = None
    curriculums: Optional[list[str]] = None
    consideraciones_adicionales: Optional[str] = None

class GenerarSeccionesIn(BaseModel):
    centro_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None
    num_secciones: Optional[int] = None
    consideraciones_adicionales: Optional[str] = None

class GenerarEjercicioIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None

class CorregirEjercicioIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None
    id_ejercicio: Optional[str] = None
    imagen_base64: Optional[str] = None

class GenerarTrabajoIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None

class CorregirTrabajoIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None
    id_trabajo: Optional[str] = None
    imagen_base64: Optional[str] = None

class GenerarRecomendacionIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None

class ProgramacionItem(BaseModel):
    clase: str
    asignatura: str
    num_unidades: int

class ProgramacionItemList(BaseModel):
    clase: str
    asignatura: str
    curriculums: str

class ProgramacionUnidad(BaseModel):
    unidad: int
    titulo: str
    contenido: str
    status: bool
    flag_created: bool = False

class ListarProgramacionesOut(BaseModel):
    centro_id: str
    profesor_id: str
    programaciones: list[ProgramacionItem]
    success: bool

class ListarProgramacionesDetalleOut(BaseModel):
    centro_id: str
    profesor_id: str
    unidades: list[ProgramacionItemList]
    success: bool

class ListarProgramacionesUnidadesDetalleOut(BaseModel):
    centro_id: str
    profesor_id: str
    unidades: list[ProgramacionUnidad]
    success: bool

class ModificarUnidadProgramacionIn(BaseModel):
    centro_id: Optional[str] = None
    profesor_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None
    titulo: Optional[str] = None
    contenido: Optional[str] = None

class ModificarUnidadProgramacionOut(BaseModel):
    success: bool

class ValidarUnidadProgramacionIn(BaseModel):
    centro_id: Optional[str] = None
    profesor_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None

class ValidarUnidadProgramacionOut(BaseModel):
    success: bool

class SeccionItem(BaseModel):
    seccion: int
    titulo: str
    contenido: str
    status: bool

class ListarSeccionesIn(BaseModel):
    centro_id: Optional[str] = None
    profesor_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None

class ListarSeccionesOut(BaseModel):
    centro_id: str
    profesor_id: str
    clase: str
    asignatura: str
    unidad: int
    secciones: list[SeccionItem]
    success: bool

class ValidarSeccionProgramacionIn(BaseModel):
    centro_id: Optional[str] = None
    profesor_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None
    seccion: Optional[int] = None

class ValidarSeccionProgramacionOut(BaseModel):
    success: bool

class ModificarSeccionProgramacionIn(BaseModel):
    centro_id: Optional[str] = None
    profesor_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None
    seccion: Optional[int] = None
    titulo: Optional[str] = None
    contenido: Optional[str] = None

class ModificarSeccionProgramacionOut(BaseModel):
    success: bool

class DashboardEjercicioItem(BaseModel):
    clase: str
    asignatura: str
    unidad: int
    alumno_id: str
    total_ejercicios: int
    ejercicios_resueltos: int
    nota_media: Optional[float] = None

class DashboardTrabajoItem(BaseModel):
    clase: str
    asignatura: str
    unidad: int
    alumno_id: str
    total_trabajos: int
    trabajos_resueltos: int
    nota_media: Optional[float] = None

class ListarDashboardProfesorIn(BaseModel):
    centro_id: Optional[str] = None
    profesor_id: Optional[str] = None

class ListarDashboardEjerciciosProfesorOut(BaseModel):
    centro_id: str
    profesor_id: str
    ejercicios: list[DashboardEjercicioItem]
    success: bool

class ListarDashboardTrabajosProfesorOut(BaseModel):
    centro_id: str
    profesor_id: str
    trabajos: list[DashboardTrabajoItem]
    success: bool

class ContenidoSeccionItem(BaseModel):
    seccion: str
    titulo: str
    url_contenido: str
    url_audio: str

class ListarContenidosUnidadIn(BaseModel):
    centro_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None

class ListarContenidosUnidadOut(BaseModel):
    centro_id: str
    clase: str
    asignatura: str
    unidad: int
    titulo_unidad: str
    contenidos: list[ContenidoSeccionItem]
    success: bool

class ObtenerContenidoHtmlIn(BaseModel):
    centro_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None
    seccion: Optional[str] = None

class ObtenerContenidoHtmlOut(BaseModel):
    html_content: str
    success: bool

class ValidarContenidoIn(BaseModel):
    centro_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None
    seccion: Optional[str] = None

class ValidarContenidoOut(BaseModel):
    success: bool

class ObtenerImagenSalidaIn(BaseModel):
    centro_id: str
    alumno_id: str
    titulo: str

class ObtenerImagenSalidaOut(BaseModel):
    imagebase64: str
    success: bool

class ConversaYoFuturoOut(BaseModel):
    respuesta:str

class ConversaYoFuturoIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None
    mensaje: Optional[str] = None
    salida_id: Optional[int] = None

# ---------- Helpers ----------

def upload_base64_to_gcs(base64_string: str, filename: str, GCS_BUCKET) -> str:
    try:
        if ',' in base64_string:
            base64_data = base64_string.split(',')[1]
        else:
            base64_data = base64_string
        
        image_data = base64.b64decode(base64_data)
        
        bucket = storage_client.bucket(GCS_BUCKET)
        blob = bucket.blob(filename)
        blob.upload_from_string(image_data, content_type='image/jpeg')
        
        return filename
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error subiendo imagen: {str(e)}")

def download_base64_from_gcs(filename: str, GCS_BUCKET) -> str:
    try:
        bucket = storage_client.bucket(GCS_BUCKET)
        blob = bucket.blob(filename)
        
        if not blob.exists():
            return ""
        
        image_data = blob.download_as_bytes()
        base64_data = base64.b64encode(image_data).decode('utf-8')
        
        # Detectar el tipo de imagen por la extensión del archivo
        if filename.lower().endswith('.png'):
            mime_type = 'image/png'
        elif filename.lower().endswith('.jpg') or filename.lower().endswith('.jpeg'):
            mime_type = 'image/jpeg'
        elif filename.lower().endswith('.gif'):
            mime_type = 'image/gif'
        elif filename.lower().endswith('.webp'):
            mime_type = 'image/webp'
        else:
            mime_type = 'image/jpeg'  # Default
        
        # Devolver con formato data URI
        return f"data:{mime_type};base64,{base64_data}"
    except Exception as e:
        print(f"Error descargando imagen {filename}: {str(e)}")
        return ""

def generate_signed_url_from_gcs(filename: str, GCS_BUCKET: str, expiration_seconds: int = 3600) -> str:
    """Genera una URL firmada para un archivo en GCS"""
    try:
        bucket = storage_client.bucket(GCS_BUCKET)
        blob = bucket.blob(filename)
        
        if not blob.exists():
            return ""
        
        # Generar URL firmada válida por expiration_seconds (default 1 hora)
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(seconds=expiration_seconds),
            method="GET"
        )
        
        return url
    except Exception as e:
        print(f"Error generando URL firmada para {filename}: {str(e)}")
        return ""

def delete_from_gcs(filename: str, GCS_BUCKET) -> bool:
    try:
        bucket = storage_client.bucket(GCS_BUCKET)
        blob = bucket.blob(filename)
        
        if blob.exists():
            blob.delete()
            return True
        return False
    except Exception as e:
        print(f"Error eliminando imagen {filename}: {str(e)}")
        return False

# ---------- Endpoints ----------
@app.get("/health")
def health():
    return {"ok": True}

@app.get("/setup")
def database_setup():
    ensure_database_setup()
    return {"ok": True}

@app.post("/crear_centro", response_model=CentroOut)
def crear_centro(
    payload: CentroIn
):
    
    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_CENTROS` (id_centro) VALUES ('{payload.centro_id}')"""
    job = client.query(sql)
    job.result()

    return CentroOut(centro_id=payload.centro_id, success=True)

@app.options("/crear_profesor")
def crear_profesor_options():
    return {"message": "OK"}

@app.post("/crear_profesor", response_model=ProfesorOut)
def crear_profesor(
    payload: ProfesorIn
):
    
    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_PROFESORES` (id_profesor,id_centro) VALUES ('{payload.profesor_id}','{payload.centro_id}')"""
    job = client.query(sql)
    job.result()

    return ProfesorOut(profesor_id=payload.profesor_id, centro_id=payload.centro_id, success=True)

@app.options("/crear_alumno")
def crear_alumno_options():
    return {"message": "OK"}

@app.post("/crear_alumno", response_model=AlumnoOut)
def crear_alumno(
    payload: AlumnoIn
):
    
    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ALUMNOS` (id_alumno,id_centro) VALUES ('{payload.alumno_id}','{payload.centro_id}')"""
    job = client.query(sql)
    job.result()
    
    # Subir imagen de avatar por defecto al bucket de avatares
    try:
        avatar_path = SCRIPT_DIR.parent / "public" / "avatar.png"
        print(f"DEBUG: Intentando subir avatar desde: {avatar_path}")
        print(f"DEBUG: Ruta existe: {avatar_path.exists()}")
        
        if avatar_path.exists():
            with open(avatar_path, "rb") as f:
                image_data = f.read()
                base64_data = base64.b64encode(image_data).decode('utf-8')
                avatar_filename = f"{payload.centro_id}/{payload.alumno_id}.png"
                print(f"DEBUG: Subiendo avatar a: {avatar_filename} en bucket {GCS_BUCKET_AVATARES}")
                upload_base64_to_gcs(base64_data, avatar_filename, GCS_BUCKET_AVATARES)
                print(f"DEBUG: Avatar subido exitosamente")
        else:
            print(f"ERROR: No se encontró el archivo avatar.png en {avatar_path}")
    except Exception as e:
        print(f"ERROR subiendo avatar por defecto: {str(e)}")
        traceback.print_exc()

    return AlumnoOut(alumno_id=payload.alumno_id, centro_id=payload.centro_id, success=True)

@app.options("/borrar_alumno")
def borrar_alumno_options():
    return {"message": "OK"}

@app.post("/borrar_alumno", response_model=AlumnoOut)
def borrar_alumno(
    payload: AlumnoIn
):
    
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNOS` WHERE id_alumno = '{payload.alumno_id}' AND id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()

    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_CLASE` WHERE id_alumno = '{payload.alumno_id}' AND id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()

    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_INTERES` WHERE id_alumno = '{payload.alumno_id}' AND id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()

    try:
        bucket = storage_client.bucket(GCS_BUCKET_AVATARES)
        blobs = bucket.list_blobs(prefix=f"{payload.centro_id}/{payload.alumno_id}.png")
        for blob in blobs:
            blob.delete()
    except Exception as e:
        pass

    try:
        bucket = storage_client.bucket(GCS_BUCKET_SALIDAS)
        blobs = bucket.list_blobs(prefix=f"{payload.centro_id}/{payload.alumno_id}")
        for blob in blobs:
            blob.delete()
    except Exception as e:
        pass

    return AlumnoOut(alumno_id=payload.alumno_id, centro_id=payload.centro_id, success=True)

@app.options("/borrar_profesor")
def borrar_profesor_options():
    return {"message": "OK"}

@app.post("/borrar_profesor", response_model=ProfesorOut)
def borrar_profesor(
    payload: ProfesorIn
):
    
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_PROFESORES` WHERE id_profesor = '{payload.profesor_id}' AND id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` WHERE id_profesor = '{payload.profesor_id}' AND id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()

    return ProfesorOut(profesor_id=payload.profesor_id, centro_id=payload.centro_id, success=True)

@app.post("/borrar_centro", response_model=CentroOut)
def borrar_centro(
    payload: CentroIn
):
    
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_PROFESORES` WHERE id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNOS` WHERE id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_CENTROS` WHERE id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_CLASES` WHERE id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS` WHERE id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` WHERE id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_CLASE` WHERE id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_INTERES` WHERE id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_DIRECCIONES_ALUMNOS` WHERE id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_CURRICULUMS` WHERE id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()

    try:
        bucket = storage_client.bucket(GCS_BUCKET_CURRICULUMS)
        blobs = bucket.list_blobs(prefix=f"{payload.centro_id}/")
        for blob in blobs:
            blob.delete()
    except Exception as e:
        pass

    try:
        bucket = storage_client.bucket(GCS_BUCKET_ASIGNATURAS)
        blobs = bucket.list_blobs(prefix=f"{payload.centro_id}/")
        for blob in blobs:
            blob.delete()
    except Exception as e:
        pass

    try:
        bucket = storage_client.bucket(GCS_BUCKET_AVATARES)
        blobs = bucket.list_blobs(prefix=f"{payload.centro_id}/")
        for blob in blobs:
            blob.delete()
    except Exception as e:
        pass

    try:
        bucket = storage_client.bucket(GCS_BUCKET_SALIDAS)
        blobs = bucket.list_blobs(prefix=f"{payload.centro_id}/")
        for blob in blobs:
            blob.delete()
    except Exception as e:
        pass

    return CentroOut(centro_id=payload.centro_id, success=True)

@app.options("/crear_clase")
async def crear_clase_options():
    return {}

@app.post("/crear_clase", response_model=ClaseOut)
def crear_clase(
    payload: ClaseIn
):
    
    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_CLASES` (clase,id_centro) VALUES ('{payload.clase}','{payload.centro_id}')"""
    job = client.query(sql)
    job.result()

    return ClaseOut(clase=payload.clase, centro_id=payload.centro_id, success=True)

@app.options("/borrar_clase")
async def borrar_clase_options():
    return {}

@app.post("/borrar_clase", response_model=ClaseOut)
def borrar_clase(
    payload: ClaseIn
):
    
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_CLASES` WHERE clase = '{payload.clase}' AND id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` WHERE clase = '{payload.clase}' AND id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_CLASE` WHERE clase = '{payload.clase}' AND id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    return ClaseOut(clase=payload.clase, centro_id=payload.centro_id, success=True)

@app.options("/actualizar_clase")
async def actualizar_clase_options():
    return {}

@app.post("/actualizar_clase", response_model=ClaseOut)
def actualizar_clase(
    payload: ClaseIn
):
    # Actualizar en T_CLASES
    sql = f"""UPDATE `{PROJECT_ID}.{DATASET_ID}.T_CLASES` 
              SET clase = '{payload.clase}' 
              WHERE clase = '{payload.clase_antigua}' AND id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    
    # Actualizar en T_ASIGNATURAS_PROFESORES
    sql = f"""UPDATE `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` 
              SET clase = '{payload.clase}' 
              WHERE clase = '{payload.clase_antigua}' AND id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()

    return ClaseOut(clase=payload.clase, centro_id=payload.centro_id, success=True)

@app.options("/crear_asignatura")
async def crear_asignatura_options():
    return {}

@app.post("/crear_asignatura", response_model=AsignaturaOut)
def crear_asignatura(
    payload: AsignaturaIn
):
    try:
        # Subir imagen a GCS solo si existe
        if payload.imagebase64:
            filename = f"{payload.centro_id}/{payload.asignatura}.png"
            image_path = upload_base64_to_gcs(payload.imagebase64, filename, GCS_BUCKET_ASIGNATURAS)
        
        # Guardar path en BigQuery
        sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS` (asignatura,id_centro, descripcion) VALUES ('{payload.asignatura}','{payload.centro_id}','{payload.descripcion}')"""
        job = client.query(sql)
        job.result()

        return AsignaturaOut(asignatura=payload.asignatura, centro_id=payload.centro_id, success=True)
    except Exception as e:
        print(f"ERROR en crear_asignatura: {type(e).__name__}: {str(e)}")
        traceback.print_exc()
        raise

@app.options("/borrar_asignatura")
async def borrar_asignatura_options():
    return {}

@app.post("/borrar_asignatura", response_model=AsignaturaOut)
def borrar_asignatura(
    payload: AsignaturaIn
):
    # Eliminar imagen de GCS primero
    filename = f"{payload.centro_id}/{payload.asignatura}.png"
    delete_from_gcs(filename, GCS_BUCKET_ASIGNATURAS)
    
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS` WHERE asignatura = '{payload.asignatura}' AND id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` WHERE asignatura = '{payload.asignatura}' AND id_centro = '{payload.centro_id}'"""
    job = client.query(sql)
    job.result()

    return AsignaturaOut(asignatura=payload.asignatura, centro_id=payload.centro_id, imagebase64=payload.imagebase64, success=True)

@app.options("/actualizar_asignatura")
async def actualizar_asignatura_options():
    return {}

@app.post("/actualizar_asignatura", response_model=AsignaturaOut)
def actualizar_asignatura(
    payload: AsignaturaIn
):
    try:
        # Si hay nueva imagen, actualizar en GCS
        if payload.imagebase64:
            # Si cambió el nombre, eliminar imagen antigua con nombre antiguo
            if payload.asignatura != payload.asignatura_antigua:
                old_filename = f"{payload.centro_id}/{payload.asignatura_antigua}.png"
                delete_from_gcs(old_filename, GCS_BUCKET_ASIGNATURAS)
            else:
                # Si no cambió el nombre, eliminar la imagen actual antes de subir la nueva
                current_filename = f"{payload.centro_id}/{payload.asignatura}.png"
                delete_from_gcs(current_filename, GCS_BUCKET_ASIGNATURAS)
            
            # Subir nueva imagen con el nombre (nuevo o actual)
            new_filename = f"{payload.centro_id}/{payload.asignatura}.png"
            upload_base64_to_gcs(payload.imagebase64, new_filename, GCS_BUCKET_ASIGNATURAS)
        else:
            # Si no hay nueva imagen pero cambió el nombre, copiar la imagen al nuevo nombre
            if payload.asignatura != payload.asignatura_antigua:
                bucket = storage_client.bucket(GCS_BUCKET_ASIGNATURAS)
                old_blob = bucket.blob(f"{payload.centro_id}/{payload.asignatura_antigua}.png")
                if old_blob.exists():
                    # Copiar al nuevo nombre
                    new_blob = bucket.blob(f"{payload.centro_id}/{payload.asignatura}.png")
                    new_blob.rewrite(old_blob)
                    # Eliminar la imagen antigua
                    old_blob.delete()
        
        # Actualizar en T_ASIGNATURAS
        sql = f"""UPDATE `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS` 
                  SET asignatura = '{payload.asignatura}' and descripcion = '{payload.descripcion}'
                  WHERE asignatura = '{payload.asignatura_antigua}' AND id_centro = '{payload.centro_id}'"""
        job = client.query(sql)
        job.result()
        
        # Actualizar en T_ASIGNATURAS_PROFESORES
        sql = f"""UPDATE `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` 
                  SET asignatura = '{payload.asignatura}'
                  WHERE asignatura = '{payload.asignatura_antigua}' AND id_centro = '{payload.centro_id}'"""
        job = client.query(sql)
        job.result()

        return AsignaturaOut(asignatura=payload.asignatura, centro_id=payload.centro_id, imagebase64=payload.imagebase64, success=True)
    except Exception as e:
        print(f"ERROR en actualizar_asignatura: {type(e).__name__}: {str(e)}")
        traceback.print_exc()
        raise

@app.options("/crear_asignatura_profesor")
def crear_asignatura_profesor_options():
    return {"message": "OK"}

@app.post("/crear_asignatura_profesor", response_model=AsignaturaProfesorOut)
def crear_asignatura_profesor(
    payload: AsignaturaProfesorIn
):
    
    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` (clase,id_centro,id_profesor,asignatura) VALUES ('{payload.clase}','{payload.centro_id}','{payload.profesor_id}','{payload.asignatura}')"""
    job = client.query(sql)
    job.result()

    return AsignaturaProfesorOut(clase=payload.clase, centro_id=payload.centro_id, profesor_id=payload.profesor_id, asignatura=payload.asignatura, success=True)

@app.options("/borrar_asignatura_profesor")
def borrar_asignatura_profesor_options():
    return {"message": "OK"}

@app.post("/borrar_asignatura_profesor", response_model=AsignaturaProfesorOut)
def borrar_asignatura_profesor(
    payload: AsignaturaProfesorIn
):
    
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` WHERE clase = '{payload.clase}' AND id_centro = '{payload.centro_id}' AND id_profesor = '{payload.profesor_id}' AND asignatura = '{payload.asignatura}'"""
    job = client.query(sql)
    job.result()

    return AsignaturaProfesorOut(clase=payload.clase, centro_id=payload.centro_id, profesor_id=payload.profesor_id, asignatura=payload.asignatura, success=True)

@app.options("/actualizar_asignatura_profesor")
def actualizar_asignatura_profesor_options():
    return {"message": "OK"}

@app.post("/actualizar_asignatura_profesor", response_model=AsignaturaProfesorOut)
def actualizar_asignatura_profesor(
    payload: AsignaturaProfesorIn
):
    # Eliminar la asignación antigua
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` 
              WHERE clase = '{payload.clase_antigua}' 
              AND id_centro = '{payload.centro_id}' 
              AND id_profesor = '{payload.profesor_id_antiguo}' 
              AND asignatura = '{payload.asignatura_antigua}'"""
    job = client.query(sql)
    job.result()
    
    # Insertar la nueva asignación
    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` (clase,id_centro,id_profesor,asignatura) 
              VALUES ('{payload.clase}','{payload.centro_id}','{payload.profesor_id}','{payload.asignatura}')"""
    job = client.query(sql)
    job.result()

    return AsignaturaProfesorOut(clase=payload.clase, centro_id=payload.centro_id, profesor_id=payload.profesor_id, asignatura=payload.asignatura, success=True)

@app.options("/listar_asignaciones")
def listar_asignaciones_options():
    return {"message": "OK"}

@app.post("/listar_asignaciones", response_model=ListarAsignacionesOut)
def listar_asignaciones(
    payload: CentroIn
):
    sql = f"""SELECT clase, asignatura, id_profesor 
              FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` 
              WHERE id_centro = '{payload.centro_id}'"""
    query_job = client.query(sql)
    results = query_job.result()
    
    asignaciones = []
    for row in results:
        asignaciones.append(AsignacionProfesor(
            clase=row.clase,
            asignatura=row.asignatura,
            profesor_id=row.id_profesor
        ))
    
    return ListarAsignacionesOut(centro_id=payload.centro_id, asignaciones=asignaciones, success=True)

@app.options("/crear_alumno_clase")
def crear_alumno_clase_options():
    return {"message": "OK"}

@app.post("/crear_alumno_clase", response_model=AlumnoClaseOut)
def crear_alumno_clase(
    payload: AlumnoClaseIn
):
    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_CLASE` (clase,id_centro,id_alumno) 
              VALUES ('{payload.clase}','{payload.centro_id}','{payload.alumno_id}')"""
    job = client.query(sql)
    job.result()

    return AlumnoClaseOut(clase=payload.clase, centro_id=payload.centro_id, alumno_id=payload.alumno_id, success=True)

@app.options("/borrar_alumno_clase")
def borrar_alumno_clase_options():
    return {"message": "OK"}

@app.post("/borrar_alumno_clase", response_model=AlumnoClaseOut)
def borrar_alumno_clase(
    payload: AlumnoClaseIn
):
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_CLASE` WHERE clase = '{payload.clase}' AND id_centro = '{payload.centro_id}' AND id_alumno = '{payload.alumno_id}'"""
    job = client.query(sql)
    job.result()

    return AlumnoClaseOut(clase=payload.clase, centro_id=payload.centro_id, alumno_id=payload.alumno_id, success=True)

@app.options("/actualizar_alumno_clase")
def actualizar_alumno_clase_options():
    return {"message": "OK"}

@app.post("/actualizar_alumno_clase", response_model=AlumnoClaseOut)
def actualizar_alumno_clase(
    payload: AlumnoClaseIn
):
    # Eliminar la asignación antigua
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_CLASE` 
              WHERE clase = '{payload.clase_antigua}' 
              AND id_centro = '{payload.centro_id}' 
              AND id_alumno = '{payload.alumno_id_antiguo}'"""
    job = client.query(sql)
    job.result()
    
    # Insertar la nueva asignación
    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_CLASE` (clase,id_centro,id_alumno) 
              VALUES ('{payload.clase}','{payload.centro_id}','{payload.alumno_id}')"""
    job = client.query(sql)
    job.result()

    return AlumnoClaseOut(clase=payload.clase, centro_id=payload.centro_id, alumno_id=payload.alumno_id, success=True)

@app.options("/listar_asignaciones_alumnos")
def listar_asignaciones_alumnos_options():
    return {"message": "OK"}

@app.post("/listar_asignaciones_alumnos", response_model=ListarAsignacionesAlumnosOut)
def listar_asignaciones_alumnos(
    payload: CentroIn
):
    sql = f"""SELECT clase, id_alumno 
              FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_CLASE` 
              WHERE id_centro = '{payload.centro_id}'"""
    query_job = client.query(sql)
    results = query_job.result()
    
    asignaciones = []
    for row in results:
        asignaciones.append(AsignacionAlumno(
            clase=row.clase,
            alumno_id=row.id_alumno
        ))
    
    return ListarAsignacionesAlumnosOut(centro_id=payload.centro_id, asignaciones=asignaciones, success=True)

@app.post("/listar_clases", response_model=ListarClasesOut)
def listar_clases(
    payload: CentroIn
):
    
    sql = f"""SELECT clase FROM `{PROJECT_ID}.{DATASET_ID}.T_CLASES` WHERE id_centro = '{payload.centro_id}'"""
    query_job = client.query(sql)
    results = query_job.result()

    clases = [row.clase for row in results]

    return ListarClasesOut(centro_id=payload.centro_id, clases=clases, success=True)

@app.post("/listar_profesores", response_model=ListarProfesoresOut)
def listar_profesores(
    payload: CentroIn
):
    
    sql = f"""SELECT id_profesor FROM `{PROJECT_ID}.{DATASET_ID}.T_PROFESORES` WHERE id_centro = '{payload.centro_id}'"""
    query_job = client.query(sql)
    results = query_job.result()
    
    profesores = [row.id_profesor for row in results]

    return ListarProfesoresOut(centro_id=payload.centro_id, profesores=profesores, success=True)

@app.post("/listar_alumnos", response_model=ListarAlumnosOut)
def listar_alumnos(
    payload: CentroIn
):
    
    sql = f"""SELECT id_alumno FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNOS` WHERE id_centro = '{payload.centro_id}'"""
    query_job = client.query(sql)
    results = query_job.result()
    
    alumnos = [row.id_alumno for row in results]

    return ListarAlumnosOut(centro_id=payload.centro_id, alumnos=alumnos, success=True)

@app.options("/listar_asignaturas")
async def listar_asignaturas_options():
    return {}

@app.post("/listar_asignaturas", response_model=ListarAsignaturasOut)
def listar_asignaturas(
    payload: CentroIn
):
    
    sql = f"""SELECT id_centro,asignatura FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS` WHERE id_centro = '{payload.centro_id}'"""
    query_job = client.query(sql)
    results = query_job.result()
    
    asignaturas = []
    imagebase64 = []
    for row in results:
        asignaturas.append(row.asignatura)
        # Generar URL firmada en lugar de base64
        signed_url = generate_signed_url_from_gcs(
            row.id_centro + '/' + row.asignatura + '.png', 
            GCS_BUCKET_ASIGNATURAS,
            expiration_seconds=3600
        )
        imagebase64.append(signed_url)
    
    return ListarAsignaturasOut(centro_id=payload.centro_id, asignaturas=asignaturas, imagebase64=imagebase64, success=True)

@app.options("/actualizar_alumno_interes")
def actualizar_alumno_interes_options():
    return {"message": "OK"}

@app.post("/actualizar_alumno_interes", response_model=AlumnoInteresOut)
def actualizar_alumno_interes(
    payload: AlumnoInteresIn
):
    
    if not payload.alumno_id:
        raise HTTPException(status_code=400, detail="alumno_id es requerido")
    if not payload.centro_id:
        raise HTTPException(status_code=400, detail="centro_id es requerido")
    if not payload.texto_tiempo_libre:
        raise HTTPException(status_code=400, detail="texto_tiempo_libre es requerido")
    if not payload.texto_que_te_motiva:
        raise HTTPException(status_code=400, detail="texto_que_te_motiva es requerido")
    if not payload.texto_que_te_ayuda_a_entender:
        raise HTTPException(status_code=400, detail="texto_que_te_ayuda_a_entender es requerido")
    if not payload.texto_que_te_frustra_a_estudiar:
        raise HTTPException(status_code=400, detail="texto_que_te_frustra_a_estudiar es requerido")
    if not payload.texto_que_asignaturas_se_te_dan_mejor:
        raise HTTPException(status_code=400, detail="texto_que_asignaturas_se_te_dan_mejor es requerido")
    if not payload.turno_formativo:
        raise HTTPException(status_code=400, detail="turno_formativo es requerido")
    if not payload.max_tiempo_desplazamiento:
        raise HTTPException(status_code=400, detail="max_tiempo_desplazamiento es requerido")
    if not payload.color_camiseta:
        raise HTTPException(status_code=400, detail="color_camiseta es requerido")
    if not payload.color_labios:
        raise HTTPException(status_code=400, detail="color_labios es requerido")
    if not payload.color_ojos:
        raise HTTPException(status_code=400, detail="color_ojos es requerido")
    if not payload.color_pelo:
        raise HTTPException(status_code=400, detail="color_pelo es requerido")
    if not payload.color_piel:
        raise HTTPException(status_code=400, detail="color_piel es requerido")
    if not payload.genero:
        raise HTTPException(status_code=400, detail="genero es requerido")
    if not payload.tipo_peinado:
        raise HTTPException(status_code=400, detail="tipo_peinado es requerido")
    
    # Crear Cloud Task para Recomendador Profesor Worker
    message_data = {
        "centro_id": payload.centro_id,
        "alumno_id": payload.alumno_id,
        "texto_tiempo_libre": payload.texto_tiempo_libre,
        "texto_que_te_motiva": payload.texto_que_te_motiva,
        "texto_que_te_ayuda_a_entender": payload.texto_que_te_ayuda_a_entender,
        "texto_que_te_frustra_a_estudiar": payload.texto_que_te_frustra_a_estudiar,
        "texto_que_asignaturas_se_te_dan_mejor": payload.texto_que_asignaturas_se_te_dan_mejor,
        "turno_formativo": payload.turno_formativo,
        "max_tiempo_desplazamiento": payload.max_tiempo_desplazamiento,
        "color_camiseta": payload.color_camiseta,
        "color_labios": payload.color_labios,
        "color_ojos": payload.color_ojos,
        "color_pelo": payload.color_pelo,
        "color_piel": payload.color_piel,
        "genero": payload.genero,
        "tipo_peinado": payload.tipo_peinado,
        "action": "generar_recomendaciones_salidas"
    }
    
    # Crear tarea HTTP en Cloud Tasks
    parent = tasks_client.queue_path(PROJECT_ID, REGION, "recomendador-salidas-worker-task-queue")
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": "https://odiseia-gw-recomendador-salidas-worker-baej0f92.ew.gateway.dev",
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(message_data, ensure_ascii=False).encode('utf-8'),
        }
    }
    
    response = tasks_client.create_task(parent=parent, task=task)
    print(f"Tarea de recomendación creada: {response.name}")

    return AlumnoInteresOut(centro_id=payload.centro_id, alumno_id=payload.alumno_id, success=True)

    

@app.options("/listar_intereses_alumnos")
def listar_intereses_alumnos_options():
    return {"message": "OK"}

@app.post("/listar_intereses_alumnos", response_model=ListarInteresesAlumnosOut)
def listar_intereses_alumnos(
    payload: AlumnoInteresIn
):
    sql = f"""SELECT texto_tiempo_libre,texto_que_te_motiva,texto_que_te_ayuda_a_entender,texto_que_te_frustra_a_estudiar,texto_que_asignaturas_se_te_dan_mejor, id_alumno, turno_formativo, max_tiempo_desplazamiento, color_camiseta, color_labios, color_ojos, color_pelo, color_piel, genero, tipo_peinado 
              FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_INTERES` 
              WHERE id_centro = '{payload.centro_id}' and id_alumno = '{payload.alumno_id}'"""
    query_job = client.query(sql)
    results = query_job.result()
    
    intereses = []
    for row in results:
        intereses.append(InteresAlumno(
            texto_tiempo_libre=row.texto_tiempo_libre,
            texto_que_te_motiva=row.texto_que_te_motiva,
            texto_que_te_ayuda_a_entender=row.texto_que_te_ayuda_a_entender,
            texto_que_te_frustra_a_estudiar=row.texto_que_te_frustra_a_estudiar,
            texto_que_asignaturas_se_te_dan_mejor=row.texto_que_asignaturas_se_te_dan_mejor,
            turno_formativo=row.turno_formativo,
            max_tiempo_desplazamiento=row.max_tiempo_desplazamiento,
            color_camiseta=row.color_camiseta,
            color_labios=row.color_labios,
            color_ojos=row.color_ojos,
            color_pelo=row.color_pelo,
            color_piel=row.color_piel,
            genero=row.genero,
            tipo_peinado=row.tipo_peinado,
        ))
    
    return ListarInteresesAlumnosOut(centro_id=payload.centro_id, intereses=intereses, success=True, alumno_id=payload.alumno_id)

@app.options("/listar_avatar_config")
def listar_avatar_config_options():
    return {"message": "OK"}

@app.post("/listar_avatar_config", response_model=ListarAvatarConfigOut)
def listar_avatar_config(
    payload: AvatarConfigIn
):
    sql = f"""SELECT color_pelo, color_ojos, color_piel, color_labios, color_camiseta, genero, tipo_peinado
              FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_INTERES` 
              WHERE id_centro = '{payload.centro_id}' AND id_alumno = '{payload.alumno_id}'"""
    query_job = client.query(sql)
    results = query_job.result()
    
    avatar = None
    for row in results:
        avatar = AvatarConfig(
            color_pelo=row.color_pelo,
            color_ojos=row.color_ojos,
            color_piel=row.color_piel,
            color_labios=row.color_labios,
            color_camiseta=row.color_camiseta,
            genero=row.genero,
            tipo_peinado=row.tipo_peinado
        )
        break  # Solo debería haber un resultado
    
    # Descargar la imagen del avatar desde el bucket
    avatar_filename = f"{payload.centro_id}/{payload.alumno_id}.png"
    imagebase64 = download_base64_from_gcs(avatar_filename, GCS_BUCKET_AVATARES)
    
    return ListarAvatarConfigOut(centro_id=payload.centro_id, alumno_id=payload.alumno_id, avatar=avatar, imagebase64=imagebase64, success=True)

@app.options("/obtener_avatar_imagen")
def obtener_avatar_imagen_options():
    return {"message": "OK"}

@app.post("/obtener_avatar_imagen", response_model=ObtenerAvatarImagenOut)
def obtener_avatar_imagen(
    payload: ObtenerAvatarImagenIn
):
    
    sql = f"""SELECT recomendacion as valor
              FROM `{PROJECT_ID}.{DATASET_ID}.T_MEJORA_SEMANAL` 
              WHERE centro_id = '{payload.centro_id}' AND alumno_id = '{payload.alumno_id}'
              LIMIT 1"""
    query_job = client.query(sql)
    results_recomendacion = query_job.result()

    for row in results_recomendacion:
        recomendacion = row.valor
        break
    recomendacion = "**Vas por muy buen camino** y, si mantienes ese ritmo y constancia, seguro que lo conseguirás\nTe recomiendo que pongas toda tu atención en mejorar en **álgebra** ya que te será de gran utilidad el día de mañana."

    # Descargar la imagen del avatar desde el bucket
    avatar_filename = f"{payload.centro_id}/{payload.alumno_id}.png"
    imagebase64 = download_base64_from_gcs(avatar_filename, GCS_BUCKET_AVATARES)
    
 
    sql = f"""SELECT 
                A.asignatura, A.unidad, ifnull(B.valor,0) as valor
                FROM
                (SELECT distinct centro_id, clase, asignatura, unidad FROM `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE` where centro_id='{payload.centro_id}') A
                left join
                (SELECT centro_id, asignatura, unidad, nota_media as valor FROM `{PROJECT_ID}.{DATASET_ID}.V_DASHBOARD_TRABAJOS_PROFESORES` where alumno_id='{payload.alumno_id}' and centro_id='{payload.centro_id}') B
                ON A.centro_id=b.centro_id"""
    query_job = client.query(sql)
    results_trabajos = query_job.result()
    
    asignaturas_trabajos = []
    for row in results_trabajos:
        asignaturas_trabajos.append(AsignaturaValor(
            asignatura=row.asignatura,
            unidad=row.unidad,
            valor=row.valor
        ))

    sql = f"""SELECT 
                A.asignatura, A.unidad, ifnull(B.valor,0) as valor
                FROM
                (SELECT distinct centro_id, clase, asignatura, unidad FROM `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE` where centro_id='{payload.centro_id}') A
                left join
                (SELECT centro_id, asignatura, unidad, nota_media as valor FROM `{PROJECT_ID}.{DATASET_ID}.V_DASHBOARD_EJERCICIOS_PROFESORES` where alumno_id='{payload.alumno_id}' and centro_id='{payload.centro_id}') B
                ON A.centro_id=b.centro_id"""
    query_job = client.query(sql)
    results_ejercicios = query_job.result()
    
    asignaturas_ejercicios = []
    for row in results_ejercicios:
        asignaturas_ejercicios.append(AsignaturaValor(
            asignatura=row.asignatura,
            unidad=row.unidad,
            valor=row.valor
        ))

    # Obtener los iconos de las asignaturas
    asignaturas_unicas = set()
    for item in asignaturas_ejercicios:
        asignaturas_unicas.add(item.asignatura)
    for item in asignaturas_trabajos:
        asignaturas_unicas.add(item.asignatura)
    
    asignaturas_iconos = {}
    for asignatura_nombre in asignaturas_unicas:
        try:
            base64_data = download_base64_from_gcs(
                payload.centro_id + '/' + asignatura_nombre + '.png',
                GCS_BUCKET_ASIGNATURAS
            )
            if base64_data:
                asignaturas_iconos[asignatura_nombre] = base64_data
        except Exception as e:
            print(f"No se pudo cargar icono para {asignatura_nombre}: {e}")
    
    return ObtenerAvatarImagenOut(
        centro_id=payload.centro_id,
        alumno_id=payload.alumno_id,
        recomendacion=recomendacion,
        imagebase64=imagebase64,
        asignaturas_ejercicios=asignaturas_ejercicios,
        asignaturas_trabajos=asignaturas_trabajos,
        asignaturas_iconos=asignaturas_iconos,
        success=True
    )

@app.options("/listar_asignaturas_alumno")
def listar_asignaturas_alumno_options():
    return {"message": "OK"}

@app.post("/listar_asignaturas_alumno", response_model=ListarAsignaturasAlumnoOut)
def listar_asignaturas_alumno(
    payload: ListarAsignaturasAlumnoIn
):
    sql = f"""SELECT asignatura
              FROM `{PROJECT_ID}.{DATASET_ID}.V_ASIGNATURAS_ALUMNO` 
              WHERE id_centro = '{payload.centro_id}' AND id_alumno = '{payload.alumno_id}'"""
    query_job = client.query(sql)
    results = query_job.result()
    
    asignaturas = []
    for row in results:
        # Descargar imagen de la asignatura desde el bucket
        imagen_filename = f"{payload.centro_id}/{row.asignatura}.png"
        imagebase64 = download_base64_from_gcs(imagen_filename, GCS_BUCKET_ASIGNATURAS)
        
        asignaturas.append(AsignaturaAlumno(
            asignatura=row.asignatura,
            imagebase64=imagebase64
        ))
    
    return ListarAsignaturasAlumnoOut(centro_id=payload.centro_id, alumno_id=payload.alumno_id, asignaturas=asignaturas, success=True)

@app.options("/listar_salidas_alumno")
def listar_salidas_alumno_options():
    return {"message": "OK"}

@app.post("/listar_salidas_alumno", response_model=ListarSalidasAlumnoOut)
def listar_salidas_alumno(
    payload: ListarSalidasAlumnoIn
):
    try:
        sql = f"""SELECT
                  id_salida, ranking, flag_like, titulo, centro, municipio, provincia,
                  perfiles_profesionales, curriculo_ccaa, curriculo_mecd, tipo
                FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNOS_SALIDAS`
                WHERE id_centro = '{payload.centro_id}'
                  AND id_alumno = '{payload.alumno_id}'
                QUALIFY ROW_NUMBER() OVER (PARTITION BY ranking ORDER BY ranking ASC) = 1
                ORDER BY ranking ASC"""
        
        query_job = client.query(sql)
        results = query_job.result()
        
        salidas_json = {}
        salidas = []
        
        for row in results:
            try:

                # Validación de NULL para todos los campos
                curriculo = row.curriculo_ccaa if (row.curriculo_ccaa and row.curriculo_ccaa != "") else (row.curriculo_mecd if row.curriculo_mecd else "")
                municipio = row.municipio if row.municipio else ""
                provincia = row.provincia if row.provincia else ""
                
                salidas.append(SalidaAlumno(
                    salida_id=str(row.id_salida) if row.id_salida is not None else "",
                    ranking=int(row.ranking) if row.ranking is not None else 0,
                    flag_like=bool(row.flag_like) if row.flag_like is not None else False,
                    titulo=row.titulo if row.titulo else "",
                    centro=row.centro if row.centro else "",
                    localidad=f"{municipio} ({provincia})" if municipio or provincia else "",
                    distancia=0,
                    co2=0,
                    perfiles=row.perfiles_profesionales if row.perfiles_profesionales else "",
                    curriculo=curriculo,
                    tipo=row.tipo if row.tipo else ""
                ))
            except Exception as e:
                print(f"Error procesando salida: {e}")
                print(f"Row data: titulo={getattr(row, 'titulo', 'N/A')}, centro={getattr(row, 'centro', 'N/A')}")
                continue
        
        return ListarSalidasAlumnoOut(centro_id=payload.centro_id, alumno_id=payload.alumno_id, salidas=salidas, salidas_json=salidas_json, success=True)
    except Exception as e:
        print(f"Error en listar_salidas_alumno: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al listar salidas: {str(e)}")

@app.options("/modificar_salidas_alumno")
def modificar_salidas_alumno_options():
    return {"message": "OK"}

@app.post("/modificar_salidas_alumno", response_model=ModificarSalidasAlumnoOut)
def modificar_salidas_alumno(
    payload: ModificarSalidasAlumnoIn
):
    sql = f"""UPDATE `{PROJECT_ID}.{DATASET_ID}.T_ALUMNOS_SALIDAS`
                SET flag_like = {payload.flag_like}
              WHERE id_centro = '{payload.centro_id}' AND id_alumno = '{payload.alumno_id}' AND id_salida = {payload.salida_id}"""
    query_job = client.query(sql)
    query_job.result()
    
    return ModificarSalidasAlumnoOut(centro_id=payload.centro_id, alumno_id=payload.alumno_id, success=True)

@app.options("/listar_direcciones_centros")
def listar_direcciones_centros_options():
    return {"message": "OK"}

@app.post("/listar_direcciones_centros", response_model=ListarDireccionesCentrosOut)
def listar_direcciones_centros(
    payload: CentroIn
):
    sql = f"""SELECT pais, ccaa, provincia, municipio
              FROM `{PROJECT_ID}.{DATASET_ID}.T_DIRECCIONES_CENTROS` 
              WHERE id_centro = '{payload.centro_id}'"""
    query_job = client.query(sql)
    results = query_job.result()
    
    direcciones = []
    for row in results:
        direcciones.append(Direcciones(
            pais=row.pais,
            ccaa=row.ccaa,
            provincia=row.provincia,
            municipio=row.municipio
        ))
    
    return ListarDireccionesCentrosOut(centro_id=payload.centro_id, direcciones=direcciones, success=True)

@app.options("/modificar_direcciones_centro")
def modificar_direcciones_centro_options():
    return {"message": "OK"}

@app.post("/modificar_direcciones_centro", response_model=SuccessOut)
def modificar_direcciones_centro(
    payload: CentroDireccionesIn
):
    
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_DIRECCIONES_CENTROS`
              WHERE id_centro = '{payload.centro_id}'"""
    query_job = client.query(sql)
    query_job.result()

    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_DIRECCIONES_CENTROS` (id_centro, pais, ccaa, provincia, municipio)
                VALUES ('{payload.centro_id}', '{payload.pais}', '{payload.ccaa}', '{payload.provincia}', '{payload.municipio}')"""
    query_job = client.query(sql)
    query_job.result()
    
    return SuccessOut(success=True)

@app.options("/listar_paises")
def listar_paises_options():
    return {"message": "OK"}

@app.post("/listar_paises", response_model=ListarPaisesOut)
def listar_paises(
    payload: CentroIn
):
    sql = f"""SELECT DISTINCT pais as item
              FROM `{PROJECT_ID}.{DATASET_ID}.T_DIRECCIONES`
              order by pais"""
    query_job = client.query(sql)
    results = query_job.result()
    
    out = []
    for row in results:
        out.append(row.item)
    
    return ListarPaisesOut(client_id=payload.centro_id, paises=out, success=True)

@app.options("/listar_ccaas")
def listar_ccaas_options():
    return {"message": "OK"}

@app.post("/listar_ccaas", response_model=ListarCCAAsOut)
def listar_ccaas(
    payload: CentroPaisIn
):
    sql = f"""SELECT DISTINCT ccaa as item
              FROM `{PROJECT_ID}.{DATASET_ID}.T_DIRECCIONES` 
              WHERE pais = '{payload.pais}'
              order by ccaa"""
    query_job = client.query(sql)
    results = query_job.result()
    
    out = []
    for row in results:
        out.append(row.item)
    
    return ListarCCAAsOut(client_id=payload.centro_id, ccaa=out, success=True)

@app.options("/listar_provincias")
def listar_provincias_options():
    return {"message": "OK"}

@app.post("/listar_provincias", response_model=ListarProvinciasOut)
def listar_provincias(
    payload: CentroCCAAIn
):
    sql = f"""SELECT DISTINCT provincia as item
              FROM `{PROJECT_ID}.{DATASET_ID}.T_DIRECCIONES` 
              WHERE pais = '{payload.pais}' and ccaa = '{payload.ccaa}'
              ORDER BY provincia"""
    query_job = client.query(sql)
    results = query_job.result()
    
    out = []
    for row in results:
        out.append(row.item)
    
    return ListarProvinciasOut(client_id=payload.centro_id, provincias=out, success=True)

@app.options("/listar_municipios")
def listar_municipios_options():
    return {"message": "OK"}

@app.post("/listar_municipios", response_model=ListarMunicipiosOut)
def listar_municipios(
    payload: CentroProvinciaIn
):
    sql = f"""SELECT DISTINCT municipio as item
              FROM `{PROJECT_ID}.{DATASET_ID}.T_DIRECCIONES` 
              WHERE pais = '{payload.pais}' and ccaa = '{payload.ccaa}' and provincia = '{payload.provincia}'
              order by municipio"""
    query_job = client.query(sql)
    results = query_job.result()
    
    out = []
    for row in results:
        out.append(row.item)
    
    return ListarMunicipiosOut(client_id=payload.centro_id, municipios=out, success=True)

@app.options("/listar_curriculums")
def listar_curriculums_options():
    return {"message": "OK"}

@app.post("/listar_curriculums", response_model=ListarCurriculumsOut)
def listar_curriculums(
    payload: CentroIn
):

    sql = f"""SELECT DISTINCT nombre , fecha, descripcion, metaprompt
                FROM `{PROJECT_ID}.{DATASET_ID}.T_CURRICULUMS` 
                WHERE centro_id = '{payload.centro_id}'"""
    query_job = client.query(sql)
    results = query_job.result()

    curriculums = []
    for row in results:
        curriculums.append(Curriculums(
            nombre=row.nombre,
            fecha=row.fecha,
            descripcion=row.descripcion,
            metaprompt=row.metaprompt
        ))

    return ListarCurriculumsOut(centro_id=payload.centro_id, curriculums=curriculums, success=True)

@app.options("/crear_curriculums")
def crear_curriculums_options():
    return {"message": "OK"}

@app.post("/crear_curriculums", response_model=SuccessOut)
def crear_curriculums(
    payload: CurriculumIn
):

    filename = f"{payload.centro_id}/{payload.nombre}"
    # Subir PDF a GCS
    try:
        if ',' in payload.base64_pdf:
            base64_data = payload.base64_pdf.split(',')[1]
        else:
            base64_data = payload.base64_pdf
        
        pdf_data = base64.b64decode(base64_data)
        
        bucket = storage_client.bucket(GCS_BUCKET_CURRICULUMS)
        blob = bucket.blob(filename)
        blob.upload_from_string(pdf_data, content_type='application/pdf')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error subiendo PDF: {str(e)}")

    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_CURRICULUMS` (centro_id, nombre, descripcion,metaprompt,fecha) VALUES ('{payload.centro_id}', '{payload.nombre}', '{payload.descripcion}', '{payload.metaprompt}', CAST(CURRENT_TIMESTAMP() AS STRING))"""
    job = client.query(sql)
    job.result()

    return SuccessOut(success=True)

@app.options("/borrar_curriculums")
def borrar_curriculums_options():
    return {"message": "OK"}

@app.post("/borrar_curriculums", response_model=SuccessOut)
def borrar_curriculums(
    payload: CurriculumBorrarIn
):

    filename = f"{payload.centro_id}/{payload.nombre}"
    delete_from_gcs(filename, GCS_BUCKET_CURRICULUMS)

    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_CURRICULUMS` 
                WHERE centro_id = '{payload.centro_id}' AND nombre = '{payload.nombre}'"""
    query_job = client.query(sql)
    query_job.result()

    return SuccessOut(success=True)

@app.options("/listar_clases_profesores")
def listar_clases_profesores_options():
    return {"message": "OK"}

@app.post("/listar_clases_profesores", response_model=ListarClasesOut)
def listar_clases_profesores(
    payload: ProfesorIn
):
    
    sql = f"""SELECT distinct clase FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` WHERE id_centro = '{payload.centro_id}' AND id_profesor = '{payload.profesor_id}'"""
    query_job = client.query(sql)
    results = query_job.result()

    clases = [row.clase for row in results]

    return ListarClasesOut(centro_id=payload.centro_id, clases=clases, success=True)

@app.options("/listar_asignaturas_profesores")
def listar_asignaturas_profesores_options():
    return {"message": "OK"}

@app.post("/listar_asignaturas_profesores", response_model=ListarAsignaturasProfesorOut)
def listar_asignaturas_profesores(
    payload: ProfesorClaseIn
):
    
    sql = f"""SELECT distinct asignatura FROM `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS_PROFESORES` WHERE id_centro = '{payload.centro_id}' AND id_profesor = '{payload.profesor_id}' and clase = '{payload.clase}'"""
    query_job = client.query(sql)
    results = query_job.result()

    asignaturas = [row.asignatura for row in results]

    return ListarAsignaturasProfesorOut(centro_id=payload.centro_id, asignaturas=asignaturas, success=True)

@app.options("/generar_programacion")
def generar_programacion_options():
    return {"message": "OK"}

@app.post("/generar_programacion", response_model=SuccessOut)
def generar_programacion(
    payload: GenerarProgramacionIn
):
    # Lanzamos la llamada a Cloud Tasks:
    message_data = {
        "centro_id": payload.centro_id,
        "clase": payload.clase,
        "asignatura": payload.asignatura,
        "num_unidades": payload.num_unidades,
        "curriculums": payload.curriculums,
        "consideraciones_adicionales": payload.consideraciones_adicionales or "",
        "action": "generar_programacion"
    }
    
    # Crear tarea HTTP en Cloud Tasks
    parent = tasks_client.queue_path(PROJECT_ID, REGION, "programaciones-worker-task-queue")
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": "https://odiseia-gw-programaciones-worker-baej0f92.ew.gateway.dev",
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(message_data, ensure_ascii=False).encode('utf-8'),
        }
    }
    
    response = tasks_client.create_task(parent=parent, task=task)
    print(f"Tarea creada: {response.name}")

    return SuccessOut(success=True)

@app.options("/generar_secciones")
def generar_secciones_options():
    return {"message": "OK"}

@app.post("/generar_secciones", response_model=SuccessOut)
def generar_secciones(
    payload: GenerarSeccionesIn
):
    # Lanzamos la llamada a Cloud Tasks:
    message_data = {
        "centro_id": payload.centro_id,
        "clase": payload.clase,
        "asignatura": payload.asignatura,
        "unidad": payload.unidad,
        "num_secciones": payload.num_secciones,
        "consideraciones_adicionales": payload.consideraciones_adicionales or "",
        "action": "generar_secciones"
    }
    
    # Crear tarea HTTP en Cloud Tasks
    parent = tasks_client.queue_path(PROJECT_ID, REGION, "secciones-worker-task-queue")
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": "https://odiseia-gw-secciones-worker-baej0f92.ew.gateway.dev",
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(message_data, ensure_ascii=False).encode('utf-8'),
        }
    }
    
    response = tasks_client.create_task(parent=parent, task=task)
    print(f"Tarea creada: {response.name}")

    return SuccessOut(success=True)

@app.options("/generar_contenido")
def generar_contenido_options():
    return {"message": "OK"}

@app.post("/generar_contenido", response_model=SuccessOut)
def generar_contenido(
    payload: GenerarSeccionesIn
):
    # Lanzamos la llamada a Cloud Tasks:
    message_data = {
        "centro_id": payload.centro_id,
        "clase": payload.clase,
        "asignatura": payload.asignatura,
        "unidad": payload.unidad,
        "action": "generar_contenido"
    }
    
    # Crear tarea HTTP en Cloud Tasks
    parent = tasks_client.queue_path(PROJECT_ID, REGION, "contenido-worker-task-queue")
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": "https://odiseia-gw-contenido-worker-baej0f92.ew.gateway.dev",
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(message_data, ensure_ascii=False).encode('utf-8'),
        }
    }
    
    response = tasks_client.create_task(parent=parent, task=task)
    print(f"Tarea creada: {response.name}")

    return SuccessOut(success=True)

@app.options("/generar_ejercicio")
def generar_ejercicio_options():
    return {"message": "OK"}

@app.post("/generar_ejercicio", response_model=SuccessOut)
def generar_ejercicio(
    payload: GenerarEjercicioIn
):
    if not payload.alumno_id:
        raise HTTPException(status_code=400, detail="Missing alumno_id")
    
    # Crear Cloud Task para Ejercicio Worker
    message_data = {
        "centro_id": payload.centro_id,
        "alumno_id": payload.alumno_id,
        "clase": payload.clase,
        "asignatura": payload.asignatura,
        "unidad": payload.unidad,
        "action": "generar_ejercicio"
    }
    
    # Crear tarea HTTP en Cloud Tasks
    parent = tasks_client.queue_path(PROJECT_ID, REGION, "ejercicio-worker-task-queue")
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": "https://odiseia-gw-ejercicio-worker-baej0f92.ew.gateway.dev",
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(message_data, ensure_ascii=False).encode('utf-8'),
        }
    }
    
    response = tasks_client.create_task(parent=parent, task=task)
    print(f"Tarea de ejercicio creada: {response.name}")

    return SuccessOut(success=True)

@app.options("/corregir_ejercicio")
def corregir_ejercicio_options():
    return {"message": "OK"}

@app.post("/corregir_ejercicio", response_model=SuccessOut)
def corregir_ejercicio(
    payload: CorregirEjercicioIn
):
    if not payload.alumno_id:
        raise HTTPException(status_code=400, detail="Missing alumno_id")
    if not payload.id_ejercicio:
        raise HTTPException(status_code=400, detail="Missing id_ejercicio")
    if not payload.imagen_base64:
        raise HTTPException(status_code=400, detail="Missing imagen_base64")
    
    # Guardar imagen temporalmente en GCS    
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    temp_filename = f"temp_correcciones/{payload.alumno_id}_{payload.id_ejercicio}_{timestamp}.png"
    
    # Decodificar base64 y guardar en GCS
    imagen_bytes = base64.b64decode(payload.imagen_base64)
    bucket = storage_client.bucket(GCS_BUCKET_EJERCICIO_TMP)
    blob = bucket.blob(temp_filename)
    blob.upload_from_string(imagen_bytes, content_type="image/png")
    
    print(f"Imagen temporal guardada en GCS: {temp_filename}")
    
    # Crear Cloud Task para Ejercicio Corrector Worker
    message_data = {
        "centro_id": payload.centro_id,
        "alumno_id": payload.alumno_id,
        "clase": payload.clase,
        "asignatura": payload.asignatura,
        "unidad": payload.unidad,
        "id_ejercicio": payload.id_ejercicio,
        "imagen_gcs_path": temp_filename,  # Enviar path en lugar de base64
        "action": "corregir_ejercicio"
    }
    
    # Crear tarea HTTP en Cloud Tasks
    parent = tasks_client.queue_path(PROJECT_ID, REGION, "ejercicio-corrector-worker-task-queue")
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": "https://odiseia-gw-ejercicio-corrector-worker-baej0f92.ew.gateway.dev",
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(message_data, ensure_ascii=False).encode('utf-8'),
        }
    }
    
    response = tasks_client.create_task(parent=parent, task=task)
    print(f"Tarea de corrección creada: {response.name}")

    return SuccessOut(success=True)

@app.options("/generar_trabajo")
def generar_trabajo_options():
    return {"message": "OK"}

@app.post("/generar_trabajo", response_model=SuccessOut)
def generar_trabajo(payload: GenerarTrabajoIn):
    message_data = {
        "centro_id": payload.centro_id,
        "alumno_id": payload.alumno_id,
        "clase": payload.clase,
        "asignatura": payload.asignatura,
        "unidad": payload.unidad,
        "action": "generar_trabajo"
    }
    parent = tasks_client.queue_path(PROJECT_ID, REGION, "trabajo-worker-task-queue")
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": "https://odiseia-gw-trabajo-worker-baej0f92.ew.gateway.dev",
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(message_data, ensure_ascii=False).encode('utf-8'),
        }
    }
    response = tasks_client.create_task(parent=parent, task=task)
    return SuccessOut(success=True)

@app.options("/corregir_trabajo")
def corregir_trabajo_options():
    return {"message": "OK"}

@app.post("/corregir_trabajo", response_model=SuccessOut)
def corregir_trabajo(payload: CorregirTrabajoIn):
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    temp_filename = f"temp_correcciones/{payload.alumno_id}_{payload.id_trabajo}_{timestamp}.png"
    imagen_bytes = base64.b64decode(payload.imagen_base64)
    bucket = storage_client.bucket(GCS_BUCKET_TRABAJO_TMP)
    blob = bucket.blob(temp_filename)
    blob.upload_from_string(imagen_bytes, content_type="image/png")

    message_data = {
        "centro_id": payload.centro_id,
        "alumno_id": payload.alumno_id,
        "clase": payload.clase,
        "asignatura": payload.asignatura,
        "unidad": payload.unidad,
        "id_trabajo": payload.id_trabajo,
        "imagen_gcs_path": temp_filename,
        "action": "corregir_trabajo"
    }
    parent = tasks_client.queue_path(PROJECT_ID, REGION, "trabajo-corrector-worker-task-queue")
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": "https://odiseia-gw-trabajo-corrector-worker-baej0f92.ew.gateway.dev",
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(message_data, ensure_ascii=False).encode('utf-8'),
        }
    }
    response = tasks_client.create_task(parent=parent, task=task)
    return SuccessOut(success=True)

@app.options("/listar_programaciones")
def listar_programaciones_options():
    return {"message": "OK"}

@app.post("/listar_programaciones")
def listar_programaciones(
    payload: ProfesorIn
):
    sql = f"""
    SELECT
        clase,
        asignatura,
        curriculums
    FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES` 
    WHERE centro_id = '{payload.centro_id}'
    order by clase, asignatura
    """
    query_job = client.query(sql)
    results = query_job.result()

    programaciones = []
    for row in results:
        programaciones.append(ProgramacionItemList(
            clase=row.clase,
            asignatura=row.asignatura,
            curriculums=row.curriculums
        ))

    return ListarProgramacionesDetalleOut(
        centro_id=payload.centro_id,
        profesor_id=payload.profesor_id,
        programaciones=programaciones,
        success=True
    )

@app.options("/listar_unidades_programaciones")
def listar_unidades_programaciones_options():
    return {"message": "OK"}

@app.post("/listar_unidades_programaciones")
def listar_unidades_programaciones(
    payload: ProfesorClaseIn
):
    sql = f"""
    SELECT 
        unidad, 
        titulo, 
        contenido,
        status
    FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES` 
    WHERE centro_id = '{payload.centro_id}' 
    AND clase = '{payload.clase}'
    AND asignatura = '{payload.asignatura}'
    ORDER BY CAST(unidad AS INT64)
    """
    query_job = client.query(sql)
    results = query_job.result()

    unidades = []
    for row in results:
        unidades.append(ProgramacionUnidad(
            unidad=row.unidad,
            titulo=row.titulo,
            contenido=row.contenido,
            status=row.status
        ))

    return ListarProgramacionesUnidadesDetalleOut(
        centro_id=payload.centro_id,
        profesor_id=payload.profesor_id,
        unidades=unidades,
        success=True
    )

@app.options("/listar_unidades_contenido_formativo")
def listar_unidades_contenido_formativo_options():
    return {"message": "OK"}

@app.post("/listar_unidades_contenido_formativo")
def listar_unidades_contenido_formativo(
    payload: ProfesorClaseIn
):
    # Solo mostrar unidades con status=true y que tengan al menos una sección con status=true
    # Verificar si hay contenido creado en T_CONTENIDO_DISPONIBLE
    sql = f"""
    SELECT DISTINCT
        u.unidad, 
        u.titulo, 
        u.contenido,
        u.status,
        CASE 
            WHEN EXISTS (
                SELECT 1 
                FROM `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE` c
                WHERE c.centro_id = u.centro_id
                AND c.clase = u.clase
                AND c.asignatura = u.asignatura
                AND c.unidad = CAST(u.unidad AS INT64)
                AND c.flag_creado = true
            ) THEN true
            ELSE false
        END AS flag_created
    FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES` u
    INNER JOIN `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES_SECCIONES` s
        ON u.centro_id = s.centro_id
        AND u.clase = s.clase
        AND u.asignatura = s.asignatura
        AND u.unidad = s.unidad
    WHERE u.centro_id = '{payload.centro_id}'
    AND u.clase = '{payload.clase}'
    AND u.asignatura = '{payload.asignatura}'
    AND u.status = true
    AND s.status = true
    ORDER BY CAST(u.unidad AS INT64)
    """
    query_job = client.query(sql)
    results = query_job.result()

    unidades = []
    for row in results:
        unidades.append(ProgramacionUnidad(
            unidad=row.unidad,
            titulo=row.titulo,
            contenido=row.contenido,
            status=row.status,
            flag_created=row.flag_created
        ))

    return ListarProgramacionesUnidadesDetalleOut(
        centro_id=payload.centro_id,
        profesor_id=payload.profesor_id,
        unidades=unidades,
        success=True
    )

@app.options("/modificar_unidad_programacion")
def modificar_unidad_programacion_options():
    return {"message": "OK"}

@app.post("/modificar_unidad_programacion", response_model=ModificarUnidadProgramacionOut)
def modificar_unidad_programacion(
    payload: ModificarUnidadProgramacionIn
):
    
    # Usar parámetros parametrizados para evitar problemas con saltos de línea y comillas
    sql = f"""
    UPDATE `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES`
    SET titulo = @titulo,
        contenido = @contenido
    WHERE centro_id = @centro_id
    AND clase = @clase
    AND asignatura = @asignatura
    AND unidad = @unidad
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("titulo", "STRING", payload.titulo),
            bigquery.ScalarQueryParameter("contenido", "STRING", payload.contenido),
            bigquery.ScalarQueryParameter("centro_id", "STRING", payload.centro_id),
            bigquery.ScalarQueryParameter("clase", "STRING", payload.clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", payload.asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", payload.unidad),
        ]
    )
    
    query_job = client.query(sql, job_config=job_config)
    query_job.result()
    
    return ModificarUnidadProgramacionOut(success=True)

@app.options("/validar_unidad_programacion")
def validar_unidad_programacion_options():
    return {"message": "OK"}

@app.post("/validar_unidad_programacion", response_model=ValidarUnidadProgramacionOut)
def validar_unidad_programacion(
    payload: ValidarUnidadProgramacionIn
):
    
    # Actualizar el status a true
    sql = f"""
    UPDATE `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES`
    SET status = true
    WHERE centro_id = @centro_id
    AND clase = @clase
    AND asignatura = @asignatura
    AND unidad = @unidad
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", payload.centro_id),
            bigquery.ScalarQueryParameter("clase", "STRING", payload.clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", payload.asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", payload.unidad),
        ]
    )
    
    query_job = client.query(sql, job_config=job_config)
    query_job.result()
    
    return ValidarUnidadProgramacionOut(success=True)

@app.options("/listar_secciones")
def listar_secciones_options():
    return {"message": "OK"}

@app.post("/listar_secciones", response_model=ListarSeccionesOut)
def listar_secciones(
    payload: ListarSeccionesIn
):
    sql = f"""
    SELECT 
        seccion, 
        titulo, 
        contenido,
        status
    FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES_SECCIONES` 
    WHERE centro_id = '{payload.centro_id}'
    AND clase = '{payload.clase}'
    AND asignatura = '{payload.asignatura}'
    AND unidad = {payload.unidad}
    ORDER BY CAST(seccion AS INT64)
    """
    query_job = client.query(sql)
    results = query_job.result()

    secciones = []
    for row in results:
        secciones.append(SeccionItem(
            seccion=int(row.seccion),
            titulo=row.titulo,
            contenido=row.contenido,
            status=row.status
        ))

    return ListarSeccionesOut(
        centro_id=payload.centro_id,
        profesor_id=payload.profesor_id,
        clase=payload.clase,
        asignatura=payload.asignatura,
        unidad=payload.unidad,
        secciones=secciones,
        success=True
    )

@app.options("/validar_seccion_programacion")
def validar_seccion_programacion_options():
    return {"message": "OK"}

@app.post("/validar_seccion_programacion", response_model=ValidarSeccionProgramacionOut)
def validar_seccion_programacion(
    payload: ValidarSeccionProgramacionIn
):
    
    # Actualizar el status a true
    sql = f"""
    UPDATE `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES_SECCIONES`
    SET status = true
    WHERE centro_id = @centro_id
    AND clase = @clase
    AND asignatura = @asignatura
    AND unidad = @unidad
    AND seccion = @seccion
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", payload.centro_id),
            bigquery.ScalarQueryParameter("clase", "STRING", payload.clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", payload.asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", payload.unidad),
            bigquery.ScalarQueryParameter("seccion", "STRING", str(payload.seccion)),
        ]
    )
    
    query_job = client.query(sql, job_config=job_config)
    query_job.result()
    
    return ValidarSeccionProgramacionOut(success=True)

@app.options("/modificar_seccion_programacion")
def modificar_seccion_programacion_options():
    return {"message": "OK"}

@app.post("/modificar_seccion_programacion", response_model=ModificarSeccionProgramacionOut)
def modificar_seccion_programacion(
    payload: ModificarSeccionProgramacionIn
):
    
    # Usar parámetros parametrizados para evitar problemas con saltos de línea y comillas
    sql = f"""
    UPDATE `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES_SECCIONES`
    SET titulo = @titulo,
        contenido = @contenido
    WHERE centro_id = @centro_id
    AND clase = @clase
    AND asignatura = @asignatura
    AND unidad = @unidad
    AND seccion = @seccion
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("titulo", "STRING", payload.titulo),
            bigquery.ScalarQueryParameter("contenido", "STRING", payload.contenido),
            bigquery.ScalarQueryParameter("centro_id", "STRING", payload.centro_id),
            bigquery.ScalarQueryParameter("clase", "STRING", payload.clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", payload.asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", payload.unidad),
            bigquery.ScalarQueryParameter("seccion", "STRING", str(payload.seccion)),
        ]
    )
    
    query_job = client.query(sql, job_config=job_config)
    query_job.result()
    
    return ModificarSeccionProgramacionOut(success=True)

@app.options("/listar_contenidos_unidad")
def listar_contenidos_unidad_options():
    return {"message": "OK"}

@app.post("/listar_contenidos_unidad", response_model=ListarContenidosUnidadOut)
def listar_contenidos_unidad(
    payload: ListarContenidosUnidadIn
):
    """
    Lista los contenidos HTML generados para una unidad específica.
    Retorna las secciones con sus URLs de contenido en GCS.
    """
    # Obtener título de la unidad desde T_PROGRAMACIONES_UNIDADES
    sql = f"""
    SELECT DISTINCT titulo
    FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES`
    WHERE centro_id = @centro_id
    AND clase = @clase
    AND asignatura = @asignatura
    AND unidad = @unidad
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", payload.centro_id),
            bigquery.ScalarQueryParameter("clase", "STRING", payload.clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", payload.asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", payload.unidad),
        ]
    )
    
    query_job = client.query(sql, job_config=job_config)
    results = list(query_job.result())
    
    if not results:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    
    titulo_unidad = results[0].titulo
    
    # Obtener títulos de secciones desde T_PROGRAMACIONES_UNIDADES_SECCIONES
    sql_secciones = f"""
    SELECT seccion, titulo
    FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES_SECCIONES`
    WHERE centro_id = @centro_id
    AND clase = @clase
    AND asignatura = @asignatura
    AND unidad = @unidad
    ORDER BY seccion
    """
    
    query_job_secciones = client.query(sql_secciones, job_config=job_config)
    secciones_titulos = {row.seccion: row.titulo for row in query_job_secciones.result()}
    
    # Listar archivos HTML en el bucket usando el número de unidad (no el título)
    bucket = storage_client.bucket(GCS_BUCKET_CONTENIDO)
    prefix = f"{payload.centro_id}/{payload.clase}/{payload.asignatura}/{payload.unidad}/"
    blobs = bucket.list_blobs(prefix=prefix)
    
    # Variable para la URL del audio (se genera una sola vez)
    url_audio_unidad = None
    
    contenidos = []
    for blob in blobs:
        if blob.name.endswith('.html'):
            # Generar URL del audio solo la primera vez

            audio_path=blob.name.replace('.html', '.mp3')
            audio_blob = bucket.blob(audio_path)
            if audio_blob.exists():
                url_audio_firmada = audio_blob.generate_signed_url(
                    version="v4",
                    expiration=CONTENT_SECONDS_ACCESS,
                    method="GET"
                )
            else:
                url_audio_firmada = ""
            
            # Extraer nombre de sección del path
            seccion_nombre = blob.name.split('/')[-1].replace('.html', '')
            
            # Obtener título de la sección desde la base de datos
            titulo_seccion = secciones_titulos.get(seccion_nombre, seccion_nombre)
            
            # Generar URL firmada válida por 1 hora
            url_firmada = blob.generate_signed_url(
                version="v4",
                expiration=CONTENT_SECONDS_ACCESS,
                method="GET"
            )
            
            contenidos.append(ContenidoSeccionItem(
                seccion=seccion_nombre,
                titulo=titulo_seccion,
                url_contenido=url_firmada,
                url_audio=url_audio_firmada
            ))
    
    return ListarContenidosUnidadOut(
        centro_id=payload.centro_id,
        clase=payload.clase,
        asignatura=payload.asignatura,
        unidad=payload.unidad,
        titulo_unidad=titulo_unidad,
        contenidos=contenidos,
        success=True
    )

@app.options("/obtener_contenido_html")
def obtener_contenido_html_options():
    return {"message": "OK"}

@app.post("/obtener_contenido_html", response_model=ObtenerContenidoHtmlOut)
def obtener_contenido_html(
    payload: ObtenerContenidoHtmlIn
):
    """
    Obtiene el contenido HTML completo de una sección específica desde GCS.
    """
    # Construir path del archivo usando el número de unidad (no el título)
    blob_path = f"{payload.centro_id}/{payload.clase}/{payload.asignatura}/{payload.unidad}/{payload.seccion}.html"
    
    bucket = storage_client.bucket(GCS_BUCKET_CONTENIDO)
    blob = bucket.blob(blob_path)
    
    if not blob.exists():
        raise HTTPException(status_code=404, detail=f"Contenido no encontrado: {blob_path}")
    
    # Descargar contenido HTML
    html_content = blob.download_as_text(encoding='utf-8')
    
    return ObtenerContenidoHtmlOut(
        html_content=html_content,
        success=True
    )

@app.options("/validar_contenido")
def validar_contenido_options():
    return {"message": "OK"}

@app.post("/validar_contenido", response_model=ValidarContenidoOut)
def validar_contenido(
    payload: ValidarContenidoIn
):
    
    # Actualizar flag_aprobado a true
    sql = f"""
    UPDATE `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE`
    SET flag_aprobado = true
    WHERE centro_id = @centro_id
    AND clase = @clase
    AND asignatura = @asignatura
    AND unidad = @unidad
    AND seccion = @seccion
    AND tipo = @tipo
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", payload.centro_id),
            bigquery.ScalarQueryParameter("clase", "STRING", payload.clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", payload.asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", payload.unidad),
            bigquery.ScalarQueryParameter("seccion", "STRING", payload.seccion),
            bigquery.ScalarQueryParameter("tipo", "STRING", "Contenido Formativo"),
        ]
    )
    
    query_job = client.query(sql, job_config=job_config)
    query_job.result()
    
    return ValidarContenidoOut(success=True)

@app.options("/listar_asignaturas_contenido_alumno")
def listar_asignaturas_contenido_alumno_options():
    return {"message": "OK"}

@app.post("/listar_asignaturas_contenido_alumno", response_model=ListarAsignaturasContenidoAlumnoOut)
def listar_asignaturas_contenido_alumno(
    payload: ListarAsignaturasContenidoAlumnoIn
):
    sql = f"""
    SELECT DISTINCT 
        v.asignatura, 
        v.clase,
        a.descripcion
    FROM `{PROJECT_ID}.{DATASET_ID}.V_CONTENIDO_DISPONIBLE_ALUMNOS` v
    LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS` a
        ON v.id_centro = a.id_centro
        AND v.asignatura = a.asignatura
    WHERE v.id_centro = '{payload.centro_id}' 
    AND v.id_alumno = '{payload.alumno_id}'
    ORDER BY v.clase, v.asignatura
    """
    
    query_job = client.query(sql)
    results = query_job.result()
    
    asignaturas = []
    for row in results:
        # Descargar imagen en base64 desde GCS
        base64_data = download_base64_from_gcs(
            payload.centro_id + '/' + row.asignatura + '.png',
            GCS_BUCKET_ASIGNATURAS
        )
        asignaturas.append(AsignaturaConContenido(
            asignatura=row.asignatura,
            clase=row.clase,
            imagebase64=base64_data,
            descripcion=row.descripcion if row.descripcion else ""
        ))
    
    return ListarAsignaturasContenidoAlumnoOut(
        centro_id=payload.centro_id,
        alumno_id=payload.alumno_id,
        asignaturas=asignaturas,
        success=True
    )

@app.options("/listar_unidades_disponibles_alumno")
def listar_unidades_disponibles_alumno_options():
    return {"message": "OK"}

class ListarUnidadesDisponiblesAlumnoIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None

class UnidadDisponibleAlumno(BaseModel):
    unidad: int
    titulo: str
    contenido: str

class ListarUnidadesDisponiblesAlumnoOut(BaseModel):
    centro_id: str
    alumno_id: str
    unidades: list[UnidadDisponibleAlumno]
    success: bool

@app.post("/listar_unidades_disponibles_alumno", response_model=ListarUnidadesDisponiblesAlumnoOut)
def listar_unidades_disponibles_alumno(
    payload: ListarUnidadesDisponiblesAlumnoIn
):
    # Consultar vista V_CONTENIDO_DISPONIBLE_ALUMNOS y agrupar por unidad
    sql = f"""
    SELECT DISTINCT 
        v.unidad,
        u.titulo,
        u.contenido
    FROM `{PROJECT_ID}.{DATASET_ID}.V_CONTENIDO_DISPONIBLE_ALUMNOS` v
    INNER JOIN `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES` u
        ON v.id_centro = u.centro_id
        AND v.clase = u.clase
        AND v.asignatura = u.asignatura
        AND v.unidad = u.unidad
    WHERE v.id_centro = '{payload.centro_id}'
    AND v.id_alumno = '{payload.alumno_id}'
    AND v.clase = '{payload.clase}'
    AND v.asignatura = '{payload.asignatura}'
    ORDER BY v.unidad
    """
    
    query_job = client.query(sql)
    results = query_job.result()
    
    unidades = []
    for row in results:
        unidades.append(UnidadDisponibleAlumno(
            unidad=row.unidad,
            titulo=row.titulo,
            contenido=row.contenido
        ))
    
    return ListarUnidadesDisponiblesAlumnoOut(
        centro_id=payload.centro_id,
        alumno_id=payload.alumno_id,
        unidades=unidades,
        success=True
    )

@app.options("/listar_ejercicios_alumno")
def listar_ejercicios_alumno_options():
    return {"message": "OK"}

class ListarEjerciciosAlumnoIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None

class EjercicioAlumno(BaseModel):
    id: str
    nota: str
    comentarios_alumno: str
    comentarios_profesor: str
    url_html: str
    url_pdf: str
    url_audio_hint: str

class ListarEjerciciosAlumnoOut(BaseModel):
    centro_id: str
    alumno_id: str
    ejercicios: list[EjercicioAlumno]
    titulo_unidad: str
    success: bool

@app.post("/listar_ejercicios_alumno", response_model=ListarEjerciciosAlumnoOut)
def listar_ejercicios_alumno(
    payload: ListarEjerciciosAlumnoIn
):
    # Obtener título de la unidad desde T_PROGRAMACIONES_UNIDADES
    sql_titulo = f"""
    SELECT titulo
    FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES`
    WHERE centro_id = '{payload.centro_id}'
    AND clase = '{payload.clase}'
    AND asignatura = '{payload.asignatura}'
    AND unidad = {payload.unidad}
    LIMIT 1
    """
    
    query_titulo = client.query(sql_titulo)
    result_titulo = query_titulo.result()
    titulo_unidad = f"Unidad {payload.unidad}"
    
    for row in result_titulo:
        titulo_unidad = f"Unidad {payload.unidad}: {row.titulo}"
        break
    
    # Consultar T_CONTENIDO_DISPONIBLE_EJERCICIOS
    sql = f"""
    SELECT 
        id,
        nota,
        comentarios_alumno,
        comentarios_profesor
    FROM `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE_EJERCICIOS`
    WHERE centro_id = '{payload.centro_id}'
    AND alumno_id = '{payload.alumno_id}'
    AND clase = '{payload.clase}'
    AND asignatura = '{payload.asignatura}'
    AND unidad = {payload.unidad}
    ORDER BY CAST(id AS INT64)
    """
    
    query_job = client.query(sql)
    results = query_job.result()
    
    ejercicios = []
    for row in results:
        # Generar URLs firmadas con expiración de 1 hora (3600 segundos)
        html_path = f"{payload.centro_id}/{payload.clase}/{payload.asignatura}/{payload.unidad}/{payload.alumno_id}/{row.id}.html"
        pdf_path = f"{payload.centro_id}/{payload.clase}/{payload.asignatura}/{payload.unidad}/{payload.alumno_id}/{row.id}.pdf"
        audio_hint_path = f"{payload.centro_id}/{payload.clase}/{payload.asignatura}/{payload.unidad}/{payload.alumno_id}/{row.id}.mp3"
        
        url_html = generate_signed_url_from_gcs(html_path, GCS_BUCKET_EJERCICIO, CONTENT_SECONDS_ACCESS)
        url_pdf = generate_signed_url_from_gcs(pdf_path, GCS_BUCKET_EJERCICIO, CONTENT_SECONDS_ACCESS)
        url_audio_hint = generate_signed_url_from_gcs(audio_hint_path, GCS_BUCKET_EJERCICIO, CONTENT_SECONDS_ACCESS)
        
        ejercicios.append(EjercicioAlumno(
            id=row.id,
            nota=row.nota,
            comentarios_alumno=row.comentarios_alumno,
            comentarios_profesor=row.comentarios_profesor,
            url_html=url_html,
            url_pdf=url_pdf,
            url_audio_hint=url_audio_hint
        ))
    
    return ListarEjerciciosAlumnoOut(
        centro_id=payload.centro_id,
        alumno_id=payload.alumno_id,
        ejercicios=ejercicios,
        titulo_unidad=titulo_unidad,
        success=True
    )

@app.options("/listar_microproyectos_alumno")
def listar_microproyectos_alumno_options():
    return {"message": "OK"}

class ListarMicroproyectosAlumnoIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None

class MicroproyectoAlumno(BaseModel):
    id: str
    nota: str
    comentarios_alumno: str
    comentarios_profesor: str
    url_html: str
    url_pdf: str
    url_audio_hint: str

class ListarMicroproyectosAlumnoOut(BaseModel):
    centro_id: str
    alumno_id: str
    microproyectos: list[MicroproyectoAlumno]
    titulo_unidad: str
    success: bool

@app.post("/listar_microproyectos_alumno", response_model=ListarMicroproyectosAlumnoOut)
def listar_microproyectos_alumno(
    payload: ListarMicroproyectosAlumnoIn
):
    # Obtener título de la unidad desde T_PROGRAMACIONES_UNIDADES
    sql_titulo = f"""
    SELECT titulo
    FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES`
    WHERE centro_id = '{payload.centro_id}'
    AND clase = '{payload.clase}'
    AND asignatura = '{payload.asignatura}'
    AND unidad = {payload.unidad}
    LIMIT 1
    """
    
    query_titulo = client.query(sql_titulo)
    result_titulo = query_titulo.result()
    titulo_unidad = f"Unidad {payload.unidad}"
    
    for row in result_titulo:
        titulo_unidad = f"Unidad {payload.unidad}: {row.titulo}"
        break
    
    # Consultar T_CONTENIDO_DISPONIBLE_TRABAJOS
    sql = f"""
    SELECT 
        id,
        nota,
        comentarios_alumno,
        comentarios_profesor
    FROM `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE_TRABAJOS`
    WHERE centro_id = '{payload.centro_id}'
    AND alumno_id = '{payload.alumno_id}'
    AND clase = '{payload.clase}'
    AND asignatura = '{payload.asignatura}'
    AND unidad = {payload.unidad}
    ORDER BY CAST(id AS INT64)
    """
    
    query_job = client.query(sql)
    results = query_job.result()
    
    microproyectos = []
    for row in results:
        # Generar URLs firmadas con expiración de 1 hora (3600 segundos)
        html_path = f"{payload.centro_id}/{payload.clase}/{payload.asignatura}/{payload.unidad}/{payload.alumno_id}/{row.id}.html"
        pdf_path = f"{payload.centro_id}/{payload.clase}/{payload.asignatura}/{payload.unidad}/{payload.alumno_id}/{row.id}.pdf"
        audio_hint_path = f"{payload.centro_id}/{payload.clase}/{payload.asignatura}/{payload.unidad}/{payload.alumno_id}/{row.id}.mp3"
        
        url_html = generate_signed_url_from_gcs(html_path, GCS_BUCKET_TRABAJO, CONTENT_SECONDS_ACCESS)
        url_pdf = generate_signed_url_from_gcs(pdf_path, GCS_BUCKET_TRABAJO, CONTENT_SECONDS_ACCESS)
        url_audio_hint = generate_signed_url_from_gcs(audio_hint_path, GCS_BUCKET_TRABAJO, CONTENT_SECONDS_ACCESS)
        
        microproyectos.append(MicroproyectoAlumno(
            id=row.id,
            nota=row.nota,
            comentarios_alumno=row.comentarios_alumno,
            comentarios_profesor=row.comentarios_profesor,
            url_html=url_html,
            url_pdf=url_pdf,
            url_audio_hint=url_audio_hint
        ))
    
    return ListarMicroproyectosAlumnoOut(
        centro_id=payload.centro_id,
        alumno_id=payload.alumno_id,
        microproyectos=microproyectos,
        titulo_unidad=titulo_unidad,
        success=True
    )

@app.options("/registrar_accion_contenido_html")
def registrar_accion_contenido_html_options():
    return {"message": "OK"}

class RegistrarAccionContenidoIn(BaseModel):
    centro_id: Optional[str] = None
    clase: Optional[str] = None
    asignatura: Optional[str] = None
    unidad: Optional[int] = None
    seccion: Optional[str] = None
    alumno_id: Optional[str] = None

class RegistrarAccionContenidoOut(BaseModel):
    success: bool

@app.post("/registrar_accion_contenido_html", response_model=RegistrarAccionContenidoOut)
def registrar_accion_contenido_html(
    payload: RegistrarAccionContenidoIn
):
    sql = f"""
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ACCION_ALUMNO_CONTENIDO_FORMATIVO_HTML` 
    (centro_id, clase, asignatura, unidad, seccion, alumno_id, timestamp)
    VALUES (
        '{payload.centro_id}',
        '{payload.clase}',
        '{payload.asignatura}',
        {payload.unidad},
        '{payload.seccion}',
        '{payload.alumno_id}',
        CURRENT_TIMESTAMP()
    )
    """
    
    query_job = client.query(sql)
    query_job.result()
    
    return RegistrarAccionContenidoOut(success=True)

@app.options("/registrar_accion_contenido_audio")
def registrar_accion_contenido_audio_options():
    return {"message": "OK"}

@app.post("/registrar_accion_contenido_audio", response_model=RegistrarAccionContenidoOut)
def registrar_accion_contenido_audio(
    payload: RegistrarAccionContenidoIn
):
    sql = f"""
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ACCION_ALUMNO_CONTENIDO_FORMATIVO_AUDIO` 
    (centro_id, clase, asignatura, unidad, seccion, alumno_id, timestamp)
    VALUES (
        '{payload.centro_id}',
        '{payload.clase}',
        '{payload.asignatura}',
        {payload.unidad},
        '{payload.seccion}',
        '{payload.alumno_id}',
        CURRENT_TIMESTAMP()
    )
    """
    
    query_job = client.query(sql)
    query_job.result()
    
    return RegistrarAccionContenidoOut(success=True)

@app.options("/listar_dashboard_ejercicios_profesor")
def listar_dashboard_ejercicios_profesor_options():
    return {"message": "OK"}

@app.post("/listar_dashboard_ejercicios_profesor", response_model=ListarDashboardEjerciciosProfesorOut)
def listar_dashboard_ejercicios_profesor(
    payload: ListarDashboardProfesorIn
):
    sql = f"""
    SELECT 
        clase,
        asignatura,
        unidad,
        alumno_id,
        total_ejercicios,
        ejercicios_resueltos,
        nota_media
    FROM `{PROJECT_ID}.{DATASET_ID}.V_DASHBOARD_EJERCICIOS_PROFESORES`
    WHERE centro_id = '{payload.centro_id}' 
    AND profesor_id = '{payload.profesor_id}'
    ORDER BY clase, asignatura, unidad, alumno_id
    """
    
    query_job = client.query(sql)
    results = query_job.result()
    
    ejercicios = []
    for row in results:
        ejercicios.append(DashboardEjercicioItem(
            clase=row.clase,
            asignatura=row.asignatura,
            unidad=row.unidad,
            alumno_id=row.alumno_id,
            total_ejercicios=row.total_ejercicios,
            ejercicios_resueltos=row.ejercicios_resueltos,
            nota_media=row.nota_media
        ))
    
    return ListarDashboardEjerciciosProfesorOut(
        centro_id=payload.centro_id,
        profesor_id=payload.profesor_id,
        ejercicios=ejercicios,
        success=True
    )

@app.options("/listar_dashboard_trabajos_profesor")
def listar_dashboard_trabajos_profesor_options():
    return {"message": "OK"}

@app.post("/listar_dashboard_trabajos_profesor", response_model=ListarDashboardTrabajosProfesorOut)
def listar_dashboard_trabajos_profesor(
    payload: ListarDashboardProfesorIn
):
    sql = f"""
    SELECT 
        clase,
        asignatura,
        unidad,
        alumno_id,
        total_trabajos,
        trabajos_resueltos,
        nota_media
    FROM `{PROJECT_ID}.{DATASET_ID}.V_DASHBOARD_TRABAJOS_PROFESORES`
    WHERE centro_id = '{payload.centro_id}' 
    AND profesor_id = '{payload.profesor_id}'
    ORDER BY clase, asignatura, unidad, alumno_id
    """
    
    query_job = client.query(sql)
    results = query_job.result()
    
    trabajos = []
    for row in results:
        trabajos.append(DashboardTrabajoItem(
            clase=row.clase,
            asignatura=row.asignatura,
            unidad=row.unidad,
            alumno_id=row.alumno_id,
            total_trabajos=row.total_trabajos,
            trabajos_resueltos=row.trabajos_resueltos,
            nota_media=row.nota_media
        ))
    
    return ListarDashboardTrabajosProfesorOut(
        centro_id=payload.centro_id,
        profesor_id=payload.profesor_id,
        trabajos=trabajos,
        success=True
    )


@app.get("/verificar_consentimiento")
def verificar_consentimiento(user_id: str, centro_id: str):
    sql = f"""
    SELECT COUNT(*) as count 
    FROM `{PROJECT_ID}.{DATASET_ID}.T_CONSENTIMIENTO` 
    WHERE user_id = '{user_id}' AND centro_id = '{centro_id}'
    """
    query_job = client.query(sql)
    result = query_job.result()
    row = next(result)
    
    return {"existe": row.count > 0, "user_id": user_id, "centro_id": centro_id}

@app.options("/registrar_consentimiento")
def registrar_consentimiento_options():
    return {"message": "OK"}

@app.post("/registrar_consentimiento")
def registrar_consentimiento(user_id: str, centro_id: str):
    sql = f"""
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_CONSENTIMIENTO` (user_id, centro_id) 
    VALUES ('{user_id}', '{centro_id}')
    """
    query_job = client.query(sql)
    query_job.result()
    
    return {"success": True, "user_id": user_id, "centro_id": centro_id}

@app.options("/generar_recomendacion_alumno")
def generar_recomendacion_alumno_options():
    return {"message": "OK"}

@app.post("/generar_recomendacion_alumno", response_model=SuccessOut)
def generar_recomendacion_alumno(
    payload: GenerarRecomendacionIn
):
    if not payload.alumno_id:
        raise HTTPException(status_code=400, detail="alumno_id es requerido")
    if not payload.centro_id:
        raise HTTPException(status_code=400, detail="centro_id es requerido")
    if not payload.clase:
        raise HTTPException(status_code=400, detail="clase es requerida")
    if not payload.asignatura:
        raise HTTPException(status_code=400, detail="asignatura es requerida")
    
    # Crear Cloud Task para Recomendador Profesor Worker
    message_data = {
        "centro_id": payload.centro_id,
        "alumno_id": payload.alumno_id,
        "clase": payload.clase,
        "asignatura": payload.asignatura,
        "action": "generar_recomendaciones_profesor"
    }
    
    # Crear tarea HTTP en Cloud Tasks
    parent = tasks_client.queue_path(PROJECT_ID, REGION, "recomendador-profesor-worker-task-queue")
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": "https://odiseia-gw-recomendador-profesor-worker-baej0f92.ew.gateway.dev",
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(message_data, ensure_ascii=False).encode('utf-8'),
        }
    }
    
    response = tasks_client.create_task(parent=parent, task=task)
    print(f"Tarea de recomendación creada: {response.name}")

    return SuccessOut(success=True)

@app.options("/listar_comentarios_alumno")
def listar_comentarios_alumno_options():
    return {"message": "OK"}

@app.post("/listar_comentarios_alumno", response_model=ListarComentariosAlumnoOut)
def listar_comentarios_alumno(
    payload: ListarComentariosAlumnoIn
):
    comentarios = []
    
    # Obtener comentarios de ejercicios
    sql_ejercicios = f"""
    SELECT 
        id,
        timestamp,
        nota,
        comentarios_profesor,
        comentarios_alumno
    FROM `{PROJECT_ID}.{DATASET_ID}.T_ACCION_ALUMNO_EJERCICIO`
    WHERE centro_id = '{payload.centro_id}'
    AND clase = '{payload.clase}'
    AND asignatura = '{payload.asignatura}'
    AND unidad = {payload.unidad}
    AND alumno_id = '{payload.alumno_id}'
    ORDER BY timestamp DESC
    """
    
    query_job = client.query(sql_ejercicios)
    results = query_job.result()
    
    for row in results:
        comentarios.append(ComentarioAlumnoItem(
            id=row.id,
            tipo="ejercicio",
            timestamp=row.timestamp.isoformat(),
            nota=row.nota,
            comentarios_profesor=row.comentarios_profesor,
            comentarios_alumno=row.comentarios_alumno
        ))
    
    # Obtener comentarios de trabajos
    sql_trabajos = f"""
    SELECT 
        id,
        timestamp,
        nota,
        comentarios_profesor,
        comentarios_alumno
    FROM `{PROJECT_ID}.{DATASET_ID}.T_ACCION_ALUMNO_TRABAJO`
    WHERE centro_id = '{payload.centro_id}'
    AND clase = '{payload.clase}'
    AND asignatura = '{payload.asignatura}'
    AND unidad = {payload.unidad}
    AND alumno_id = '{payload.alumno_id}'
    ORDER BY timestamp DESC
    """
    
    query_job = client.query(sql_trabajos)
    results = query_job.result()
    
    for row in results:
        comentarios.append(ComentarioAlumnoItem(
            id=row.id,
            tipo="trabajo",
            timestamp=row.timestamp.isoformat(),
            nota=row.nota,
            comentarios_profesor=row.comentarios_profesor,
            comentarios_alumno=row.comentarios_alumno
        ))
    
    # Ordenar por timestamp descendente
    comentarios.sort(key=lambda x: x.timestamp, reverse=True)
    
    return ListarComentariosAlumnoOut(
        centro_id=payload.centro_id,
        alumno_id=payload.alumno_id,
        comentarios=comentarios,
        success=True
    )

@app.options("/obtener_recomendacion_alumno")
def obtener_recomendacion_alumno_options():
    return {"message": "OK"}

@app.post("/obtener_recomendacion_alumno", response_model=ObtenerRecomendacionAlumnoOut)
def obtener_recomendacion_alumno(
    payload: ObtenerRecomendacionAlumnoIn
):
    # Validar campos requeridos
    if not payload.centro_id or not payload.clase or not payload.asignatura or not payload.alumno_id:
        raise HTTPException(status_code=400, detail="Faltan campos requeridos")
    
    # Obtener la recomendación más reciente para el alumno
    sql = f"""
    SELECT 
        recomendacion
    FROM `{PROJECT_ID}.{DATASET_ID}.T_RECOMENDACIONES_ALUMNO_PROFESOR`
    WHERE centro_id = '{payload.centro_id}'
    AND clase = '{payload.clase}'
    AND asignatura = '{payload.asignatura}'
    AND alumno_id = '{payload.alumno_id}'
    LIMIT 1
    """
    
    query_job = client.query(sql)
    results = query_job.result()
    
    recomendacion = None
    
    for row in results:
        recomendacion = row.recomendacion
        break
    
    return ObtenerRecomendacionAlumnoOut(
        centro_id=payload.centro_id,
        alumno_id=payload.alumno_id,
        recomendacion=recomendacion,
        success=True
    )

@app.options("/obtener_imagen_salida")
def obtener_imagen_salida_options():
    return {"message": "OK"}

@app.post("/obtener_imagen_salida", response_model=ObtenerImagenSalidaOut)
def obtener_imagen_salida(payload: ObtenerImagenSalidaIn):
    try:
        filename = f"{payload.centro_id}/{payload.alumno_id}/{payload.titulo}.png"
        imagebase64 = download_base64_from_gcs(filename, GCS_BUCKET_SALIDAS)
        if not imagebase64:
            imagebase64 = ""
        return ObtenerImagenSalidaOut(imagebase64=imagebase64, success=True)
    except Exception as e:
        print(f"Error en obtener_imagen_salida: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al obtener imagen: {str(e)}")


@app.options("/conversa_yo_futuro")
def conversa_yo_futuro_options():
    return {"message": "OK"}

@app.post("/conversa_yo_futuro", response_model=ConversaYoFuturoOut)
def conversa_yo_futuro(
    payload: ConversaYoFuturoIn
):

    #Analizamos los intereses del lumno:

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
            bigquery.ScalarQueryParameter("id_centro", "STRING", payload.centro_id),
            bigquery.ScalarQueryParameter("id_alumno", "STRING", payload.alumno_id)
        ]
    )
    job = client.query(sql, job_config=job_config)
    intereses = job.to_dataframe()

    texto_tiempo_libre = intereses['texto_tiempo_libre'].iloc[0] if len(intereses) > 0 and 'texto_tiempo_libre' in intereses.columns else ""
    texto_que_te_motiva = intereses['texto_que_te_motiva'].iloc[0] if len(intereses) > 0 and 'texto_que_te_motiva' in intereses.columns else ""
    texto_que_te_ayuda_a_entender = intereses['texto_que_te_ayuda_a_entender'].iloc[0] if len(intereses) > 0 and 'texto_que_te_ayuda_a_entender' in intereses.columns else ""
    texto_que_te_frustra_a_estudiar = intereses['texto_que_te_frustra_a_estudiar'].iloc[0] if len(intereses) > 0 and 'texto_que_te_frustra_a_estudiar' in intereses.columns else ""
    texto_que_asignaturas_se_te_dan_mejor = intereses['texto_que_asignaturas_se_te_dan_mejor'].iloc[0] if len(intereses) > 0 and 'texto_que_asignaturas_se_te_dan_mejor' in intereses.columns else ""
    

    #Procesamos los intereses del alumno:

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

    
    # Obtienes información sobre la salida:

    sql = f"""
    SELECT DISTINCT titulo, horas, requisitos_de_acceso, salidas_profesionales, que_voy_a_aprender, plan_de_formacion, seguir_estudiando, tus_estudios_en_europa FROM`{PROJECT_ID}.{DATASET_ID}.T_SALIDAS_PROFESIONALES`
    WHERE id_salida = @id_salida
    LIMIT 1
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("id_salida", "INT64", payload.salida_id)
        ]
    )
    
    job = client.query(sql, job_config=job_config)
    salida = job.to_dataframe()
    titulo = salida['titulo'].iloc[0] if len(salida) > 0 and 'titulo' in salida.columns else ""
    horas = salida['horas'].iloc[0] if len(salida) > 0 and 'horas' in salida.columns else ""
    requisitos_de_acceso = salida['requisitos_de_acceso'].iloc[0] if len(salida) > 0 and 'requisitos_de_acceso' in salida.columns else ""
    salidas_profesionales = salida['salidas_profesionales'].iloc[0] if len(salida) > 0 and 'salidas_profesionales' in salida.columns else ""
    que_voy_a_aprender = salida['que_voy_a_aprender'].iloc[0] if len(salida) > 0 and 'que_voy_a_aprender' in salida.columns else ""
    plan_de_formacion = salida['plan_de_formacion'].iloc[0] if len(salida) > 0 and 'plan_de_formacion' in salida.columns else ""
    seguir_estudiando = salida['seguir_estudiando'].iloc[0] if len(salida) > 0 and 'seguir_estudiando' in salida.columns else ""
    tus_estudios_en_europa = salida['tus_estudios_en_europa'].iloc[0] if len(salida) > 0 and 'tus_estudios_en_europa' in salida.columns else ""

    #Saneamos el texto de salida:
    texto_salida="\n"
    if horas:
        texto_salida += f"\n-Horas Formativas Grado Básico: {horas}\n"
    if requisitos_de_acceso:
        texto_salida += f"\n -Requisitos de acceso al Grado Básico: {requisitos_de_acceso}\n"
    if salidas_profesionales:
        texto_salida += f"\n -Salidas profesionales tras estudiar el Grado Básico: {salidas_profesionales}\n"
    if que_voy_a_aprender:
        texto_salida += f"\n -¿Qué voy a aprender en el Grado Básico?: {que_voy_a_aprender}\n"
    if plan_de_formacion:
        texto_salida += f"\n -Plan de formación del Grado Básico: {plan_de_formacion}\n"
    if seguir_estudiando:
        texto_salida += f"\n -¿Puedo seguir estudiando tras el Grado Básico?: {seguir_estudiando}\n"
    if tus_estudios_en_europa:
        texto_salida += f"\n -¿Cómo son mis estudios en Europa tras el Grado Básico?: {tus_estudios_en_europa}\n"
    
    #Obtenemos, también alguna antigua experiencia:

    sql = f"""
    SELECT DISTINCT experiencia FROM `{PROJECT_ID}.{DATASET_ID}.T_ANTIGUAS_EXPERIENCIAS`
    WHERE salida_id = @salida_id
    LIMIT 1
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("salida_id", "INT64", payload.salida_id)
        ]
    )

    job = client.query(sql, job_config=job_config)
    experiencias = job.to_dataframe()

    antigua_experiencia = experiencias['experiencia'].iloc[0] if len(experiencias) > 0 and 'experiencia' in experiencias.columns else ""

    #Obtenemos el histórico conversacional:

    sql = f"""
    SELECT DISTINCT role, content, timestamp FROM `{PROJECT_ID}.{DATASET_ID}.T_ANTIGUAS_EXPERIENCIAS_CONVERSACIONES`
    WHERE salida_id = @salida_id
    AND alumno_id=@alumno_id
    ORDER BY timestamp ASC
    """
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("salida_id", "INT64", payload.salida_id),
            bigquery.ScalarQueryParameter("alumno_id", "STRING", payload.alumno_id)
        ]
    )

    job = client.query(sql, job_config=job_config)
    conversacion = job.to_dataframe()


    #Se genera la conversación:

    model = "gemini-2.5-flash"

    system_instruction=[]
    system_instruction.append(genai.types.Part.from_text(text="""Tienes que hacerte pasar por el "yo" del futuro del usuario con el que hablas."""))
    system_instruction.append(genai.types.Part.from_text(text="""Las respuestas generadas son para el "yo" del pasado"""))
    system_instruction.append(genai.types.Part.from_text(text=f"""Para ello vas a simular que el usuario se decidió años atrás por cursar un grado Básico en {titulo}"""))
    system_instruction.append(genai.types.Part.from_text(text=f"""Esta es toda la experiencia que tienes sobre el Grado Básico: {texto_salida}"""))
    if intereses_txt!="":
        system_instruction.append(genai.types.Part.from_text(text=f"""A principios de curso se le realizó al alumno un test para saber sus intereses. Te dejo las respuestas que el alumno proporcionó en dicho test para que pueda sponerse en su papel: {intereses_txt}"""))
    if antigua_experiencia!="":
        system_instruction.append(genai.types.Part.from_text(text=f"""Además de la información, también te basarás en tu antigua experiencia de un alumno que cursó dicho Grado Básico: {antigua_experiencia}"""))
        system_instruction.append(genai.types.Part.from_text(text=f"""Puedes tomas algunas vivencias de esta antigua experiencia y hacerlas tuyas."""))
    system_instruction.append(genai.types.Part.from_text(text="""Tu objetivo es mostrarle la realidad de estudiar el curso de una manera clara y directa peor sin olvidad que el usuario es un alumno de secundaria y que por lo tanto debes utilizar un lenguaje cercano."""))
    system_instruction.append(genai.types.Part.from_text(text="""Deberías conseguir que el alumno se vea motivado a estudiarlo."""))
    system_instruction.append(genai.types.Part.from_text(text="""No respondas a ninguna pregunta que no tenga que ver con el Grado Básico. Si te preguntan algo fuera de lugar dile que lo lamentas pero que no está autorizado a contestar a esas preguntas con el usuario (su "yo" del pasado) y reconduce la conversación hacia el Grado Básico en cuestión."""))
    system_instruction.append(genai.types.Part.from_text(text="""Utiliza ** para encapsular aquellos términos o conceptos en los que queiras enfatizar."""))
    system_instruction.append(genai.types.Part.from_text(text="""Se claro y directo. No repitas la misma pregunta que te haga el usuario. Simplemente proporciona una respuesta. Piensa que hablas con un adolescente y tiene que ser claro y conciso."""))
    system_instruction.append(genai.types.Part.from_text(text=f"""IMPORTANTE: No uses más de {MAX_WORDS_CHAT} palabras en tus respuestas y, siempre que puedeas genera variso párrafos."""))


    generate_content_config = genai.types.GenerateContentConfig(
        temperature = 1,
        top_p = 0.95,
        max_output_tokens = 65535,
        safety_settings = [
            genai.types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",threshold="OFF"),
            genai.types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT",threshold="OFF"),
            genai.types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT",threshold="OFF"),
            genai.types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",threshold="OFF")
        ],
        system_instruction=system_instruction,
        thinking_config=genai.types.ThinkingConfig(
        thinking_budget=-1,
        ),
    )

    contents = []
    for idx, row in conversacion.iterrows():
        if row.role == "user":
            contents.append(genai.types.Content(role="user",parts=[genai.types.Part.from_text(text=row.content)]))
        elif row.role == "assistant":
            contents.append(genai.types.Content(role="assistant",parts=[genai.types.Part.from_text(text=row.content)]))

    contents.append(genai.types.Content(role="user",parts=[genai.types.Part.from_text(text=payload.mensaje)]))


    iter=0
    flag_success=False
    while iter < VERTEX_AI_RETIRES and flag_success==False:
        iter+=1
        try:
            response = client_genai.models.generate_content(model=model,contents=contents,config=generate_content_config)
            print(response,flush=True)
            flag_success = True
            break
        except Exception as e:
            print(f"{e}", flush=True)
            time_sleep.sleep(VERTEX_AI_SECONDS_SLEEP)
    if flag_success==False:
        raise Exception("No se ha podido realizar la llamada a VertexAI")

    respuesta_asistente = response.candidates[0].content.parts[0].text
    
    #Insertamos la conversación en el histórico de convwersaciones de T_ANTIGUAS_EXPERIENCIAS_CONVERSACIONES:
    
    # Insertar mensaje del usuario
    sql_user = f"""
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ANTIGUAS_EXPERIENCIAS_CONVERSACIONES` 
    (salida_id, alumno_id, role, content, timestamp)
    VALUES (@salida_id, @alumno_id, @role, @content, CURRENT_TIMESTAMP())
    """
    job_config_user = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("salida_id", "INT64", payload.salida_id),
            bigquery.ScalarQueryParameter("alumno_id", "STRING", payload.alumno_id),
            bigquery.ScalarQueryParameter("role", "STRING", "user"),
            bigquery.ScalarQueryParameter("content", "STRING", payload.mensaje)
        ]
    )
    job_user = client.query(sql_user, job_config=job_config_user)
    job_user.result()
    
    # Insertar mensaje del asistente
    sql_assistant = f"""
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ANTIGUAS_EXPERIENCIAS_CONVERSACIONES` 
    (salida_id, alumno_id, role, content, timestamp)
    VALUES (@salida_id, @alumno_id, @role, @content, CURRENT_TIMESTAMP())
    """
    job_config_assistant = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("salida_id", "INT64", payload.salida_id),
            bigquery.ScalarQueryParameter("alumno_id", "STRING", payload.alumno_id),
            bigquery.ScalarQueryParameter("role", "STRING", "assistant"),
            bigquery.ScalarQueryParameter("content", "STRING", respuesta_asistente)
        ]
    )
    job_assistant = client.query(sql_assistant, job_config=job_config_assistant)
    job_assistant.result()
    
    return ConversaYoFuturoOut(respuesta=respuesta_asistente)

