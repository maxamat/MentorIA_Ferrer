import os
import base64
from typing import Optional
import requests

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from google.cloud import bigquery, storage,pubsub_v1
from google.oauth2 import service_account
from pathlib import Path
import json

#Se inicializan las variables de entorno:
PROJECT_ID = os.getenv("PROJECT_ID", "")
DATASET_ID = os.getenv("DATASET_ID", "")
REGION = os.getenv("REGION", "")
GCS_BUCKET_ASIGNATURAS = os.getenv("GCS_BUCKET_ASIGNATURAS", "")
GCS_BUCKET_AVATARES = os.getenv("GCS_BUCKET_AVATARES", "")
GCS_BUCKET_SALIDAS = os.getenv("GCS_BUCKET_SALIDAS", "")
GCS_BUCKET_CURRICULUMS = os.getenv("GCS_BUCKET_CURRICULUMS", "")
IA_ENDPOINT_URL = os.getenv("IA_ENDPOINT_URL", "")
IA_ENDPOINT_API_KEY = os.getenv("IA_ENDPOINT_API_KEY", "")

app = FastAPI(title="App API (Database)", version="1.0")

#Se obtiene el directorio de las credenciales de Google Cloud:
SCRIPT_DIR = Path(__file__).parent
GOOGLE_CREDENTIALS = "credentials/credentials.json"
GOOGLE_CREDENTIALS_PATH = SCRIPT_DIR / GOOGLE_CREDENTIALS

#Se inicializa el cliente de BigQuery:
credentials = service_account.Credentials.from_service_account_file(str(GOOGLE_CREDENTIALS_PATH))
client = bigquery.Client(project=PROJECT_ID, credentials=credentials)

# Inicializar cliente de Cloud Storage:
storage_client = storage.Client(project=PROJECT_ID, credentials=credentials)

#Inicializar PubSub:
publisher = pubsub_v1.PublisherClient(credentials=credentials)

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
            bigquery.SchemaField("titulo", "STRING", mode="REQUIRED"),
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
        ]
        table = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}", schema=schema)
        try:
            client.get_table(f"{PROJECT_ID}.{DATASET_ID}.{table_name}")
        except Exception:
            client.create_table(table, timeout=30)

        # Crear tabla de configuración de avatar de los alumnos si no existe
        table_name = "T_ALUMNO_AVATAR"
        schema = [
            bigquery.SchemaField("color_pelo", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("color_ojos", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("color_piel", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("color_labios", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("color_camiseta", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("genero", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("tipo_peinado", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_alumno", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_centro", "STRING", mode="REQUIRED"),
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

        # Crear tabla de salidas profesionales:
        table_name = "T_ALUMNOS_SALIDAS"
        schema = [
            bigquery.SchemaField("id_centro", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_alumno", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("id_salida", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("ranking", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("flag_like", "BOOLEAN", mode="REQUIRED")
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
    imagebase64: str
    tipo: str

class ListarAsignaturasAlumnoIn(BaseModel):
    centro_id: Optional[str] = None
    alumno_id: Optional[str] = None

class ListarAsignaturasAlumnoOut(BaseModel):
    centro_id: str
    alumno_id: str
    asignaturas: list[AsignaturaAlumno]
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

    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_AVATAR` 
              (color_pelo, color_ojos, color_piel, color_labios, color_camiseta, genero, tipo_peinado, id_centro, id_alumno) 
              VALUES ('#1C1C1C', '#8B4513', '#F5D5B8', '#C48B79', '#92D050', 'neutro', 'corto', '{payload.centro_id}', '{payload.alumno_id}')"""
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
        import traceback
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

    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_AVATAR` WHERE id_alumno = '{payload.alumno_id}' AND id_centro = '{payload.centro_id}'"""
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
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_AVATAR` WHERE id_centro = '{payload.centro_id}'"""
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
        sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ASIGNATURAS` (asignatura,id_centro) VALUES ('{payload.asignatura}','{payload.centro_id}')"""
        job = client.query(sql)
        job.result()

        return AsignaturaOut(asignatura=payload.asignatura, centro_id=payload.centro_id, success=True)
    except Exception as e:
        print(f"ERROR en crear_asignatura: {type(e).__name__}: {str(e)}")
        import traceback
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
                  SET asignatura = '{payload.asignatura}' 
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
        import traceback
        traceback.print_exc()
        raise

@app.post("/crear_clase", response_model=ClaseOut)
def crear_clase(
    payload: ClaseIn
):
    
    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_CLASES` (id_alumno,curso,id_centro) VALUES ('{payload.alumno_id}','{payload.curso}','{payload.centro_id}')"""
    job = client.query(sql)
    job.result()

    return ClaseOut(alumno_id=payload.alumno_id, curso=payload.curso, centro_id=payload.centro_id, success=True)

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

@app.options("/listar_clases_profesores")
def listar_clases_profesores_options():
    return {"message": "OK"}

@app.post("/listar_clases_profesores", response_model=ListarClasesOut)
def listar_clases_profesores(
    payload: ProfesorIn
):
    # Por ahora retorna todas las clases del centro (igual que listar_clases)
    # En el futuro se puede filtrar por las clases asignadas a ese profesor
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
        base64_data = download_base64_from_gcs(row.id_centro+'/'+row.asignatura+'.png', GCS_BUCKET_ASIGNATURAS)
        imagebase64.append(base64_data)
    
    return ListarAsignaturasOut(centro_id=payload.centro_id, asignaturas=asignaturas, imagebase64=imagebase64, success=True)

@app.options("/actualizar_alumno_interes")
def actualizar_alumno_interes_options():
    return {"message": "OK"}

@app.post("/actualizar_alumno_interes", response_model=AlumnoInteresOut)
def actualizar_alumno_interes(
    payload: AlumnoInteresIn
):
    #Se enmascara cualqueir rastro de información personal:
    ia_payload = {
                "text1": payload.texto_tiempo_libre,
                "text2": payload.texto_que_te_motiva,
                "text3": payload.texto_que_te_ayuda_a_entender,
                "text4": payload.texto_que_te_frustra_a_estudiar,
                "text5": payload.texto_que_asignaturas_se_te_dan_mejor
            }
            
    response = requests.post(
        f"{IA_ENDPOINT_URL}/enmascarar_texto",
        json=ia_payload,
        headers={"x-api-key": IA_ENDPOINT_API_KEY},
        timeout=120
    )
    response.raise_for_status()
    
    # Obtener el resultado enmascarado
    result = response.json()
    texto_1 = result.get("masked_text1", payload.texto_tiempo_libre)
    texto_2 = result.get("masked_text2", payload.texto_que_te_motiva)
    texto_3 = result.get("masked_text3", payload.texto_que_te_ayuda_a_entender)
    texto_4 = result.get("masked_text4", payload.texto_que_te_frustra_a_estudiar)
    texto_5 = result.get("masked_text5", payload.texto_que_asignaturas_se_te_dan_mejor)

    # Eliminar la asignación antigua
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_INTERES` 
              WHERE id_centro = '{payload.centro_id}' 
              AND id_alumno = '{payload.alumno_id}'"""
    job = client.query(sql)
    job.result()
    
    # Insertar la nueva asignación con textos enmascarados
    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_INTERES` (texto_tiempo_libre,texto_que_te_motiva,texto_que_te_ayuda_a_entender,texto_que_te_frustra_a_estudiar,texto_que_asignaturas_se_te_dan_mejor,id_centro,id_alumno, turno_formativo, max_tiempo_desplazamiento) 
              VALUES ('{texto_1}','{texto_2}','{texto_3}','{texto_4}','{texto_5}','{payload.centro_id}','{payload.alumno_id}','{payload.turno_formativo}',{payload.max_tiempo_desplazamiento})"""
    job = client.query(sql)
    job.result()

    #Lanzamos la llamada a PubSub:
    message_data = {
        "id_alumno": payload.alumno_id,
        "id_centro": payload.centro_id,
        "action": "procesar_salidas"
    }
    message_bytes = json.dumps(message_data).encode('utf-8')
    topic_path = publisher.topic_path(PROJECT_ID, "salidas-worker-procesamiento") 
    future = publisher.publish(topic_path, message_bytes)
    future.result()

    return AlumnoInteresOut(centro_id=payload.centro_id, alumno_id=payload.alumno_id, success=True)

@app.options("/listar_intereses_alumnos")
def listar_intereses_alumnos_options():
    return {"message": "OK"}

@app.post("/listar_intereses_alumnos", response_model=ListarInteresesAlumnosOut)
def listar_intereses_alumnos(
    payload: AlumnoInteresIn
):
    sql = f"""SELECT texto_tiempo_libre,texto_que_te_motiva,texto_que_te_ayuda_a_entender,texto_que_te_frustra_a_estudiar,texto_que_asignaturas_se_te_dan_mejor, id_alumno, turno_formativo, max_tiempo_desplazamiento 
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
            max_tiempo_desplazamiento=row.max_tiempo_desplazamiento
        ))
    
    return ListarInteresesAlumnosOut(centro_id=payload.centro_id, intereses=intereses, success=True, alumno_id=payload.alumno_id)

@app.options("/actualizar_avatar_config")
def actualizar_avatar_config_options():
    return {"message": "OK"}

@app.post("/actualizar_avatar_config", response_model=AvatarConfigOut)
def actualizar_avatar_config(
    payload: AvatarConfigIn
):
    ensure_database_setup()

    #Intentamso actualizar la imagen del avatar:
    ia_payload = {
                "centro_id": payload.centro_id,
                "alumno_id": payload.alumno_id,
                "color_pelo": payload.color_pelo,
                "color_piel": payload.color_piel,
                "color_ojos": payload.color_ojos,
                "color_labios": payload.color_labios,
                "color_camiseta": payload.color_camiseta,
                "genero": payload.genero,
                "tipo_peinado": payload.tipo_peinado
            }
            
    response = requests.post(
        f"{IA_ENDPOINT_URL}/modificar_avatar_alumno",
        json=ia_payload,
        headers={"x-api-key": IA_ENDPOINT_API_KEY},
        timeout=120
    )
    response.raise_for_status()
    
    # Eliminar configuración anterior si existe
    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_AVATAR` 
              WHERE id_centro = '{payload.centro_id}' AND id_alumno = '{payload.alumno_id}'"""
    job = client.query(sql)
    job.result()
    
    # Insertar la nueva configuración
    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_AVATAR` 
              (color_pelo, color_ojos, color_piel, color_labios, color_camiseta, genero, tipo_peinado, id_centro, id_alumno) 
              VALUES ('{payload.color_pelo}', '{payload.color_ojos}', '{payload.color_piel}', '{payload.color_labios}', 
                      '{payload.color_camiseta}', '{payload.genero}', '{payload.tipo_peinado}', '{payload.centro_id}', '{payload.alumno_id}')"""
    job = client.query(sql)
    job.result()
    
    # Descargar la imagen del avatar desde el bucket
    avatar_filename = f"{payload.centro_id}/{payload.alumno_id}.png"
    imagebase64 = download_base64_from_gcs(avatar_filename, GCS_BUCKET_AVATARES)

    return AvatarConfigOut(centro_id=payload.centro_id, alumno_id=payload.alumno_id, imagebase64=imagebase64, success=True)

@app.options("/listar_avatar_config")
def listar_avatar_config_options():
    return {"message": "OK"}

@app.post("/listar_avatar_config", response_model=ListarAvatarConfigOut)
def listar_avatar_config(
    payload: AvatarConfigIn
):
    sql = f"""SELECT color_pelo, color_ojos, color_piel, color_labios, color_camiseta, genero, tipo_peinado
              FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_AVATAR` 
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
    sql = f"""SELECT id_salida, ranking, flag_like, titulo, centro, localidad, perfiles, curriculo, tipo
              FROM `{PROJECT_ID}.{DATASET_ID}.V_SALIDAS_ALUMNOS` 
              WHERE id_centro = '{payload.centro_id}' AND id_alumno = '{payload.alumno_id}'"""
    query_job = client.query(sql)
    results = query_job.result()
    
    salidas = []
    for row in results:
        imagen_filename = f"{payload.centro_id}/{payload.alumno_id}/{row.titulo}.png"
        imagebase64 = download_base64_from_gcs(imagen_filename, GCS_BUCKET_SALIDAS)
        
        if not imagebase64:
            imagebase64 = download_base64_from_gcs("default/avatar.png", GCS_BUCKET_SALIDAS)
        
        salidas.append(SalidaAlumno(
            salida_id=row.id_salida,
            ranking=row.ranking,
            flag_like=row.flag_like,
            titulo=row.titulo,
            centro=row.centro,
            localidad=row.localidad,
            distancia=row.distancia,
            co2=row.co2,
            perfiles=row.perfiles,
            curriculo=row.curriculo,
            imagebase64=imagebase64,
            tipo=row.tipo
        ))
    
    return ListarSalidasAlumnoOut(centro_id=payload.centro_id, alumno_id=payload.alumno_id, salidas=salidas, success=True)

@app.options("/modificar_salidas_alumno")
def modificar_salidas_alumno_options():
    return {"message": "OK"}

@app.post("/modificar_salidas_alumno", response_model=ModificarSalidasAlumnoOut)
def modificar_salidas_alumno(
    payload: ModificarSalidasAlumnoIn
):
    sql = f"""UPDATE `{PROJECT_ID}.{DATASET_ID}.T_ALUMNOS_SALIDAS`
                SET flag_like = {payload.flag_like}
              WHERE id_centro = '{payload.centro_id}' AND id_alumno = '{payload.alumno_id}' AND id_salida = '{payload.salida_id}'"""
    query_job = client.query(sql)
    results = query_job.result()
    
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
              FROM `{PROJECT_ID}.{DATASET_ID}.T_DIRECCIONES`"""
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
              WHERE pais = '{payload.pais}'"""
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
              WHERE pais = '{payload.pais}' and ccaa = '{payload.ccaa}'"""
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
              WHERE pais = '{payload.pais}' and ccaa = '{payload.ccaa}' and provincia = '{payload.provincia}'"""
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