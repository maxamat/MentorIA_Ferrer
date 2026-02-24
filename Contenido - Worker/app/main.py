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

#Se establecen algunas variables de configuración adicionales:
ADDITIONAL_SECTION_PAGES=1
MAX_SECTION_PAGES=5
MIN_WORDS_SHEET=1000
MAX_WORDS_SHEET=2000
VERTEX_AI_RETIRES=10
VERTEX_AI_SECONDS_SLEEP=60
TIMEOUT_HOURS_OVERLAP_FUNCTIONS = 3

DIALOG_CHUNKS=6
CHUNK_DIALOG_WORDS = 150
MULETILLAS_EMOCION =["[Enfasis]","[Silencio breve]","[Silencio largo]","[Pausa breve]","[Pausa larga]","[Respiro breve]","[Respiro profundo]","[Risa breve]","[Risa intensa]","[Usa un tono emocionante]","[Usa un tono triste]"]
ELEVENLAB_VOICE_ID="gD1IexrzCvsXPHUuT0s3"
ELEVENLABS_RETIRES=10
ELEVENLABS_SECONDS_SLEEP=60

HTML_JSON={
            "Inicio":{
                "1":["cabecera","unidad","seccion","texto","texto","texto","texto","texto"],
                "2":["cabecera","unidad","seccion","texto","texto","texto","texto","ejemplo"],
                "3":["cabecera","unidad","seccion","texto","texto","texto_imagen","ejemplo"],
                "4":["cabecera","unidad","seccion","texto","texto","imagen","ejemplo"],
                "5":["cabecera","unidad","seccion","texto","texto","imagen","texto"],
                "6":["cabecera","unidad","seccion","imagen_texto","texto_imagen","ejemplo"],
                "7":["cabecera","unidad","seccion","imagen_texto","texto_imagen","texto"]
            },
            "Continuación":{
                "1":["texto","texto","texto","texto","texto"],
                "2":["texto","texto","texto","imagen","imagen_texto"],
                "3":["texto","texto","texto","imagen","ejemplo"]
            }
            ,
            "Cierre":{
                "1":["texto","texto","texto"],
                "2":["texto","texto","texto","texto","texto"],
                "3":["texto","texto","texto","texto","ejemplo"],
            }
}

HTML_COMPONENTS = {
            "cabecera":{
                    "html":"<div class=\"cabecera-row verde negrita cabecera\"><div class=\"cabecera-left\">#asignatura#</div><div class=\"cabecera-center\">#nivel_academico#</div><div class=\"cabecera-right\"><img class=\"imagen_cabecera\" src=\"https://github.com/RafaArmero1993/MentorIA/blob/main/App/images/MentorIA%20logo%20b-g.png?raw=true\"/></div></div>"
            },
            "unidad":{
                    "html":"<h1 class=\"unidad verde negrita\">#content#</h1>"
                },
            "seccion":{
                    "html":"<h2 class=\"seccion verde negrita\">#content#</h2>"
                },
            "texto":{
                    "html":"<div class=\"texto negro\">#content#</div>",
                    "text_lengths":[400]
                },
            "ejemplo":{
                    "html":"<div class=\"ejemplo azul\">#content#</div>",
                    "text_lengths":[400]
                },
            "imagen":{
                    "html":"<div class=\"main_imagen\"><img src=\"data:image/png;base64,#base64_image#\"/></div>",
                },
            "imagen_texto":{
                    "html":"<div class=\"texto_imagen\"><div class=\"imagen\"><img src=\"data:image/png;base64,#base64_image#\"/></div><div class=\"texto negro\">#content#</div></div>",
                    "text_lengths":[400]
                },
            "imagen_ejemplo":{
                    "html":"<div class=\"texto_imagen\"><div class=\"imagen\"><img src=\"data:image/png;base64,#base64_image#\"/></div><div class=\"ejemplo azul\">#content#</div></div>",
                    "text_lengths":[400]
                },
            "texto_imagen":{
                    "html":"<div class=\"texto_imagen\"><div class=\"texto negro\">#content#</div><div class=\"imagen\"><img src=\"data:image/png;base64,#base64_image#\"/></div></div>",
                    "text_lengths":[400]
                },
            "ejemplo_imagen":{
                    "html":"<div class=\"texto_imagen\"><div class=\"ejemplo azul\">#content#</div><div class=\"imagen\"><img src=\"data:image/png;base64,#base64_image#\"/></div></div>",
                    "text_lengths":[400]
                },
}

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
  .seccion{
    font-size: 16px;
  }
  .texto, .ejemplo{
    text-align: justify;
  }
  .texto_imagen, .ejemplo_imagen, .imagen_texto, .imagen_ejemplo{
    display: flex;
    gap: 24px;
    align-items: center;
  }
  .texto_imagen .texto, .ejemplo_imagen .ejemplo, .imagen_texto .texto, .imagen_ejemplo .ejemplo{
    flex: 1 1 auto;
    min-width: 0;
  }
  .texto_imagen .imagen, .ejemplo_imagen .imagen, .imagen_texto .imagen, .imagen_ejemplo .imagen{
    flex: 0 0 45%;
    overflow: hidden;
  }
  .texto_imagen .imagen img, .ejemplo_imagen .imagen img, .imagen_texto .imagen img, .imagen_ejemplo .imagen img{
    display: block;
    max-height: 500px;
    object-fit: contain;
    max-width:100%;
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
  .dina4{
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
    padding: 20mm;
    box-sizing: border-box;
  }
  .qr_panel{
    display: inline-flex;
    align-items: center;
    background: #7EB900;
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
</style>
"""

IMAGE_PROMPTING = """
- Debe ser una ilustración educativa, clara y visualmente atractiva pero sin ser infantil.
- Utiliza colores brillantes y contrastantes para captar la atención.
- Incluye elementos gráficos como íconos, diagramas o dibujos relacionados con el tema.
- Asegúrate de que la imagen sea relevante para el contenido del texto proporcionado.
- Evita el uso de texto en la imagen; la ilustración debe comunicar el mensaje visualmente. 
- El fondo de la imagen debe ser blanco.
- No deben aparecer bordes ni marcos a los laterales.
"""

app = FastAPI(title="Contenido Worker - PubSub Receiver", version="1.0")

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

def generar_contenido(id_centro: str, clase: str, asignatura: str, unidad: int):

    #Se elimina el contenido obsoleto:
    print(f"[PASO 0 INICIADO] Se elimina el contenido obsoleto | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    bucket = storage_client.bucket(GCS_BUCKET_CONTENIDO)
    prefix = f"{id_centro}/{clase}/{asignatura}/{unidad}"
    blobs = bucket.list_blobs(prefix=prefix)
    
    for blob in blobs:
        blob.delete()

    sql = f"""
    DELETE FROM `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE`
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
            bigquery.ScalarQueryParameter("unidad", "INT64", unidad)
        ]
    )
    query_job = client_bigquery.query(sql, job_config=job_config)
    query_job.result()

    print(f"[PASO 0 FINALIZADO] Se elimina el contenido obsoleto | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    
    #Comenzamos obteniendo el título y la descripción para cada sección de la unidad:
    print(f"[PASO 1 INICIADO] Consultando secciones en BigQuery | {id_centro} {clase} {asignatura} {unidad}", flush=True)
    sql = f"""SELECT DISTINCT seccion,titulo, contenido FROM `{PROJECT_ID}.{DATASET_ID}.T_PROGRAMACIONES_UNIDADES_SECCIONES` 
              WHERE centro_id = @centro_id 
              AND clase = @clase
              AND asignatura = @asignatura
              AND unidad = @unidad
              AND status = @status
              ORDER BY CAST(seccion AS INT64) ASC"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
            bigquery.ScalarQueryParameter("clase", "STRING", clase),
            bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
            bigquery.ScalarQueryParameter("unidad", "INT64", unidad),
            bigquery.ScalarQueryParameter("status", "BOOL", True),
        ]
    )
    job = client_bigquery.query(sql, job_config=job_config)
    secciones = job.to_dataframe()
    print(f"[PASO 1 COMPLETADO] Se obtuvieron {len(secciones)} secciones | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Obtenemos el nombre de la unidad:
    print(f"[PASO 2 INICIADO] Consultando nombre de la unidad en BigQuery | {id_centro} {clase} {asignatura} {unidad}", flush=True)
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
    print(f"[PASO 2 COMPLETADO] Título de unidad obtenido: {titulo_unidad} | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Calculamos las extensiones de cada sección:
    print(f"[PASO 3 INICIADO] Iniciando cálculo de extensiones para {len(secciones)} secciones | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    secciones["extension"]=""
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
        response_schema = {"type":"OBJECT","properties":{"extension":{"type":"INTEGER","description":"Número de páginas que debe tener la sección a realizar."}},"required":["extension"]},
    )

    for idx, rowi in secciones.iterrows():

        print(f"[PASO 3 PROCESANDO] Step {idx+1}/{len(secciones)} | {id_centro} {clase} {asignatura} {unidad}", flush=True)

        current_content = ""
        current_content += "\t-Unidad: " + str(titulo_unidad)
        current_content += "\n\t-Sección: " + str(rowi["titulo"])
        current_content += "\n\t\t-Contenido: " + str(rowi["contenido"])

        previous_content = ""
        for jdx, rowj in secciones.iterrows():
            if jdx < idx:
                previous_content += "\t-Unidad: " + str(titulo_unidad)
                previous_content += "\n\t-Sección: " + str(rowi["titulo"])
                previous_content += "\n\t\t-Contenido: " + str(rowj["contenido"])
                previous_content += "\n\t\t-Extensión (Páginas): " + str(rowj["extension"])

        parts=[]
        parts.append(genai.types.Part.from_text(text=f"Eres un editor de contenido formativo para alumnos de {clase}."))
        parts.append(genai.types.Part.from_text(text=f"Más concretamente para alumnos de la asignatura de {asignatura}."))
        parts.append(genai.types.Part.from_text(text="El contenido formativo se encuentra estructurado en unidades, capítulos y secciones."))
        parts.append(genai.types.Part.from_text(text="Tu trabajo es ir sección por sección indicándoles a tus compañeros de edición el número de páginas que cada sección tendrá en base a su contenido."))
        if previous_content != "":
            parts.append(genai.types.Part.from_text(text="Por el momento, el contenido formativo que se ha ido redactando tiene la siguiente estructura (unidades, sección y contenido) y extensiones (número de páginas)"))
            parts.append(genai.types.Part.from_text(text=previous_content))
        parts.append(genai.types.Part.from_text(text="El contenido sobre el que tratará dicha sección es la siguiente:"))
        parts.append(genai.types.Part.from_text(text=current_content))
        parts.append(genai.types.Part.from_text(text="Tu tarea:"))
        parts.append(genai.types.Part.from_text(text="\t- Determina la extensión de dicha sección (número de páginas)"))
        parts.append(genai.types.Part.from_text(text="Importante:"))
        parts.append(genai.types.Part.from_text(text=f"\t-Formato de respuesta: Por favor, porciona solo el número de páginas que consideras debería tener dicha sección sabiendo que se trata de un documento educativo orientado a alumnos de {clase} para la asignatura {asignatura} pero que a la vez debe ser académico y formal."))

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
        extension = output.get("extension")
        #Rectificado de la extensión:
        if MAX_SECTION_PAGES < (extension + ADDITIONAL_SECTION_PAGES):
            secciones.at[idx, 'extension'] = str(MAX_SECTION_PAGES)
        else:  
            secciones.at[idx, 'extension'] = str(extension + ADDITIONAL_SECTION_PAGES)


    print(f"[PASO 3 COMPLETADO] Extensiones calculadas | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Lo siguiente que hacemos es identificar el tipo de diapositiva de cada hoja:
    print(f"[PASO 4 INICIADO] Identificación de tipos de diapositiva de cada hoja | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    secciones_tmp = pd.DataFrame()
    pagina=0
    for idx, row in secciones.iterrows():
        print(f"[PASO 4 PROCESANDO] Step {idx+1}/{len(secciones)} | {id_centro} {clase} {asignatura} {unidad}", flush=True)
        for jdx in range (int(row["extension"])):
            pagina+=1
            if jdx == 0 and int(row["extension"]) == 1:
                #tipo_plantilla = 'Inicio y Cierre'
                tipo_plantilla = 'Inicio'
            elif jdx == 0:
                tipo_plantilla = 'Inicio'
            elif jdx == int(row["extension"]) - 1:
                tipo_plantilla = 'Cierre'
            else:
                tipo_plantilla = 'Continuación'
            nueva_fila = {
                "seccion": row["titulo"],
                "num_seccion": row["seccion"],
                "pagina": pagina,
                "pagina_seccion": jdx + 1,
                "extension_seccion": int(row["extension"]),
                "tipo_plantilla": tipo_plantilla,
                "contenido": row["contenido"]
            }
            secciones_tmp = pd.concat([secciones_tmp, pd.DataFrame([nueva_fila])], ignore_index=True)
    
    secciones=secciones_tmp
    print(f"[PASO 4 COMPLETADO] Tipos de diapositiva identificados | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Lo siguiente que se hace es generar el contenido para cada página:
    print(f"[PASO 5 INICIADO] Generación de contenido para cada página | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    model = "gemini-2.5-flash"

    tools = [genai.types.Tool(google_search=genai.types.GoogleSearch())]

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
        tools = tools,
        thinking_config=genai.types.ThinkingConfig(thinking_budget=-1),
    )

    secciones["contenido_pagina"] = ""
    for idx, rowi in secciones.iterrows():

        print(f"[PASO 5 PROCESANDO] Step {idx+1}/{len(secciones)} | {id_centro} {clase} {asignatura} {unidad}", flush=True)


        all_content = ""
        for jdx, rowj in secciones.iterrows():
            if secciones.at[jdx, 'pagina_seccion']==1:
                all_content+= f"\t- Unidad: {titulo_unidad}"
                all_content+= f"\n\t\t- Sección: {secciones.at[jdx, 'seccion']}"
                all_content+= f"\n\t\t\t- Contenido [General Sección]: {secciones.at[jdx, 'contenido']}"
                

        old_content = ""
        for jdx, rowj in secciones.iterrows():
            if jdx < idx :
                if jdx == 0 and secciones.at[jdx, 'pagina_seccion']==1:
                    old_content+= f"\t- Unidad: {titulo_unidad}"
                    old_content+= f"\n\t\t- Sección: {secciones.at[jdx, 'seccion']}"
                    old_content+= f"\n\t\t\t- Contenido [General Sección]: {secciones.at[jdx, 'contenido']}"
                elif secciones.at[jdx-1, 'pagina_seccion'] == 1:
                    old_content+= f"\n\t\t- Sección: {secciones.at[jdx, 'seccion']}"
                    old_content+= f"\n\t\t\t- Contenido [General Sección]: {secciones.at[jdx, 'contenido']}"
                old_content+= f"\n\t\t\t\t- Contenido [Página {secciones.at[jdx, 'pagina_seccion']}]: {secciones.at[jdx, 'contenido_pagina']}"

        current_content = ""
        current_content+= f"\t- Unidad: {titulo_unidad}"
        current_content+= f"\n\t\t- Sección: {secciones.at[idx, 'seccion']}"
        current_content+= f"\n\t\t\t- Contenido [General Sección]: {secciones.at[idx, 'contenido']}"
        current_content+= f"\n\t\t\t\t- Contenido [Página {secciones.at[idx, 'pagina_seccion']}]: {secciones.at[idx, 'contenido_pagina']}"

        parts =[]
        parts+=[
            genai.types.Part.from_text(text="Eres un trabajador en una editorial encargado de redactar el documento de las diferentes páginas de un documento educativo."),
            genai.types.Part.from_text(text="Tienes que redactar un documento educativo y sabes que la estructura y contenido de todo el documento es el siguiente:"),
            genai.types.Part.from_text(text=all_content),
        ]
        if old_content == "":
            parts+=[
                genai.types.Part.from_text(text="Por el momento no has redactado ninguna página del documento educativo.")
            ]
        else:
            if old_content == "":
                parts+=[
                    genai.types.Part.from_text(text="Por el momento, el contenido que has redactado del documento educativo es el siguiente"),
                    genai.types.Part.from_text(text=old_content),
                ]

        parts+=[
            genai.types.Part.from_text(text=f"Te dispones a redactar la siguiente página:"),
            genai.types.Part.from_text(text=current_content),
            genai.types.Part.from_text(text=f"Sabes que esa sección la componen {secciones.at[idx, 'extension_seccion']} páginas y la que vas a redactar es la número {secciones.at[idx, 'pagina_seccion']} dentor de dicha sección."),
            genai.types.Part.from_text(text="Tu tarea:"),
            genai.types.Part.from_text(text="\t 1. Analiza con detalle todo el contenido sobre el que tiene que tratar el documento educativo."),
            genai.types.Part.from_text(text="\t 2. Observa todas las secciones que se han redactado hasta ahora (si aplica)."),
            genai.types.Part.from_text(text="\t 3. Analiza el contenido de la sección que vas a redactar."),
            genai.types.Part.from_text(text="\t 4. Redacta el contenido de la página."),
            genai.types.Part.from_text(text="Importante:"),
            genai.types.Part.from_text(text=f"\t El contenido educativo va destinado a alumnos de la asignatura {asignatura} de {clase} con lo que el contenido que refleje debe adaptarse a dicha audiencia en cuanto a nivel de profundidad pero debe ser un texto académico, formal y en un solo bloque de información."),
            genai.types.Part.from_text(text=f"\t Procura enlazar el contenido de una página con el de las secciones anteriores para que la narrativa tenga continuidad."),
            genai.types.Part.from_text(text="Muy importante:"),
            genai.types.Part.from_text(text=f"\t El contenido de cada hoja debe tener entre {MIN_WORDS_SHEET} y {MAX_WORDS_SHEET} palabras."),
            genai.types.Part.from_text(text=f"\t El contenido no debe contener títulos de secciones ni subsecciones, debe ser directamente el contenido."),
            genai.types.Part.from_text(text="Formato de respuesta:"),
            genai.types.Part.from_text(text="\t Proporciona únicamente el contenido de la página, sin formato JSON, sin explicaciones adicionales, solo el texto del contenido.")
        ]

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
        
        content = response.candidates[0].content.parts[0].text
        secciones.at[idx, 'contenido_pagina'] = str(content)

    print(f"[PASO 5 COMPLETADO] Generación de contenido para cada página | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Lo siguiente que hacemos es escoger cual de las diapositivas le encaja mejor en base al contenido que vamos a mostrar:
    print(f"[PASO 6 INICIADO] Selección diapositiva en base a su tipo y a la imagen que se muestre | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    model = "gemini-2.5-flash"
    secciones["diapositiva"] = ""

    for idx, rowi in secciones.iterrows():

        print(f"[PASO 6 PROCESANDO] Step {idx + 1}/{len(secciones)} | {id_centro} {clase} {asignatura} {unidad}", flush=True)

        carpeta = Path(f"public/{rowi['tipo_plantilla']}/")
        plantillas = sorted(p.name for p in carpeta.iterdir() if p.is_file() and p.suffix.lower() == ".jpg")

        parts=[]

        parts+=[
            genai.types.Part.from_text(text="Eres un ilustrador en una editorial que tiene que escoger la plantilla adecuada para una página de un documento educativo."),
            genai.types.Part.from_text(text="Te han dicho que el contenido de dicha página será el siguiente:"),
            genai.types.Part.from_text(text=rowi["contenido_pagina"]),
            genai.types.Part.from_text(text="A continuación adjunto el listado de plantillas de entre las que puedes escoger:"),
        ]

        for plantilla in plantillas:
            fichero = Path(f"public/{rowi['tipo_plantilla']}/{plantilla}")
            b64_string = base64.b64encode(fichero.read_bytes()).decode("utf-8")
            parts+=[
                genai.types.Part.from_text(text=f"{plantilla}:"),
                genai.types.Part.from_bytes(data=base64.b64decode(b64_string),mime_type="image/jpg")
            ]

        parts+=[
            genai.types.Part.from_text(text="Tu tarea:"),
            genai.types.Part.from_text(text="\t1. Debes analizar al detalle el contenido de cada plantilla sabiendo que:"),
            genai.types.Part.from_text(text="\t\t  - El texto en color negro con el Lorem Ipsum es un texto de relleno que posteriromente será reemplazado con el contenido real de la página."),
            genai.types.Part.from_text(text="\t\t  - El texto en color azul con el Lorem Ipsum es un texto de relleno que posteriromente será reemplazado con ejemplos relacionados al contenido de la página."),
            genai.types.Part.from_text(text="\t\t  - El texto en color verde será posteriormente reemplazado con información sobre la sección, el capítulo, etc."),
            genai.types.Part.from_text(text="\t\t  - Las posibles imágenes en el cuerpo principal del documento proporcionan información serán posteriormente reemplazadas por imágenes relacionadas con el contenido explicado."),
            genai.types.Part.from_text(text="\t 2. Debes revisar el contenido sobre el que se quiere profundizar en la página."),
            genai.types.Part.from_text(text="\t 3. Debes identificar la plantilla que mejor se ajuste al futuro contenido de la página."),
            genai.types.Part.from_text(text="Importante:"),
            genai.types.Part.from_text(text=f"\t El contenido educativo va destinado a alumnos de la asignatura {asignatura} de {clase}. Ten en cuenta esto a la hora de escoger la plantilla."),
            genai.types.Part.from_text(text=f"\t Proporciona el nombre de la plantilla que mejor se ajuste."),
        ]

        contents = [genai.types.Content(role="user",parts=parts)]

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
            response_schema = {"type":"OBJECT","properties":{"template":{"type":"STRING","description":"Nombre de la plantilla que mejor se ajusta al contenido de la página.","enum": plantillas}},"required":["template"]},
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
        template = output.get("template")
        secciones.at[idx, 'diapositiva'] = str(template)

    print(f"[PASO 6 COMPLETADO] Selección diapositiva en base a su tipo y a la imagen que se muestre | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Por último generamos el contenido (únicamente del texto) en cada bloque y lo populamos en una lista:
    print(f"[PASO 7 INICIADO] Generación de contenido de texto para cada bloque | {id_centro} {clase} {asignatura} {unidad}", flush=True)
    model = "gemini-2.5-flash"
    
    text_content=[]
    for idx, rowi in secciones.iterrows():

        print(f"[PASO 7 PROCESANDO] Step {idx + 1}/{len(secciones)} | {id_centro} {clase} {asignatura} {unidad}", flush=True)

        #Obtenemos la diapositiva que se va a necesitar para generar dicha página:
        diapositiva = rowi["diapositiva"].lower().replace("diapositiva","").replace(".jpg","")
        html_components = HTML_JSON[rowi["tipo_plantilla"]][diapositiva]

        #Se genera el contenido de los fragmentos de texto de cada página:
        length=[]
        for component in html_components:
            if "texto" in component:
                for text_length in HTML_COMPONENTS[component]["text_lengths"]:
                    length.append(text_length)

        #Una vez sabemos el texto, lo que hacemos es pedirle a Gemini que genere el contenido de dichos fragmentos:
        properties_schema_json={}
        required_schema_json=[]
        for jdx, text_item in enumerate(length):
            properties_schema_json[f"text{jdx+1}"] = {"type":"STRING","description":f"Contenido del bloque de texto #{jdx+1} con una extensión aproximada de {text_item} caracteres."}
            required_schema_json.append(f"text{jdx+1}")

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
            thinking_config=genai.types.ThinkingConfig(thinking_budget=-1),
            response_mime_type = "application/json",
            response_schema = {"type":"OBJECT","properties":properties_schema_json,"required":required_schema_json},
        )

        parts=[
            genai.types.Part.from_text(text=f"Eres un editor de contenido formativo para alumnos de {asignatura} de {clase}."),
            genai.types.Part.from_text(text="Te han encomentado la tarea de redactar el contenido de una página que trata sobre lo siguiente:"),
            genai.types.Part.from_text(text=rowi["contenido_pagina"]),
            genai.types.Part.from_text(text="A continuación te indico el número de bloques de texto que debes redactar y el tamaño, en caracteres, de cada uno de ellos:"),
        ]

        for jdx, len_item in enumerate(length):
            parts+=[
                genai.types.Part.from_text(text=f"\t Bloque # {jdx+1}"),
                genai.types.Part.from_text(text=f"\t\t Longitud aproximada:  {len_item} caracteres.")
            ]

        parts+=[
            genai.types.Part.from_text(text="El contenido debe estar redactado en formato html puro sin reglas CSS ni estilos adicionales."),
            genai.types.Part.from_text(text="Únicamente podrás redactar con las etiquetas HTML que te indique a continuación: <p>, <ul>, <li>, <ol>, <b>, <i>"),
            genai.types.Part.from_text(text="Tu tarea:"),
            genai.types.Part.from_text(text=f"Redacta el contenido de los {len(length)} bloques de texto en formato html siguiendo las instrucciones anteriormente indicadas"),
        ]

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
        for jdx, text_item in enumerate(length):
            text_content.append(output.get("text"+str(jdx+1)))

    print(f"[PASO 7 COMPLETADO] Generación de contenido de texto para cada bloque | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Una vez ya se tienen lso fragmentos de texto se generan los ejemplos pertinentes, y para ello:
    print(f"[PASO 8 INICIADO] Generación de contenido de texto para cada ejemplo | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    model = "gemini-2.5-flash"
    
    text_content_index=0
    sample_content=[]
    for idx, rowi in secciones.iterrows():

        print(f"[PASO 8 PROCESANDO] Step {idx + 1}/{len(secciones)} | {id_centro} {clase} {asignatura} {unidad}", flush=True)

        if "Inicio" in rowi["tipo_plantilla"]:
            kept_text=""

        #Obtenemos la diapositiva que se va a necesitar para generar dicha página:
        diapositiva = rowi["diapositiva"].lower().replace("diapositiva","").replace(".jpg","")
        html_components = HTML_JSON[rowi["tipo_plantilla"]][diapositiva]

        #Se va encolando el texto escrito hasta que aparece un ejemplo:
        for component in html_components:
            if "texto" in component:
                if kept_text != "":
                    kept_text += "\n"
                kept_text += text_content[text_content_index]
                text_content_index += 1
            if "ejemplo" in component:

                length=[]
                for text_length in HTML_COMPONENTS[component]["text_lengths"]:
                    length.append(text_length)

                properties_schema_json={}
                required_schema_json=[]
                for jdx, text_item in enumerate(length):
                    properties_schema_json[f"sample{jdx+1}"] = {"type":"STRING","description":f"Contenido del ejemplo #{jdx+1} con una extensión aproximada de {text_item} caracteres."}
                    required_schema_json.append(f"sample{jdx+1}")

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
                    thinking_config=genai.types.ThinkingConfig(thinking_budget=-1),
                    response_mime_type = "application/json",
                    response_schema = {"type":"OBJECT","properties":properties_schema_json,"required":required_schema_json}                )


                parts=[
                    genai.types.Part.from_text(text=f"Eres un editor de contenido formativo para alumnos de {asignatura} de {clase}."),
                    genai.types.Part.from_text(text="Te han encomentado la tarea de redactar ejemplos que permitan a los alumnos entender el siguiente contenido:"),
                    genai.types.Part.from_text(text=kept_text),
                    genai.types.Part.from_text(text="A continuación te indico el número de ejemplos que debes redactar y el tamaño, en caracteres, de cada uno de ellos:"),
                ]

                for jdx, len_item in enumerate(length):
                    parts+=[
                        genai.types.Part.from_text(text=f"\t Ejemplo # {jdx+1}"),
                        genai.types.Part.from_text(text=f"\t\t Longitud aproximada:  {len_item} caracteres.")
                    ]

                parts+=[
                    genai.types.Part.from_text(text="El contenido debe estar redactado en formato html puro sin reglas CSS ni estilos adicionales."),
                    genai.types.Part.from_text(text="Únicamente podrás redactar con las etiquetas HTML que te indique a continuación: <p>, <ul>, <li>, <ol>, <b>, <i>"),
                    genai.types.Part.from_text(text="Tu tarea:"),
                    genai.types.Part.from_text(text=f"Redacta el contenido de los {len(length)} ejemplos en formato html siguiendo las instrucciones anteriormente indicadas"),
                ]

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
                for jdx, text_item in enumerate(length):
                    sample_content.append(output.get("sample"+str(jdx+1)))
                kept_text = ""

    print(f"[PASO 8 COMPLETADO] Generación de contenido de texto para cada ejemplo | {id_centro} {clase} {asignatura} {unidad}", flush=True)



    #Tras esto hacemso lo mismo con las imagenes:
    #Una vez ya se tienen lso fragmentos de texto se generan los ejemplos pertinentes, y para ello:
    print(f"[PASO 9 INICIADO] Generación de contenido de imagen | {id_centro} {clase} {asignatura} {unidad}", flush=True)
    model = "gemini-2.5-flash-image"

    text_content_index=0
    image_content=[]
    for idx, rowi in secciones.iterrows():

        print(f"[PASO 9 PROCESANDO] Step {idx + 1}/{len(secciones)} | {id_centro} {clase} {asignatura} {unidad}", flush=True)

        print(rowi["tipo_plantilla"])
        if "Inicio" in rowi["tipo_plantilla"]:
            kept_text=""

        #Obtenemos la diapositiva que se va a necesitar para generar dicha página:
        print(rowi["diapositiva"])
        diapositiva = rowi["diapositiva"].lower().replace("diapositiva","").replace(".jpg","")
        print(diapositiva)
        print(rowi["tipo_plantilla"])
        html_components = HTML_JSON[rowi["tipo_plantilla"]][diapositiva]
        print('pasa 1')

        #Se va encolando el texto escrito hasta que aparece un ejemplo:
        for component in html_components:
            if "texto" in component:
                if kept_text != "":
                    kept_text += "\n"
                kept_text += text_content[text_content_index]
                text_content_index += 1
            if "imagen" in component:

                parts=[
                    genai.types.Part.from_text(text=f"Eres un editor gráfico que elabora ilustraciones para contenido formativo para alumnos de {asignatura} de {clase}."),
                    genai.types.Part.from_text(text="Te han encomentado la tarea de ilustrar una imagen relacionada con el siguiente bloque de texto de una unidad formativa:"),
                    genai.types.Part.from_text(text=kept_text),
                    genai.types.Part.from_text(text="Para llevar esta tarea a cabo tomas como referencia las siguientes instrucciones gráficas:"),
                    genai.types.Part.from_text(text=IMAGE_PROMPTING)
                ]

                contents = [genai.types.Content(role="user",parts=parts)]

                if component == "imagen":
                    aspect_ratio = "16:9"
                else:
                    aspect_ratio = "1:1"

                generate_content_config = genai.types.GenerateContentConfig(
                    temperature = 1,
                    top_p = 0.95,
                    max_output_tokens = 32768,
                    response_modalities = ["IMAGE"],
                    safety_settings = [
                        genai.types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",threshold="OFF"),
                        genai.types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT",threshold="OFF"),
                        genai.types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT",threshold="OFF"),
                        genai.types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",threshold="OFF")
                    ],
                    image_config=genai.types.ImageConfig(aspect_ratio=aspect_ratio,image_size="1K",output_mime_type="image/png",),
                )

                iter=0
                flag_success=False
                while iter < VERTEX_AI_RETIRES and flag_success==False:
                    iter+=1
                    try:
                        response = client_genai.models.generate_content(model=model,contents=contents,config=generate_content_config)
                        output=response.candidates[0].content.parts[0].inline_data
                        b64_string = base64.b64encode(output.data).decode("ascii")
                        flag_success = True
                        break
                    except:
                        time_sleep.sleep(VERTEX_AI_SECONDS_SLEEP)
                if flag_success==False:
                    raise Exception("No se ha podido realizar la llamada a VertexAI")

                #Como muchas veces el contenido de la imagen puede tener texto, vamos a volver a procesarla con nano-banana para eliminarlo:
                image_genai_with_text = genai.types.Part.from_bytes(data=base64.b64decode(b64_string),mime_type="image/png")
                            
                parts=[
                    genai.types.Part.from_text(text=f"Eres un editor gráfico experto en traducir cualquier texto que aparezca en una imagen"),
                    genai.types.Part.from_text(text="La imagen que nos interesa que analices y que traduzcas todo el texto a un perfecto español:"),
                    image_genai_with_text,
                    genai.types.Part.from_text(text="Tu tarea"),
                    genai.types.Part.from_text(text="\t- Traduce el texto en la imagen si es que existe. Por el contrario proporciona la imagen tal y como es en realidad."),
                    genai.types.Part.from_text(text="\t- En ocasiones el texto podría estar mal escrito. De ser así corrige la ortografía del texto pero sin cambiar el significado del mismo."),
                    genai.types.Part.from_text(text="\t- Es de vital importancia que no existan fragmentos de texto mal escritos en la imagen pues de lo contrario nos la invalidarían en una campaña de publicidad.")
                ]

                contents = [genai.types.Content(role="user",parts=parts)]

                iter=0
                flag_success=False
                while iter < VERTEX_AI_RETIRES and flag_success==False:
                    iter+=1
                    try:
                        response = client_genai.models.generate_content(model=model,contents=contents,config=generate_content_config)
                        output=response.candidates[0].content.parts[0].inline_data
                        b64_string = base64.b64encode(output.data).decode("ascii")
                        flag_success = True
                        break
                    except:
                        time_sleep.sleep(VERTEX_AI_SECONDS_SLEEP)
                if flag_success==False:
                    raise Exception("No se ha podido realizar la llamada a VertexAI")

                #Como muchas veces el contenido de la imagen puede tener texto, vamos a volver a procesarla con nano-banana para eliminarlo:
                image_genai_with_text = genai.types.Part.from_bytes(data=base64.b64decode(b64_string),mime_type="image/png")
                            
                parts=[
                    genai.types.Part.from_text(text=f"Eres un editor gráfico experto en traducir cualquier texto que aparezca en una imagen al castellano"),
                    genai.types.Part.from_text(text="La imagen que nos interesa que analices y que traduzcas todo el texto a un perfecto español:"),
                    image_genai_with_text,
                    genai.types.Part.from_text(text="Tu tarea"),
                    genai.types.Part.from_text(text="\t- Traduce el texto en la imagen si es que existe. Por el contrario proporciona la imagen tal y como es en realidad."),
                    genai.types.Part.from_text(text="\t- En ocasiones el texto podría estar mal escrito. De ser así corrige la ortografía del texto pero sin cambiar el significado del mismo."),
                    genai.types.Part.from_text(text="\t- Es de vital importancia que no existan fragmentos de texto mal escritos en la imagen pues de lo contrario nos la invalidarían en una campaña de publicidad.")
                ]

                contents = [genai.types.Content(role="user",parts=parts)]

                iter=0
                flag_success=False
                while iter < VERTEX_AI_RETIRES and flag_success==False:
                    iter+=1
                    try:
                        response = client_genai.models.generate_content(model=model,contents=contents,config=generate_content_config)
                        output=response.candidates[0].content.parts[0].inline_data
                        b64_string = base64.b64encode(output.data).decode("ascii")
                        flag_success = True
                        break
                    except:
                        time_sleep.sleep(VERTEX_AI_SECONDS_SLEEP)
                if flag_success==False:
                    raise Exception("No se ha podido realizar la llamada a VertexAI")

                image_content.append(b64_string)
                kept_text = ""

    print(f"[PASO 9 COMPLETADO] Generación de contenido de imagen | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Se genera el contenido en formato HTML:
    print(f"[PASO 10 INICIADO] Generación de contenido en formato HTML y guardado | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    text_content_index=0
    sample_content_index=0
    image_content_index=0
    buckets_html_guardados=[]
    html_content_array=[]
    html_content=F"<!doctype html><html lang=\"es\"><head>{CSS_RULES}</head><body><div class=\"dina4\">"
    for idx, rowi in secciones.iterrows():

        print(f"[PASO 11 PROCESANDO] Step {idx + 1}/{len(secciones)} | {id_centro} {clase} {asignatura} {unidad}", flush=True)

        if rowi["pagina_seccion"] == 1:
            html_content=F"<!doctype html><html lang=\"es\"><head>{CSS_RULES}</head><body><div class=\"dina4\">"

        diapositiva = rowi["diapositiva"].lower().replace("diapositiva","").replace(".jpg","")
        html_components = HTML_JSON[rowi["tipo_plantilla"]][diapositiva]

        for component in html_components:
            html_component_iter=HTML_COMPONENTS[component]["html"]
            if "cabecera" in component:
                html_component_iter=html_component_iter.replace("#asignatura#",asignatura).replace("#nivel_academico#",clase)
            if "unidad" in component:
                html_component_iter=html_component_iter.replace("#content#",titulo_unidad)
            if "seccion" in component:
                html_component_iter=html_component_iter.replace("#content#",rowi["seccion"])
            if "texto" in component:
                html_component_iter=html_component_iter.replace("#content#",text_content[text_content_index])
                text_content_index+=1
            if "imagen" in component:
                html_component_iter=html_component_iter.replace("#base64_image#",str(image_content[image_content_index]))
                image_content_index+=1
            if "ejemplo" in component:
                html_component_iter=html_component_iter.replace("#content#",sample_content[sample_content_index])
                sample_content_index+=1
            html_content+=html_component_iter

        if rowi["pagina_seccion"] == rowi["extension_seccion"]:
            html_content+="</div></body></html>"
            bucket = storage_client.bucket(GCS_BUCKET_CONTENIDO)
            blob_path = f"{id_centro}/{clase}/{asignatura}/{unidad}/{rowi['num_seccion']}.html"
            blob = bucket.blob(blob_path)
            blob.upload_from_string(html_content, content_type="text/html; charset=utf-8")
            buckets_html_guardados.append(blob_path)
            html_content_array.append(html_content)

    print(f"[PASO 10 FINALIZADO] Generación de contenido en formato HTML y guardado | {id_centro} {clase} {asignatura} {unidad}", flush=True)


    # Se convierten los documentos de HTML a PDF y guardar en Bucket
    print(f"[PASO 11 INICIADO] Conversión de HTML a PDF y guardado | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    buckets_pdf_guardados=[]
    for idx, blob_name in enumerate(buckets_html_guardados):
        # Generar PDF directamente sin argumentos - retorna bytes
        pdf_bytes = WeasyHTML(string=html_content_array[idx]).write_pdf()
        pdf_blob_path = blob_name.rstrip('.html') + '.pdf'
        pdf_blob = bucket.blob(pdf_blob_path)
        pdf_blob.upload_from_string(pdf_bytes, content_type='application/pdf')
        buckets_pdf_guardados.append(pdf_blob_path)
    html_content_array=None
                
    print(f"[PASO 11 FINALIZADO] Conversión de HTML a PDF y guardado | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    # Se generan lso audios para cada documento generado:
    print(f"[PASO 12 INICIADO] Generando el documento de audio | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    for idx, blob_name in enumerate(buckets_pdf_guardados):

        print(f"[PASO 12 PROCESANDO] Step {idx + 1}/{len(buckets_pdf_guardados)} - Generación Dialogo | {id_centro} {clase} {asignatura} {unidad}", flush=True)
        
        model = "gemini-2.5-flash"

        document1 = genai.types.Part.from_uri(
            file_uri=f"gs://{GCS_BUCKET_CONTENIDO}/{blob_name}",
            mime_type="application/pdf",
        )

        parts=[]
        parts.append(genai.types.Part.from_text(text=f"Eres un profesor de la asignatura {asignatura} para alumnos de {clase}."))
        parts.append(genai.types.Part.from_text(text="Tu tarea es explicar a un alumno la siguiente unidad formativa"))
        parts.append(document1)
        parts.append(genai.types.Part.from_text(text=f"Para ello vas a generar un monólogo explicativo, que se dividirá en {DIALOG_CHUNKS} bloques de texto, cada uno de los cuales tendrá una extensión aproximada de {CHUNK_DIALOG_WORDS} palabras."))
        parts.append(genai.types.Part.from_text(text="Tu tarea:"))
        parts.append(genai.types.Part.from_text(text="\t 1) Lee con detenimiento el documento que se te ha proporcionado, y extrae la información más relevante para explicar la unidad formativa."))
        parts.append(genai.types.Part.from_text(text="\t 2) Organiza la información de manera clara y coherente, destacando los conceptos clave y los ejemplos relevantes."))
        parts.append(genai.types.Part.from_text(text="\t 3) Presenta la información de forma estructurada y siguiendo el mismo orden que aparece en el documento."))
        parts.append(genai.types.Part.from_text(text="\t 4) Haz citas textuales al contenido del documento, diciendo algo así como 'tal y como pone en el documento. Pero no digas 'el documento' sino 'lo que hemos visto en clase'."))
        parts.append(genai.types.Part.from_text(text=f"\t 5) Genera un monólogo explicativo dividido en {DIALOG_CHUNKS} bloques de texto, asegurándote de que cada bloque tenga una extensión aproximada de {CHUNK_DIALOG_WORDS} palabras."))
        parts.append(genai.types.Part.from_text(text="\t 6) Asegurate que cada bloque explica progresivamente el contenido, es decir, que el bloque 2 explica contenido que, secuencialmente en el documento proporcionado, aparece después del contenido explicado en el bloque 1, y así sucesivamente con los siguientes bloques."))
        parts.append(genai.types.Part.from_text(text=f"\t 7) De vez en cuando rompe la cuarta pared, dirigiéndote directamente al alumno para hacer la explicación más amena y cercana."))
        parts.append(genai.types.Part.from_text(text=f"\t 8) Mantén un tono amigable y motivador, fomentando la participación y el interés del alumno."))
        contents = [genai.types.Content(role="user",parts=parts)]

        json_properties={}
        json_required=[]
        for dialog_chunk in range(DIALOG_CHUNKS):
            json_properties[f"dialog_chunk_{dialog_chunk}"] = {"type": "STRING", "description": f"Fragmento de diálogo explicativo Nº {dialog_chunk}"}
            json_required.append(f"dialog_chunk_{dialog_chunk}")

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
            response_schema = {"type": "OBJECT","properties": json_properties,"required": json_required},
        )

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

        conversacion = response.candidates[0].content.parts[0].text
        conversacion = json.loads(conversacion)

        conversation_items =[]
        for dialog_chunk in range(DIALOG_CHUNKS):
            conversation_items.append(conversacion[f'dialog_chunk_{dialog_chunk}'])

        print(f"[PASO 12 PROCESANDO] Step {idx + 1}/{len(buckets_pdf_guardados)} - Formateando Dialogo | {id_centro} {clase} {asignatura} {unidad}", flush=True)

        model = "gemini-2.5-flash"

        monologo_list = []
        for conversation_item in conversation_items:

            parts=[]
            parts.append(genai.types.Part.from_text(text=f"Eres un experto adaptando bloques de texto para que puedan ser leídos por un sistema de síntesis de voz."))
            parts.append(genai.types.Part.from_text(text="A continuación debes ser capaz de adaptar el siguiente bloque de texto:"))
            parts.append(genai.types.Part.from_text(text=conversation_item))
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
            
            resultado_unidades2 = response.candidates[0].content.parts[0].text
            resultado_unidades2 = json.loads(resultado_unidades2)
            monologo_list.append(resultado_unidades2["Bloque adaptado"])

        print(f"[PASO 12 PROCESANDO] Step {idx + 1}/{len(buckets_pdf_guardados)} - Enfatizando Dialogo | {id_centro} {clase} {asignatura} {unidad}", flush=True)

        model = "gemini-2.5-flash"

        monologo=[]
        for monologo_item in monologo_list:

            parts=[]
            parts.append(genai.types.Part.from_text(text=f"Eres un experto en comunicación expresiva."))
            parts.append(genai.types.Part.from_text(text=f"Tu papel es incluir muletillas que permitan transmitir un mensaje con mucha más naturalidad."))
            parts.append(genai.types.Part.from_text(text=f"Para ello incorporas, a los fragmentos de texto que te proporiconan expresiones entre corchetes que indican acciones o emociones, por ejemplo, [respira profundamente], [con tono de sorpresa], [con voz baja], etc."))
            parts.append(genai.types.Part.from_text(text="A continuación debes ser capaz de adaptar el siguiente bloque de texto para que traslade una mayor naturalidad:"))
            parts.append(genai.types.Part.from_text(text=monologo_item))
            parts.append(genai.types.Part.from_text(text="Tu tarea:"))
            parts.append(genai.types.Part.from_text(text="\t 1) Le el bloque de texto con detenimiento."))
            parts.append(genai.types.Part.from_text(text="\t 2) Incorpora algunas de las siguientes muletillas pero sin hacer que el resultado parezca forzado:"))
            for item in MULETILLAS_EMOCION:
                parts.append(genai.types.Part.from_text(text=f"\t - {item}"))
                parts.append(genai.types.Part.from_text(text="Importante:"))
            parts.append(genai.types.Part.from_text(text="\t -No modifiques el contenido del bloque de texto. Solo debes proporcionar el mismo fragmento habiendo incluido muletillas entre corchetes donde puedas denotar emociones y hacer que el discuro sea mucho más natural."))
            contents = [genai.types.Content(role="user",parts=parts)]

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
            
            resultado_unidades3 = response.candidates[0].content.parts[0].text
            resultado_unidades3 = json.loads(resultado_unidades3)
            monologo.append(resultado_unidades3["Bloque adaptado"])

        print(f"[PASO 12 PROCESANDO] Step {idx + 1}/{len(buckets_pdf_guardados)} - Generando Audio | {id_centro} {clase} {asignatura} {unidad}", flush=True)

        all_audios = []

        for monologo_item in monologo:

            iter=0
            flag_success=False
            while iter < ELEVENLABS_RETIRES and flag_success==False:
                iter+=1
                try:
                    audio_stream = client_elevenlabs.text_to_speech.convert(
                        text=monologo_item,
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
        bucket = storage_client.bucket(GCS_BUCKET_CONTENIDO)
        blob = bucket.blob(blob_name.rstrip('.pdf')+'.mp3')
        blob.upload_from_string(audio_data, content_type="audio/mpeg")
                
    print(f"[PASO 12 FINALIZADO] Generando el documento de audio | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    #Se actualiza el estado de la unidad:
    print(f"[PASO 13 INICIADO] Actualización de los contenidos | {id_centro} {clase} {asignatura} {unidad}", flush=True)

    secciones_actualizadas=[]
    for idx, rowi in secciones.iterrows():

        print(f"[PASO 13 PROCESANDO] Step {idx + 1}/{len(secciones)} | {id_centro} {clase} {asignatura} {unidad}", flush=True)


        if rowi["num_seccion"] not in secciones_actualizadas:
            sql = f"""
            MERGE `{PROJECT_ID}.{DATASET_ID}.T_CONTENIDO_DISPONIBLE` AS target
            USING (
                SELECT @centro_id AS centro_id, 
                       @clase AS clase, 
                       @asignatura AS asignatura, 
                       @unidad AS unidad, 
                       @seccion AS seccion, 
                       @tipo AS tipo
            ) AS source
            ON target.centro_id = source.centro_id
               AND target.clase = source.clase
               AND target.asignatura = source.asignatura
               AND target.unidad = source.unidad
               AND target.seccion = source.seccion
               AND target.tipo = source.tipo
            WHEN MATCHED THEN
                UPDATE SET flag_creado = @flag_creado
            WHEN NOT MATCHED THEN
                INSERT (centro_id, clase, asignatura, unidad, seccion, tipo, flag_creado, flag_aprobado)
                VALUES (@centro_id, @clase, @asignatura, @unidad, @seccion, @tipo, @flag_creado, @flag_aprobado)
            """
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("centro_id", "STRING", id_centro),
                    bigquery.ScalarQueryParameter("clase", "STRING", clase),
                    bigquery.ScalarQueryParameter("asignatura", "STRING", asignatura),
                    bigquery.ScalarQueryParameter("unidad", "INT64", unidad),
                    bigquery.ScalarQueryParameter("seccion", "STRING", str(rowi["num_seccion"])),
                    bigquery.ScalarQueryParameter("tipo", "STRING", "Contenido Formativo"),
                    bigquery.ScalarQueryParameter("flag_creado", "BOOL", True),
                    bigquery.ScalarQueryParameter("flag_aprobado", "BOOL", False)
                ]
            )
            query_job = client_bigquery.query(sql, job_config=job_config)
            query_job.result()
            secciones_actualizadas.append(rowi["num_seccion"])


    print(f"[PASO 13 COMPLETADO] Actualización de los contenidos | {id_centro} {clase} {asignatura} {unidad}", flush=True)


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
        "service": "Contenido Worker",
        "status": "running",
        "version": "1.0",
        "description": "Worker para procesar mensajes de PubSub"
    }

@app.get("/health")
def health():
    """Health check para Cloud Run"""
    return {"status": "healthy", "service": "contenido-worker"}

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
        action = message_json.get("action", "generar_contenido")
        
        if action == "generar_contenido":
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
            unidad = message_json.get("unidad")
            if not unidad:
                raise HTTPException(status_code=400, detail="Missing unidad")
            
            # Generar job_id único para esta tarea
            parameters = {
                "centro_id": id_centro,
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
                generar_contenido(
                    id_centro, 
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
