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
from datetime import datetime, timezone, time
import googlemaps
from google import genai
import random

#Se inicializan las variables de entorno:
PROJECT_ID = os.getenv("PROJECT_ID", "")
DATASET_ID = os.getenv("DATASET_ID", "")
REGION = os.getenv("REGION", "")
GOOGLE_CLOUD_GEMINI_API_KEY=os.getenv("GOOGLE_CLOUD_GEMINI_API_KEY", "")
GOOGLE_CLOUD_MAPS_API_KEY = os.getenv("GOOGLE_CLOUD_MAPS_API_KEY", "")
GCS_BUCKET_AVATARES=os.getenv("GCS_BUCKET_AVATARES", "")
GCS_BUCKET_SALIDAS=os.getenv("GCS_BUCKET_SALIDAS", "")

#Se establecen algunas variables de configuración adicionales:

MARKED_CONTENT = "****"

CLIENT_MAP_MAX_RETRIES = 10
CLIENT_MAP_SLEEP_TIME = 10

FACTOR_TIEMPO_MUNICIPIO = 20
MAX_ITEMS_IA_FIRST_APPROACH = 10
NO_DIFFERENT_SUBJECTS=5
MAX_ITEMS_IA_LAST_APPROACH = 5


VERTEX_AI_RETIRES=10
VERTEX_AI_SECONDS_SLEEP=60
TIMEOUT_HOURS_OVERLAP_FUNCTIONS = 3

app = FastAPI(title="Recomendador Salidas Worker - PubSub Receiver", version="1.0")

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

#T rambién en Google Maps:
client_maps = googlemaps.Client(key=GOOGLE_CLOUD_MAPS_API_KEY)


# ---------- Helpers ----------
def download_base64_from_gcs(filename: str, bucket_name: str) -> Optional[str]:
    try:
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(filename)
        if not blob.exists():
            return None
        content = blob.download_as_bytes()
        return base64.b64encode(content).decode('utf-8')
    except Exception as e:
        print(f"Error al descargar el archivo {filename} del bucket {bucket_name}: {e}")
        return None

def upload_base64_to_gcs(filename: str, bucket_name: str, content_base64: str) -> bool:
    try:
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(filename)
        content_bytes = base64.b64decode(content_base64)
        blob.upload_from_string(content_bytes)
        return True
    except Exception as e:
        print(f"Error al subir el archivo {filename} al bucket {bucket_name}: {e}", flush=True)
        return False

def generar_recomendaciones_salidas(id_centro: str,alumno_id: str, texto_1: str, texto_2: str,texto_3: str, texto_4: str, texto_5: str, max_tiempo_desplazamiento: int, turno_formativo: str, color_camiseta: Optional[str], color_labios: Optional[str], color_ojos: Optional[str], color_pelo: Optional[str], color_piel: Optional[str], genero: Optional[str], tipo_peinado: Optional[str]):

    print(f"[PASO 0 INICIADO] Se eliminan los registros en T_ALUMNOS_SALIDAS | {id_centro} {alumno_id}", flush=True)

    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNOS_SALIDAS`
                WHERE id_centro = @id_centro AND id_alumno = @id_alumno"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("id_centro", "STRING", id_centro),
            bigquery.ScalarQueryParameter("id_alumno", "STRING", alumno_id),
        ]
    )
    query_job = client_bigquery.query(sql, job_config=job_config)
    query_job.result()

    print(f"[PASO 0 INICIADO] Se eliminan los registros en T_ALUMNOS_SALIDAS | {id_centro} {alumno_id}", flush=True)


    print(f"[PASO 0 INICIADO] Generar la imagen del avatar | {id_centro} {alumno_id}", flush=True)

    model = "gemini-2.5-flash-image"

    parts=[]

    parts.append(genai.types.Part.from_text(text="Eres un diseñador gráfico experto en modificar imagenes para generar avatares."))
    parts.append(genai.types.Part.from_text(text="Te piden que tomes como referencia la siguiente imagen:"))
    
    # Cargar imagen base desde public/avatar.png
    public_avatar_path = SCRIPT_DIR.parent / "public" / "avatar.png"
    with open(public_avatar_path, "rb") as f:
        image_base64 = base64.b64encode(f.read()).decode('utf-8')
    
    parts.append(genai.types.Part.from_bytes(data=base64.b64decode(image_base64), mime_type="image/png"))
    parts.append(genai.types.Part.from_text(text="Y a partir de esta imagen te pides que apliques las siguientes modificaciones:"))
    parts.append(genai.types.Part.from_text(text=f"\t- El color de pelo debe ser: {color_pelo}"))
    parts.append(genai.types.Part.from_text(text=f"\t- El color de la piel debe ser: {color_piel}"))
    parts.append(genai.types.Part.from_text(text=f"\t- El color de ojos debe ser: {color_ojos}"))
    parts.append(genai.types.Part.from_text(text=f"\t- El color de los labios debe ser: {color_labios}"))
    parts.append(genai.types.Part.from_text(text=f"\t- El color de la camiseta debe ser: {color_camiseta}"))
    parts.append(genai.types.Part.from_text(text=f"\t- El género del avatar debe ser: {genero}"))
    parts.append(genai.types.Part.from_text(text=f"\t- El tipo de peinado debe ser: {tipo_peinado}"))

    parts.append(genai.types.Part.from_text(text="IMPORTANTE:"))
    parts.append(genai.types.Part.from_text(text=f"\t - El avatar resultante debe mantener la misma pose y fondo que la imagen original."))
    parts.append(genai.types.Part.from_text(text=f"\t - La apariencia del avatar proporcionado en la imagen ronda los 20 años. La imagen del avatar que debes generar debe aparentar 14 años, con lo que debe parecer más joven."))

    contents = [genai.types.Content(role="user",parts=parts)]

    generate_content_config = genai.types.GenerateContentConfig(
        temperature = 1,
        top_p = 0.95,
        max_output_tokens = 32768,
        response_modalities = ["IMAGE"],
        safety_settings = 
                        [ 
                            genai.types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",threshold="OFF"),
                            genai.types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT",threshold="OFF"),
                            genai.types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT",threshold="OFF"),
                            genai.types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",threshold="OFF"),
                        ],
        image_config=genai.types.ImageConfig(aspect_ratio="1:1",image_size="1K",output_mime_type="image/png"),
    )

    iter=0
    flag_success=False
    while iter < VERTEX_AI_RETIRES and flag_success==False:
        iter+=1
        try:
            response = client_genai.models.generate_content(model=model,contents=contents,config=generate_content_config)
            image_bytes=response.candidates[0].content.parts[0].inline_data.data
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            flag_success = True
            break
        except:
            time_sleep.sleep(VERTEX_AI_SECONDS_SLEEP)
    if flag_success==False:
        raise Exception("No se ha podido realizar la llamada a VertexAI")
                
    filename = f"{id_centro}/{alumno_id}.png"
    upload_base64_to_gcs(filename, GCS_BUCKET_AVATARES, image_base64)

    print(f"[PASO 0 FINALIZANDO] Generar la imagen del avatar | {id_centro} {alumno_id}", flush=True)
    
    #Se enmascaran los textos que puedan contener información sensible:
    
    print(f"[PASO 1 INICIADO] Enmascarado de datos sensibles | {id_centro} {alumno_id}", flush=True)

    model = "gemini-2.5-flash"

    parts=[]

    parts.append(genai.types.Part.from_text(text="Eres el encargado de enmascarar información personal en fragmentos de texto."))
    parts.append(genai.types.Part.from_text(text="Necesito que enmascares la información personal que encuentres en los siguientes 5 textos:"))
    parts.append(genai.types.Part.from_text(text="*Inicio Texto 1*"))
    parts.append(genai.types.Part.from_text(text=texto_1))
    parts.append(genai.types.Part.from_text(text="*Fin Texto 1*"))
    parts.append(genai.types.Part.from_text(text="*Inicio Texto 2*"))
    parts.append(genai.types.Part.from_text(text=texto_2))
    parts.append(genai.types.Part.from_text(text="*Fin Texto 2*"))
    parts.append(genai.types.Part.from_text(text="*Inicio Texto 3*"))
    parts.append(genai.types.Part.from_text(text=texto_3))
    parts.append(genai.types.Part.from_text(text="*Fin Texto 3*"))
    parts.append(genai.types.Part.from_text(text="*Inicio Texto 4*"))
    parts.append(genai.types.Part.from_text(text=texto_4))
    parts.append(genai.types.Part.from_text(text="*Fin Texto 4*"))
    parts.append(genai.types.Part.from_text(text="*Inicio Texto 5*"))
    parts.append(genai.types.Part.from_text(text=texto_5))
    parts.append(genai.types.Part.from_text(text="*Fin Texto 5*"))
    parts.append(genai.types.Part.from_text(text="Se considera información personal:"))
    parts.append(genai.types.Part.from_text(text="\t - Nombres propios"))
    parts.append(genai.types.Part.from_text(text="\t - Nombres de lugares/establecimientos"))
    parts.append(genai.types.Part.from_text(text="\t - Fechas de nacimiento"))
    parts.append(genai.types.Part.from_text(text="IMPORTANTE"))
    parts.append(genai.types.Part.from_text(text="\t - Enmascara la información personal utilizando 5 asteriscos (*****)."))
    
    contents = [genai.types.Content(role="user",parts=parts)]

    generate_content_config = genai.types.GenerateContentConfig(
        temperature = 0,
        top_p = 1,
        seed=0,
        max_output_tokens = 32768,
        safety_settings = 
                        [ 
                            genai.types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",threshold="OFF"),
                            genai.types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT",threshold="OFF"),
                            genai.types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT",threshold="OFF"),
                            genai.types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",threshold="OFF"),
                        ],
        response_mime_type = "application/json",
        response_schema = {"type":"OBJECT","properties":{"masked_text1":{"type":"STRING","description":"Texto del bloque 1 (comprendido entre *Inicio Texto 1* y *Fin Texto 1*) enmarcarado"},"masked_text2":{"type":"STRING","description":"Texto del bloque 2 (comprendido entre *Inicio Texto 2* y *Fin Texto 2*) enmarcarado"},"masked_text3":{"type":"STRING","description":"Texto del bloque 3 (comprendido entre *Inicio Texto 3* y *Fin Texto 3*) enmarcarado"},"masked_text4":{"type":"STRING","description":"Texto del bloque 4 (comprendido entre *Inicio Texto 4* y *Fin Texto 4*) enmarcarado"},"masked_text5":{"type":"STRING","description":"Texto del bloque 5 (comprendido entre *Inicio Texto 5* y *Fin Texto 5*) enmarcarado"}},"required":["masked_text1","masked_text2","masked_text3","masked_text4","masked_text5"]}    )

    iter=0
    flag_success=False
    while iter < VERTEX_AI_RETIRES and flag_success==False:
        iter+=1
        try:
            response = client_genai.models.generate_content(model=model,contents=contents,config=generate_content_config)
            output=response.candidates[0].content.parts[0].text
            flag_success = True
            break
        except:
            time_sleep.sleep(VERTEX_AI_SECONDS_SLEEP)
    if flag_success==False:
        raise Exception("No se ha podido realizar la llamada a VertexAI")

    output = json.loads(output)
    texto_tiempo_libre = output.get("masked_text1")
    texto_que_te_motiva = output.get("masked_text2")
    texto_que_te_ayuda_a_entender = output.get("masked_text3")
    texto_que_te_frustra_a_estudiar = output.get("masked_text4")
    texto_que_asignaturas_se_te_dan_mejor = output.get("masked_text5")
    if turno_formativo in ['Tardes']:
        llegada_alumno = datetime.combine(datetime.now().date(), time(15, 0))
    else:
        llegada_alumno = datetime.combine(datetime.now().date(), time(8, 0))

    print(f"[PASO 1 FINALIZADO] Enmascarado de datos sensibles | {id_centro} {alumno_id}", flush=True)

    #Los guardamso en sus respectivas bases de datos:
    
    print(f"[PASO 2 INICIADO] Guardando los intereses del alumno | {id_centro} {alumno_id}", flush=True)

    sql = f"""DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_INTERES` 
              WHERE id_centro = '{id_centro}' 
              AND id_alumno = '{alumno_id}'"""
    job = client_bigquery.query(sql)
    job.result()

    sql = f"""INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ALUMNO_INTERES` (texto_tiempo_libre,texto_que_te_motiva,texto_que_te_ayuda_a_entender,texto_que_te_frustra_a_estudiar,texto_que_asignaturas_se_te_dan_mejor,id_centro,id_alumno, turno_formativo, max_tiempo_desplazamiento, color_camiseta, color_labios, color_ojos, color_pelo, color_piel, genero, tipo_peinado) 
              VALUES ('{texto_tiempo_libre}','{texto_que_te_motiva}','{texto_que_te_ayuda_a_entender}','{texto_que_te_frustra_a_estudiar}','{texto_que_asignaturas_se_te_dan_mejor}','{id_centro}','{alumno_id}','{turno_formativo}',{max_tiempo_desplazamiento},'{color_camiseta}','{color_labios}','{color_ojos}','{color_pelo}','{color_piel}','{genero}','{tipo_peinado}')"""
    job = client_bigquery.query(sql)
    job.result()

    print(f"[PASO 2 FINALIZADO] Guardando los intereses del alumno | {id_centro} {alumno_id}", flush=True)

    #Procesamos los intereses del alumno:

    print(f"[PASO 3 INICIADO] Procesando los intereses del alumno | {id_centro} {alumno_id}", flush=True)

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

    print(f"[PASO 3 FINALIZADO] Procesando los intereses del alumno | {id_centro} {alumno_id}", flush=True)

    #Extrae las evaluaciones de las diferentes asignaturas:
    print(f"[PASO 4 INICIADO] Consultando la performance del alumno | {id_centro} {alumno_id}", flush=True)

    sql = f"""select
            asignatura,
            unidad,
            titulo,
            min(cast(nota AS INT64)) as min_nota,
            avg(cast(nota AS INT64)) as avg_nota,
            max(cast(nota AS INT64)) as max_nota,
            count(cast(nota AS INT64)) as count_notas
            from
            ((select A.*, B.titulo from 
            (SELECT centro_id, clase, asignatura, unidad, 'ejercicio # '||id as id, max(nota) as nota FROM `{PROJECT_ID}.{DATASET_ID}.T_ACCION_ALUMNO_EJERCICIO`
            where centro_id = @id_centro
            and alumno_id = @id_alumno
            group by centro_id, clase, asignatura, unidad, id
            union all
            SELECT centro_id, clase, asignatura, unidad, 'trabajo # '||id as id, max(nota) as nota FROM `{PROJECT_ID}.{DATASET_ID}.T_ACCION_ALUMNO_TRABAJO`
            where centro_id = @id_centro
            and alumno_id = @id_alumno
            group by centro_id, clase, asignatura, unidad, id) A
            left join
            (SELECT distinct centro_id, clase, asignatura, unidad, titulo FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES` where centro_id = @id_centro) B
            ON A.centro_id=b.centro_id AND A.clase=B.clase AND A.asignatura=B.asignatura AND A.unidad = b.unidad))
            group by asignatura, unidad, titulo
            order by asignatura, unidad
        """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("id_centro", "STRING", id_centro),
            bigquery.ScalarQueryParameter("id_alumno", "STRING", alumno_id)
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    performance = job.to_dataframe()

    print(f"[PASO 4 FINALIZADO] Consultando la performance del alumno | {id_centro} {alumno_id}", flush=True)

    #La formateamos:

    print(f"[PASO 5 INICIADO] Formateando la performance del alumno | {id_centro} {alumno_id}", flush=True)

    performance_txt=""
    for idx, row in performance.iterrows():
         performance_txt += f"\t -Asignatura: {row['asignatura']}, Unidad: {row['unidad']}, Título: {row['titulo']}\n"
         performance_txt += f"\t\t -Nota Mínima: {row['min_nota']}\n"
         performance_txt += f"\t\t -Nota Media: {row['avg_nota']}\n"
         performance_txt += f"\t\t -Nota Máxima: {row['max_nota']}\n"
         performance_txt += f"\t\t -Número de Evaluaciones: {row['count_notas']}\n"

    print(f"[PASO 5 FINALIZADO] Formateando la performance del alumno | {id_centro} {alumno_id}", flush=True)

    #Tras esto obtenemos la dirección de los centros de estudio:

    print(f"[PASO 6 INICIADO] Consultando la dirección del centro | {id_centro} {alumno_id}", flush=True)

    sql = f"""SELECT provincia, municipio
                FROM `{PROJECT_ID}.{DATASET_ID}.T_DIRECCIONES_CENTROS`
                WHERE id_centro = @id_centro"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("id_centro", "STRING", id_centro),
        ]
    )
    query_job = client_bigquery.query(sql, job_config=job_config)
    direccion = list(query_job.result())
    
    if not direccion:
        raise Exception("No se encontró dirección para el centro")

    #Obtenemos la primera dirección:
    direccion = direccion[0]
    provincia = direccion.provincia
    municipio = direccion.municipio

    #Construimos la localidad del centro:
    localidad_alumno = f"{municipio}, {provincia})"

    print(f"[PASO 6 FINALIZADO] Consultando la dirección del centro | {id_centro} {alumno_id}", flush=True)

    #De la tabla de provincias cercanas extraemos las provincias cercanas a la provincia del centro:

    print(f"[PASO 7 INICIADO] Consultando las provincias cercanas | {id_centro} {alumno_id}", flush=True)

    #sql = f"""SELECT provincia_cercana
    #             FROM `{PROJECT_ID}.{DATASET_ID}.T_PROVINCIAS_CERCANAS`
    #            WHERE provincia = @provincia"""
    #job_config = bigquery.QueryJobConfig(
    #    query_parameters=[
    #        bigquery.ScalarQueryParameter("provincia", "STRING", provincia),
    #    ]
    #)
    #query_job = client_bigquery.query(sql, job_config=job_config)
    #resultados = list(query_job.result())

    # Si no hay resultados, usar la provincia actual
    #if resultados:
    #    provincias_cercanas = [row.provincia_cercana for row in resultados]
    #else:
    #    provincias_cercanas = [provincia]
    #provincias_cercanas = "', '".join(provincias_cercanas)

    provincias_cercanas=provincia

    print(f"[PASO 7 FINALIZADO] Consultando las provincias cercanas | {id_centro} {alumno_id}", flush=True)

    #Seleccionamos las salidas en provincias cercanas:

    print(f"[PASO 8 INICIADO] Consultando las salidas profesionales cercanas | {id_centro} {alumno_id}", flush=True)

    sql = f"""SELECT
                id_salida,
                titulo,
                requisitos_de_acceso,
                salidas_profesionales,
                que_voy_a_aprender,
                plan_de_formacion,
                seguir_estudiando,
                tus_estudios_en_europa,
                centro,
                provincia,
                municipio,
                curriculo_ccaa,
                curriculo_mecd,
                perfiles_profesionales
                    FROM `{PROJECT_ID}.{DATASET_ID}.T_SALIDAS_PROFESIONALES`
                    WHERE provincia IN ('{provincias_cercanas}') and tipo = 'Grado Básico'
                    and centro is not null"""
    query_job = client_bigquery.query(sql)
    df_salidas = query_job.to_dataframe()

    print(f"[PASO 8 FINALIZADO] Consultando las salidas profesionales cercanas | {id_centro} {alumno_id}", flush=True)

    #Obtenemos los diferentes lugares de interés para el alumno en base a la distancia:
    
    print(f"[PASO 9 INICIADO] Se obtienen los diferentes puntos de interés en base a la proximidad del alumno | {id_centro} {alumno_id}", flush=True)

    places_tmp=[]
    places=[]
    for idx, row in df_salidas.iterrows():
        places_tmp.append(f"{row['municipio']}, {row['provincia']}")
    places_tmp=list(set(places_tmp))
    for place in places_tmp:
        result_google_maps=False
        retires=0
        while not result_google_maps and retires < CLIENT_MAP_MAX_RETRIES:
            retires+=1
            try:
                distance=client_maps.distance_matrix(
                        localidad_alumno,
                        place, 
                        mode='driving',      
                        arrival_time=llegada_alumno,
                        language='es'
                    )
                distance=distance['rows'][0]['elements'][0]['duration']['value']/60
                if distance <= max_tiempo_desplazamiento*(1+FACTOR_TIEMPO_MUNICIPIO/100):
                    places.append(place)
                result_google_maps=True
            except Exception as e:
                time.sleep(CLIENT_MAP_SLEEP_TIME)
        if not result_google_maps:
            raise Exception(f"No se pudo obtener la distancia entre {localidad_alumno} y {place} después de {CLIENT_MAP_MAX_RETRIES} intentos")
    concatFields = (df_salidas["municipio"].astype(str) + ", " + df_salidas["provincia"].astype(str))
    mask = concatFields.isin(places)
    df_salidas = df_salidas[mask].copy() 
    df_salidas=df_salidas.reset_index(drop=True)

    print(f"[PASO 9 FINALIZADO] Se obtienen los diferentes puntos de interés en base a la proximidad del alumno | {id_centro} {alumno_id}", flush=True)

    #Tras esto tenemos que evaluar cada una de las diferentes propuestas de salidas en base a su contenido:

    print(f"[PASO 10 INICIADO] Evaluando las diferentes propuestas de salidas en base a su contenido | {id_centro} {alumno_id}", flush=True)

    perfiles_profesionales_tmp=[]
    for idx, row in df_salidas.iterrows():
        content_json={}
        content_json["titulo"] = row["titulo"]
        content_json["requisitos_de_acceso"] = row["requisitos_de_acceso"]
        content_json["salidas_profesionales"] = row["salidas_profesionales"]
        content_json["que_voy_a_aprender"] = row["que_voy_a_aprender"]
        content_json["plan_de_formacion"] = row["plan_de_formacion"]
        content_json["seguir_estudiando"] = row["seguir_estudiando"]
        content_json["tus_estudios_en_europa"] = row["tus_estudios_en_europa"]
        perfiles_profesionales_tmp.append(content_json)
    
    # Eliminar duplicados comparando por título
    titulos_vistos = set()
    perfiles_profesionales_unicos = []
    for perfil in perfiles_profesionales_tmp:
        if perfil["titulo"] not in titulos_vistos:
            titulos_vistos.add(perfil["titulo"])
            perfiles_profesionales_unicos.append(perfil)
    perfiles_profesionales_tmp = perfiles_profesionales_unicos

    pd_eval = pd.DataFrame()
    model = "gemini-2.5-flash"
    for perfil_profesional_item in perfiles_profesionales_tmp:

        if intereses_txt == "" and performance_txt == "":

            puntuacion=random.randint(0, 100)

        else:

            parts=[]
            parts.append(genai.types.Part.from_text(text="Actúa como un orientador vocacional experto en formación profesional y análisis de perfiles laborales."))
            parts.append(genai.types.Part.from_text(text="Tu labor es ayudar a evaluar a los alumnos qué salida profesional podría encajar mejor con sus perfiles de interés y rendimiento académico."))
            if intereses_txt != "":
                parts.append(genai.types.Part.from_text(text="Para poder realizar tu análisis has decidio pasar un test a un alumno y has obtenido las siguientes respuestas:"))
                parts.append(genai.types.Part.from_text(text=intereses_txt))
            if performance_txt != "":
                parts.append(genai.types.Part.from_text(text="También decides hablar con los profesores para preguntarles por el rendimiento del alumno y te han pasado información sobre las siguientes calificaciones obtenidas:"))
                parts.append(genai.types.Part.from_text(text=performance_txt))
            parts.append(genai.types.Part.from_text(text=f"En el listado de salidas profesionales encuentras una de {perfil_profesional_item['titulo']} y extraes la siguiente información:"))
            parts.append(genai.types.Part.from_text(text=f"\t - Requisitos de Acceso: {perfil_profesional_item['requisitos_de_acceso']}"))
            parts.append(genai.types.Part.from_text(text=f"\t - Salidas Profesionales: {perfil_profesional_item['salidas_profesionales']}"))
            parts.append(genai.types.Part.from_text(text=f"\t - Plan de Formación: {perfil_profesional_item['plan_de_formacion']}"))
            parts.append(genai.types.Part.from_text(text=f"\t - Seguir Estudiando: {perfil_profesional_item['seguir_estudiando']}"))
            parts.append(genai.types.Part.from_text(text=f"\t - Tus Estudios en Europa: {perfil_profesional_item['tus_estudios_en_europa']}"))
            parts.append(genai.types.Part.from_text(text=f"\t - ¿Qué voy a aprender?: {perfil_profesional_item['que_voy_a_aprender']}"))
            parts.append(genai.types.Part.from_text(text="Tu tarea:"))
            if intereses_txt != "":
                parts.append(genai.types.Part.from_text(text="1) Perfila al alumno en base a sus intereses"))
                if performance_txt != "":
                    parts.append(genai.types.Part.from_text(text="2) Evalúa el rendimiento del alumno en base a las calificaciones obtenidas, identificando skills que podrían aportarle valor al alumno el día de mañana para el desempeño de un perfil profesional como el que se le presenta"))
                    parts.append(genai.types.Part.from_text(text="3) Analiza la salida profesional y determina el grado en el que dicha salida podría encajar con los intereses y la performance del alumno."))
                    parts.append(genai.types.Part.from_text(text="4) Proporciona una puntuación del 0 al 100 indicando el grado de afinidad esperado por parte del alumno en relación a la salida profesional presentada, donde 0 implica que no hay afinidad y 100 implica que hay una afinidad total."))
                else:
                    parts.append(genai.types.Part.from_text(text="2) Analiza la salida profesional y determina el grado en el que dicha salida podría encajar con los intereses del alumno."))
                    parts.append(genai.types.Part.from_text(text="3) Proporciona una puntuación del 0 al 100 indicando el grado de afinidad esperado por parte del alumno en relación a la salida profesional presentada, donde 0 implica que no hay afinidad y 100 implica que hay una afinidad total."))

            else:
                if performance_txt != "":
                    parts.append(genai.types.Part.from_text(text="1) Evalúa el rendimiento del alumno en base a las calificaciones obtenidas, identificando skills que podrían aportarle valor al alumno el día de mañana para el desempeño de un perfil profesional como el que se le presenta"))
                    parts.append(genai.types.Part.from_text(text="2) Analiza la salida profesional y determina el grado en el que dicha salida podría encajar con la performance del alumno."))
                    parts.append(genai.types.Part.from_text(text="3) Proporciona una puntuación del 0 al 100 indicando el grado de afinidad esperado por parte del alumno en relación a la salida profesional presentada, donde 0 implica que no hay afinidad y 100 implica que hay una afinidad total."))
                
            contents = [genai.types.Content(role="user",parts=parts)]

            generate_content_config = genai.types.GenerateContentConfig(
                temperature = 0,
                top_p = 1,
                seed = 0,
                max_output_tokens = 1000,
                safety_settings = [
                    genai.types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",threshold="OFF"),
                    genai.types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT",threshold="OFF"),
                    genai.types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT",threshold="OFF"),
                    genai.types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",threshold="OFF")
                ],
                response_mime_type = "application/json",
                response_schema = {"type":"OBJECT","properties":{"puntuacion_afinidad":{"type":"INTEGER","description":"Un valor entero de 0 a 100 que representa el grado de coincidencia entre los intereses del usuario y los perfiles profesionales del grado."}},"required":["puntuacion_afinidad"]},
            )

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
            puntuacion = output.get("puntuacion_afinidad")

        df_json = pd.json_normalize({"titulo": perfil_profesional_item["titulo"], "requisitos_de_acceso":perfil_profesional_item["requisitos_de_acceso"],"salidas_profesionales":perfil_profesional_item["salidas_profesionales"],"que_voy_a_aprender":perfil_profesional_item["que_voy_a_aprender"],"plan_de_formacion":perfil_profesional_item["plan_de_formacion"],"seguir_estudiando":perfil_profesional_item["seguir_estudiando"],"tus_estudios_en_europa":perfil_profesional_item["tus_estudios_en_europa"], "puntuacion":puntuacion})
        pd_eval = pd.concat([pd_eval.reset_index(drop=True), df_json.reset_index(drop=True)], axis=0)

    #Nos quedamos con los N mejores:
    pd_eval = pd_eval.sort_values(by='puntuacion', ascending=False).head(MAX_ITEMS_IA_FIRST_APPROACH)

    print(f"[PASO 10 FINALIZADO] Evaluando las diferentes propuestas de salidas en base a su contenido | {id_centro} {alumno_id}", flush=True)

    #Lo siguiente será emular a diferentes sujetos modificando la seed para que tomen una decisión al respecto:

    print(f"[PASO 11 INICIADO] Evaluando las diferentes propuestas de salidas en base a su contenido (Deep Dive) | {id_centro} {alumno_id}", flush=True)

    subjects=[]
    for i in range(NO_DIFFERENT_SUBJECTS):
        subjects.append(random.randint(0,10000))

    model = "gemini-2.5-flash"

    pd_eval2 = pd.DataFrame(columns=['titulo'])

    pd_eval_iteraciones=pd_eval[['titulo','requisitos_de_acceso','salidas_profesionales','plan_de_formacion','seguir_estudiando','tus_estudios_en_europa','que_voy_a_aprender']]
    pd_eval_iteraciones = pd_eval_iteraciones.drop_duplicates()

    for idx, rowi in pd_eval_iteraciones.iterrows():
        for jdx, rowj in pd_eval_iteraciones.iterrows():
            if idx > jdx and rowi['titulo'] != rowj['titulo']:

                parts=[]
                parts.append(genai.types.Part.from_text(text="Actúa como un orientador vocacional experto en formación profesional y análisis de perfiles laborales."))
                parts.append(genai.types.Part.from_text(text="Tu labor es ayudar a evaluar a los alumnos qué salida profesional podría encajar mejor con sus perfiles de interés y rendimiento académico."))
                if intereses_txt != "":
                    parts.append(genai.types.Part.from_text(text="Para poder realizar tu análisis has decidio pasar un test a un alumno y has obtenido las siguientes respuestas:"))
                    parts.append(genai.types.Part.from_text(text=intereses_txt))
                if performance_txt != "":
                    parts.append(genai.types.Part.from_text(text="También decides hablar con los profesores para preguntarles por el rendimiento del alumno y te han pasado información sobre las siguientes calificaciones obtenidas:"))
                    parts.append(genai.types.Part.from_text(text=performance_txt))
                parts.append(genai.types.Part.from_text(text=f"En el listado de salidas profesionales encuentras dos que podrian interesarle al alumno:"))
                parts.append(genai.types.Part.from_text(text=f"\t - Título Salida Profesional: 1"))
                parts.append(genai.types.Part.from_text(text=f"\t\t - Requisitos de Acceso: {rowi['requisitos_de_acceso']}"))
                parts.append(genai.types.Part.from_text(text=f"\t\t - Salidas Profesionales: {rowi['salidas_profesionales']}"))
                parts.append(genai.types.Part.from_text(text=f"\t\t - Plan de Formación: {rowi['plan_de_formacion']}"))
                parts.append(genai.types.Part.from_text(text=f"\t\t - Seguir Estudiando: {rowi['seguir_estudiando']}"))
                parts.append(genai.types.Part.from_text(text=f"\t\t - Tus Estudios en Europa: {rowi['tus_estudios_en_europa']}"))
                parts.append(genai.types.Part.from_text(text=f"\t\t - ¿Qué voy a aprender?: {rowi['que_voy_a_aprender']}"))
                parts.append(genai.types.Part.from_text(text=f"\t - Título Salida Profesional: 2"))
                parts.append(genai.types.Part.from_text(text=f"\t\t - Requisitos de Acceso: {rowj['requisitos_de_acceso']}"))
                parts.append(genai.types.Part.from_text(text=f"\t\t - Salidas Profesionales: {rowj['salidas_profesionales']}"))
                parts.append(genai.types.Part.from_text(text=f"\t\t - Plan de Formación: {rowj['plan_de_formacion']}"))
                parts.append(genai.types.Part.from_text(text=f"\t\t - Seguir Estudiando: {rowj['seguir_estudiando']}"))
                parts.append(genai.types.Part.from_text(text=f"\t\t - Tus Estudios en Europa: {rowj['tus_estudios_en_europa']}"))
                parts.append(genai.types.Part.from_text(text=f"\t\t - ¿Qué voy a aprender?: {rowj['que_voy_a_aprender']}"))
                parts.append(genai.types.Part.from_text(text="Tu tarea:"))
                if intereses_txt != "":
                    parts.append(genai.types.Part.from_text(text="1) Perfila al alumno en base a sus intereses"))
                    if performance_txt != "":
                        parts.append(genai.types.Part.from_text(text="2) Evalúa el rendimiento del alumno en base a las calificaciones obtenidas, identificando skills que podrían aportarle valor al alumno el día de mañana para el desempeño de un perfil profesional como el que se le presenta"))
                        parts.append(genai.types.Part.from_text(text="3) Analiza las salidas profesionales y determina el grado en el que cada una podría encajar con los intereses y la performance del alumno."))
                        parts.append(genai.types.Part.from_text(text="4) Evalua ambas salidas profesionales y determina cual de todas podría encajar más al usuario en base a sus intereses y rendimiento, identificando fortalezas y puntos de mejora."))
                    else:
                        parts.append(genai.types.Part.from_text(text="2) Analiza las salidas profesionales y determina el grado en el que cada una podría encajar con los intereses del alumno."))
                        parts.append(genai.types.Part.from_text(text="3) Evalua ambas salidas profesionales y determina cual de todas podría encajar más al usuario en base a sus intereses, identificando fortalezas y puntos de mejora."))

                else:
                    if performance_txt != "":
                        parts.append(genai.types.Part.from_text(text="1) Evalúa el rendimiento del alumno en base a las calificaciones obtenidas, identificando skills que podrían aportarle valor al alumno el día de mañana para el desempeño de un perfil profesional como el que se le presenta"))
                        parts.append(genai.types.Part.from_text(text="2) Analiza las salidas profesionales y determina el grado en el que cada una podría encajar con la performance del alumno."))
                        parts.append(genai.types.Part.from_text(text="3) Evalua ambas salidas profesionales y determina cual de todas podría encajar más al usuario en base a su rendimiento, identificando fortalezas y puntos de mejora. Si te encaja más la salida profesional 1 responde con el número 1, si te encaja más la salida profesional 2 responde con el número 2."))
            
                contents = [genai.types.Content(role="user",parts=parts)]

                for subject in subjects:

                    generate_content_config = genai.types.GenerateContentConfig(
                        temperature = 0.5,
                        top_p = 1,
                        seed = subject,
                        max_output_tokens = 1000,
                        safety_settings = [
                            genai.types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",threshold="OFF"),
                            genai.types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT",threshold="OFF"),
                            genai.types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT",threshold="OFF"),
                            genai.types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",threshold="OFF")
                        ],
                        response_mime_type = "application/json",
                        response_schema = {"type":"OBJECT","properties":{"eleccion":{"type":"INTEGER","description":"Salida profesional que mejor se ajusta al alumno. Si es la primera salida profesional responde con el número 1, si es la segunda salida profesional responde con el número 2."}},"required":["eleccion"]},
                    )

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
                    eleccion = output.get("eleccion")

                    if eleccion == 1:
                        df_json = pd.json_normalize({"titulo":rowi["titulo"]})
                    else:
                        df_json = pd.json_normalize({"titulo":rowj["titulo"]})

                    pd_eval2 = pd.concat([pd_eval2.reset_index(drop=True), df_json.reset_index(drop=True)], axis=0)

    pd_eval2=pd_eval2.reset_index(drop=True)

    top_vals = (pd_eval2["titulo"].value_counts(dropna=False).head(MAX_ITEMS_IA_LAST_APPROACH).index)
    
    # Filtrar solo los títulos que están en top_vals
    df_salidas = df_salidas[df_salidas["titulo"].isin(top_vals)]
    df_salidas=df_salidas.reset_index(drop=True)
    
    # Crear un mapeo de título a ranking basado en el orden de top_vals
    titulo_to_ranking = {titulo: idx + 1 for idx, titulo in enumerate(top_vals)}
    
    # Asignar el ranking según el orden en top_vals
    df_salidas['ranking'] = df_salidas['titulo'].map(titulo_to_ranking)
    
    # Ordenar por ranking para que coincida con el orden de top_vals
    df_salidas = df_salidas.sort_values('ranking').reset_index(drop=True)
    
    # Seleccionar columnas y añadir campos adicionales
    df_salidas=df_salidas[['id_salida','titulo', 'centro','municipio','provincia','curriculo_ccaa','perfiles_profesionales', 'curriculo_mecd', 'ranking']]
    df_salidas['centro'] = df_salidas['centro'].fillna('')
    df_salidas['municipio'] = df_salidas['municipio'].fillna('')
    df_salidas['provincia'] = df_salidas['provincia'].fillna('')
    df_salidas['curriculo_ccaa'] = df_salidas['curriculo_ccaa'].fillna('')
    df_salidas['perfiles_profesionales'] = df_salidas['perfiles_profesionales'].fillna('')
    df_salidas['curriculo_mecd'] = df_salidas['curriculo_mecd'].fillna('')
    df_salidas['id_centro']=id_centro
    df_salidas['id_alumno']=alumno_id
    df_salidas['flag_like']=False
    df_salidas['tipo']="Grado Básico"

    print(f"[PASO 11 FINALIZADO] Evaluando las diferentes propuestas de salidas en base a su contenido (Deep Dive) | {id_centro} {alumno_id}", flush=True)

    #Se genera una imagen para cada salida profesional:

    print(f"[PASO 12 INICIADO] Generar la imagen del avatar trabajando | {id_centro} {alumno_id}", flush=True)

    model = "gemini-2.5-flash-image"

    titulos_unicos = df_salidas['titulo'].unique().tolist()
    print(f"[INFO] Total de títulos únicos: {len(titulos_unicos)}", flush=True)
    
    for titulo_unico in titulos_unicos:

        imagen_filename= f"{id_centro}/{alumno_id}.png"
        imagen_filename_base64=download_base64_from_gcs(imagen_filename, GCS_BUCKET_AVATARES)

        parts=[]
        parts.append(genai.types.Part.from_text(text="Eres un diseñador gráfico experto en modificar imagenes para generar avatares realizando profesiones."))
        parts.append(genai.types.Part.from_text(text="Te piden que tomes como referencia la siguiente imagen de un avatar:"))
        parts.append(genai.types.Part.from_bytes(data=base64.b64decode(imagen_filename_base64), mime_type="image/png"))
        parts.append(genai.types.Part.from_text(text=f"Y a partir de esta imagen te pides que adaptes a dicho avatar como si estuviese trabajando en un día cotidiano en un empleo. Para ello te dicen que cursó el Grado Básico de {titulo_unico} hace poco tiempo y que por lo tanto el avatar debe reflejar que está trabajando en una profesión relacionada con dicho {titulo_unico}."))
        parts.append(genai.types.Part.from_text(text="IMPORTANTE:"))
        parts.append(genai.types.Part.from_text(text=f"\t - El avatar resultante será utilizado en un catálogo de profesiones, haz que parezca interesante la profesiónque desempeña pero sin ser surrealsita o demasiado ambiciosa."))
        parts.append(genai.types.Part.from_text(text=f"\t - Ten en cuenta que debes representar uan escena donde el/la protagonista principal sea el propio avatar."))
        contents = [genai.types.Content(role="user",parts=parts)]

        generate_content_config = genai.types.GenerateContentConfig(
            temperature = 1,
            top_p = 0.95,
            max_output_tokens = 32768,
            response_modalities = ["IMAGE"],
            safety_settings = 
                            [ 
                                genai.types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",threshold="OFF"),
                                genai.types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT",threshold="OFF"),
                                genai.types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT",threshold="OFF"),
                                genai.types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",threshold="OFF"),
                            ],
            image_config=genai.types.ImageConfig(aspect_ratio="1:1",image_size="1K",output_mime_type="image/png"),
        )
    
        iter=0
        flag_success=False
        while iter < VERTEX_AI_RETIRES and flag_success==False:
            iter+=1
            try:
                response = client_genai.models.generate_content(model=model,contents=contents,config=generate_content_config)
                image_bytes=response.candidates[0].content.parts[0].inline_data.data
                b64_string = base64.b64encode(image_bytes).decode("ascii")
                flag_success = True
                break
            except:
                time_sleep.sleep(VERTEX_AI_SECONDS_SLEEP)
        if flag_success==False:
            raise Exception("No se ha podido realizar la llamada a VertexAI")

        #Como muchas veces el contenido de la imagen puede tener texto, vamos a volver a procesarla con nano-banana para eliminarlo:
        image_genai_with_text = genai.types.Part.from_bytes(data=base64.b64decode(b64_string),mime_type="image/png")
                    
        parts=[
            genai.types.Part.from_text(text=f"Eres un editor gráfico experto en eliminar cualquier texto que aparezca en una imagen pues será utilizada para una campaña y es un requisito que se tiene que cumplir."),
            genai.types.Part.from_text(text="La imagen que nos interesa que revises la siguiente imagen y elimines todo el contenido de texto que aparezca:"),
            image_genai_with_text,
            genai.types.Part.from_text(text="Tu tarea"),
            genai.types.Part.from_text(text="\t- Elimina el texto de la imagen si es que existe. Por el contrario proporciona la imagen tal y como es en realidad.")
        ]

        contents = [genai.types.Content(role="user",parts=parts)]

        iter=0
        flag_success=False
        while iter < VERTEX_AI_RETIRES and flag_success==False:
            iter+=1
            try:
                response = client_genai.models.generate_content(model=model,contents=contents,config=generate_content_config)
                image_bytes=response.candidates[0].content.parts[0].inline_data.data
                image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                flag_success = True
                break
            except:
                time_sleep.sleep(VERTEX_AI_SECONDS_SLEEP)
        if flag_success==False:
            raise Exception("No se ha podido realizar la llamada a VertexAI")
                
        imagen_filename = f"{id_centro}/{alumno_id}/{titulo_unico}.png"
        upload_base64_to_gcs(imagen_filename, GCS_BUCKET_SALIDAS, image_base64)

    print(f"[PASO 12 FINALIZADO] Generar la imagen del avatar trabajando | {id_centro} {alumno_id}", flush=True)

    #Por último actualizamos los registros:

    print(f"[PASO 13 INICIADO] Se registran los resultados obtenidos | {id_centro} {alumno_id}", flush=True)
  
    print(df_salidas, flush=True)
    
    # Insertar fila por fila especificando las columnas
    for idx, row in df_salidas.iterrows():
        sql = f"""
        INSERT INTO `{PROJECT_ID}.{DATASET_ID}.T_ALUMNOS_SALIDAS` 
        (id_salida, titulo, centro, municipio, provincia, curriculo_ccaa, perfiles_profesionales, curriculo_mecd, ranking, id_centro, id_alumno, flag_like, tipo)
        VALUES (@id_salida, @titulo, @centro, @municipio, @provincia, @curriculo_ccaa, @perfiles_profesionales, @curriculo_mecd, @ranking, @id_centro, @id_alumno, @flag_like, @tipo)
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("id_salida", "INT64", int(row.id_salida)),
                bigquery.ScalarQueryParameter("titulo", "STRING", str(row.titulo)),
                bigquery.ScalarQueryParameter("centro", "STRING", str(row.centro) if row.centro else ""),
                bigquery.ScalarQueryParameter("municipio", "STRING", str(row.municipio) if row.municipio else ""),
                bigquery.ScalarQueryParameter("provincia", "STRING", str(row.provincia) if row.provincia else ""),
                bigquery.ScalarQueryParameter("curriculo_ccaa", "STRING", str(row.curriculo_ccaa) if row.curriculo_ccaa else ""),
                bigquery.ScalarQueryParameter("perfiles_profesionales", "STRING", str(row.perfiles_profesionales) if row.perfiles_profesionales else ""),
                bigquery.ScalarQueryParameter("curriculo_mecd", "STRING", str(row.curriculo_mecd) if row.curriculo_mecd else ""),
                bigquery.ScalarQueryParameter("ranking", "INT64", int(row.ranking)),
                bigquery.ScalarQueryParameter("id_centro", "STRING", str(row.id_centro)),
                bigquery.ScalarQueryParameter("id_alumno", "STRING", str(row.id_alumno)),
                bigquery.ScalarQueryParameter("flag_like", "BOOL", bool(row.flag_like)),
                bigquery.ScalarQueryParameter("tipo", "STRING", str(row.tipo))
            ]
        )
        query_job = client_bigquery.query(sql, job_config=job_config)
        query_job.result()

    print(f"[PASO 13 FINALIZADO] Se registran los resultados obtenidos | {id_centro} {alumno_id}", flush=True)

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
        "service": "Recomendador Salidas Worker",
        "status": "running",
        "version": "1.0",
        "description": "Worker para procesar mensajes de PubSub"
    }

@app.get("/health")
def health():
    """Health check para Cloud Run"""
    return {"status": "healthy", "service": "recomendador-salidas-worker"}

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
        action = message_json.get("action", "generar_recomendaciones_salidas")
        
        if action == "generar_recomendaciones_salidas":
            # Obtener parámetros
            id_centro = message_json.get("centro_id")
            if not id_centro:
                raise HTTPException(status_code=400, detail="Missing centro_id")
            alumno_id = message_json.get("alumno_id")
            if not alumno_id:
                raise HTTPException(status_code=400, detail="Missing alumno_id")
            texto_tiempo_libre = message_json.get("texto_tiempo_libre")
            if not texto_tiempo_libre:
                raise HTTPException(status_code=400, detail="Missing texto_tiempo_libre")
            texto_que_te_motiva = message_json.get("texto_que_te_motiva")
            if not texto_que_te_motiva:
                raise HTTPException(status_code=400, detail="Missing texto_que_te_motiva")
            texto_que_te_ayuda_a_entender = message_json.get("texto_que_te_ayuda_a_entender")
            if not texto_que_te_ayuda_a_entender:
                raise HTTPException(status_code=400, detail="Missing texto_que_te_ayuda_a_entender")
            texto_que_te_frustra_a_estudiar = message_json.get("texto_que_te_frustra_a_estudiar")
            if not texto_que_te_frustra_a_estudiar:
                raise HTTPException(status_code=400, detail="Missing texto_que_te_frustra_a_estudiar")
            texto_que_asignaturas_se_te_dan_mejor = message_json.get("texto_que_asignaturas_se_te_dan_mejor")
            if not texto_que_asignaturas_se_te_dan_mejor:
                raise HTTPException(status_code=400, detail="Missing texto_que_asignaturas_se_te_dan_mejor")
            max_tiempo_desplazamiento = message_json.get("max_tiempo_desplazamiento")
            if not max_tiempo_desplazamiento:
                raise HTTPException(status_code=400, detail="Missing max_tiempo_desplazamiento")
            turno_formativo = message_json.get("turno_formativo")
            if not turno_formativo:
                raise HTTPException(status_code=400, detail="Missing turno_formativo")
            
            color_camiseta = message_json.get("color_camiseta")
            if not color_camiseta:
                raise HTTPException(status_code=400, detail="Missing color_camiseta")
            color_labios = message_json.get("color_labios")
            if not color_labios:
                raise HTTPException(status_code=400, detail="Missing color_labios")
            color_ojos = message_json.get("color_ojos")
            if not color_ojos:
                raise HTTPException(status_code=400, detail="Missing color_ojos")
            color_pelo = message_json.get("color_pelo")
            if not color_pelo:
                raise HTTPException(status_code=400, detail="Missing color_pelo")
            color_piel = message_json.get("color_piel")
            if not color_piel:
                raise HTTPException(status_code=400, detail="Missing color_piel")
            genero = message_json.get("genero")
            if not genero:
                raise HTTPException(status_code=400, detail="Missing genero")
            tipo_peinado = message_json.get("tipo_peinado")
            if not tipo_peinado:
                raise HTTPException(status_code=400, detail="Missing tipo_peinado")
            
            # Generar job_id único para esta tarea
            parameters = {
                "centro_id": id_centro,
                "alumno_id": alumno_id,
                "texto_tiempo_libre": texto_tiempo_libre,
                "texto_que_te_motiva": texto_que_te_motiva,
                "texto_que_te_ayuda_a_entender": texto_que_te_ayuda_a_entender,
                "texto_que_te_frustra_a_estudiar": texto_que_te_frustra_a_estudiar,
                "texto_que_asignaturas_se_te_dan_mejor": texto_que_asignaturas_se_te_dan_mejor,
                "max_tiempo_desplazamiento": max_tiempo_desplazamiento,
                "turno_formativo": turno_formativo,
                "color_camiseta": color_camiseta,
                "color_labios": color_labios,
                "color_ojos": color_ojos,
                "color_pelo": color_pelo,
                "color_piel": color_piel,
                "genero": genero,
                "tipo_peinado": tipo_peinado
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
                generar_recomendaciones_salidas(
                    id_centro,
                    alumno_id,
                    texto_tiempo_libre,
                    texto_que_te_motiva,
                    texto_que_te_ayuda_a_entender,
                    texto_que_te_frustra_a_estudiar,
                    texto_que_asignaturas_se_te_dan_mejor,
                    max_tiempo_desplazamiento,
                    turno_formativo,
                    color_camiseta,
                    color_labios,
                    color_ojos,
                    color_pelo,
                    color_piel,
                    genero,
                    tipo_peinado
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
