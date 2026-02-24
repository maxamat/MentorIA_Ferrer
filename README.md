# 🎓 MentorIA

Plataforma educativa inteligente basada en IA para la gestión y personalización del aprendizaje. Sistema de microservicios que integra generación automática de contenido educativo, evaluación adaptativa y mentoría personalizada para centros educativos, profesores y alumnos.

## 📋 Descripción

MentorIA es una solución completa de gestión educativa que utiliza Inteligencia Artificial (Google Gemini) para generar contenido formativo personalizado, evaluar ejercicios y trabajos, y proporcionar recomendaciones adaptadas a cada estudiante. El sistema está diseñado con una arquitectura de microservicios desplegada en Google Cloud Platform.

## ✨ Características Principales

- 🤖 **Generación Automática de Contenido**: Creación de material didáctico personalizado con texto, imágenes y audio
- 📝 **Evaluación Inteligente**: Corrección automática de ejercicios y trabajos con feedback detallado
- 👥 **Gestión Multi-rol**: Soporte para centros educativos, profesores y alumnos
- 🎯 **Recomendaciones Personalizadas**: Sugerencias de profesores y salidas profesionales adaptadas
- 📊 **Dashboard Analítico**: Seguimiento del progreso y estadísticas de aprendizaje
- 🎨 **Avatares Personalizados**: Sistema de personalización de perfiles
- 📚 **Gestión de Currículums**: Organización de asignaturas, unidades y secciones
- 🔊 **Contenido Multimedia**: Generación de audio con ElevenLabs y documentos PDF

## 🏗️ Arquitectura del Sistema

El proyecto está organizado en microservicios independientes:

### **Backend Workers (Python + FastAPI)**
- **BaseDatos**: API principal de gestión de datos con BigQuery
- **Contenido - Worker**: Generación de contenido formativo (texto, PDF, audio)
- **Ejercicio - Worker**: Generación de ejercicios adaptativos
- **Ejercicio Corrector - Worker**: Corrección automática de ejercicios
- **Trabajo - Worker**: Generación de microproyectos
- **Trabajo Corrector - Worker**: Evaluación de trabajos prácticos
- **Programaciones - Worker**: Gestión de programaciones didácticas
- **Secciones - Worker**: Organización de contenido por secciones
- **Recomendador Profesor - Worker**: Sistema de recomendación de docentes
- **Recomendador Salidas - Worker**: Sugerencias de salidas profesionales
- **Registro**: Autenticación y gestión de usuarios (Firestore + JWT)

### **Frontend (React + TypeScript)**
- **Portal**: Aplicación web SPA con Vite y React Router

### **Infraestructura**
- **Google Cloud Platform**: Cloud Run, BigQuery, Cloud Storage, Cloud Tasks
- **API Gateway**: Control de acceso y enrutamiento
- **Docker**: Contenedorización de todos los servicios

```
┌─────────────────────────────────────────────────────────────┐
│                        API Gateway                          │
│              (openapi-gateway.yaml)                         │
└─────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌──────▼──────────┐
│  Portal (React)│  │  Registro       │  │  BaseDatos      │
│  TypeScript    │  │  (Firestore)    │  │  (BigQuery)     │
└────────────────┘  └─────────────────┘  └─────────────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────┐
                    │                             │             │
           ┌────────▼──────┐           ┌──────────▼────┐  ┌────▼─────────┐
           │ Contenido     │           │  Ejercicio    │  │  Trabajo     │
           │ Worker        │           │  Worker       │  │  Worker      │
           └───────────────┘           └───────────────┘  └──────────────┘
                    │                          │                 │
           ┌────────▼──────┐           ┌──────▼──────────┐ ┌────▼─────────┐
           │ Secciones     │           │ Corrector       │ │ Corrector    │
           │ Worker        │           │ Ejercicio       │ │ Trabajo      │
           └───────────────┘           └─────────────────┘ └──────────────┘
```

## 🚀 Requisitos Previos

### Software
- **Python** 3.10 o superior
- **Node.js** 18+ y npm
- **Docker** (para despliegue)
- **Google Cloud SDK** (gcloud CLI)

### Credenciales y APIs
- Cuenta de Google Cloud Platform con los siguientes servicios habilitados:
  - BigQuery
  - Cloud Storage
  - Cloud Run
  - Cloud Tasks
  - Firestore
- API Key de Google Gemini
- API Key de ElevenLabs (para generación de audio)

## 📦 Instalación

### 1. Clonar el Repositorio
```bash
git clone https://github.com/tu-usuario/mentoria-max.git
cd mentoria-max
```

### 2. Configurar Credenciales

Coloca el archivo `credentials.json` de Google Cloud en cada carpeta de worker:
```
BaseDatos/app/credentials/credentials.json
Contenido - Worker/app/credentials/credentials.json
Ejercicio - Worker/app/credentials/credentials.json
... (repetir para todos los workers)
```

### 3. Instalar Dependencias Backend

Para cada worker:
```bash
cd "BaseDatos"
pip install -r app/requirements.txt

cd "../Contenido - Worker"
pip install -r app/requirements.txt

# Repetir para cada servicio...
```

### 4. Instalar Dependencias Frontend

```bash
cd Portal
npm install
```

## ⚙️ Configuración

### Variables de Entorno

Cada worker requiere las siguientes variables de entorno (crear archivo `.env` en cada carpeta):

**BaseDatos, Contenido, Ejercicio, Trabajo, etc:**
```env
PROJECT_ID=tu-proyecto-gcp
DATASET_ID=tu-dataset-bigquery
REGION=europe-west1
GOOGLE_CLOUD_GEMINI_API_KEY=tu-api-key-gemini
ELEVENLABS_API_KEY=tu-api-key-elevenlabs
GCS_BUCKET_CONTENIDO=bucket-contenido
GCS_BUCKET_ASIGNATURAS=bucket-asignaturas
GCS_BUCKET_AVATARES=bucket-avatares
GCS_BUCKET_SALIDAS=bucket-salidas
GCS_BUCKET_CURRICULUMS=bucket-curriculums
GCS_BUCKET_TRABAJO=bucket-trabajo
GCS_BUCKET_EJERCICIO=bucket-ejercicio
GCS_BUCKET_EJERCICIO_TMP=bucket-ejercicio-tmp
GCS_BUCKET_TRABAJO_TMP=bucket-trabajo-tmp
```

**Registro:**
```env
APP_BASE_URL=https://tu-dominio.com
ADMIN_SECRET=tu-secret-admin
JWT_SECRET=tu-secret-jwt
BASEDATOS_ENDPOINT=https://basedatos-endpoint.run.app
BASEDATOS_API_KEY=tu-api-key
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
```

**Portal:**
```env
VITE_API_BASE_URL=https://tu-api-gateway.dev
```

## 🎯 Uso

### Desarrollo Local

**Backend (ejemplo con BaseDatos):**
```bash
cd BaseDatos/app
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd Portal
npm run dev
```
El portal estará disponible en `http://localhost:5173`

### Endpoints Principales

**Registro y Autenticación:**
- `POST /invitations` - Crear invitación
- `POST /signup` - Registro de usuario
- `POST /login` - Inicio de sesión
- `GET /me` - Obtener información del usuario

**Gestión de Datos (BaseDatos):**
- `GET /centros` - Listar centros educativos
- `GET /profesores` - Listar profesores
- `GET /alumnos` - Listar alumnos
- `GET /asignaturas` - Listar asignaturas
- `GET /clases` - Listar clases

**Contenido:**
- `POST /generate-content` - Generar contenido formativo
- `GET /content/{id}` - Obtener contenido generado

**Evaluación:**
- `POST /generate-exercise` - Generar ejercicio
- `POST /correct-exercise` - Corregir ejercicio
- `POST /generate-project` - Generar microproyecto
- `POST /correct-project` - Evaluar trabajo

## 🐳 Despliegue con Docker

### Build de Imagen

Cada servicio tiene su propio Dockerfile:

```bash
cd BaseDatos
docker build -t gcr.io/tu-proyecto/basedatos:latest .
docker push gcr.io/tu-proyecto/basedatos:latest
```

### Despliegue en Cloud Run

```bash
gcloud run deploy basedatos \
  --image gcr.io/tu-proyecto/basedatos:latest \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars PROJECT_ID=tu-proyecto,DATASET_ID=tu-dataset
```

### API Gateway

Cada servicio incluye su archivo `openapi-gateway.yaml` para configurar el API Gateway:

```bash
gcloud api-gateway api-configs create basedatos-config \
  --api=basedatos-api \
  --openapi-spec=openapi-gateway.yaml \
  --backend-auth-service-account=tu-service-account@tu-proyecto.iam.gserviceaccount.com
```

## 📁 Estructura del Proyecto

```
MentorIA/
├── Portal/                          # Frontend React + TypeScript
│   ├── src/
│   │   ├── pages/                   # Componentes de páginas
│   │   ├── App.tsx                  # Enrutamiento principal
│   │   └── api.ts                   # Cliente API
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── Registro/                        # Servicio de autenticación
│   ├── app/
│   │   ├── main.py                  # API FastAPI
│   │   └── security.py              # JWT y encriptación
│   └── Dockerfile
│
├── BaseDatos/                       # API principal de datos
│   ├── app/
│   │   ├── main.py                  # Endpoints BigQuery
│   │   ├── requirements.txt
│   │   └── credentials/
│   ├── openapi-gateway.yaml
│   └── Dockerfile
│
├── Contenido - Worker/              # Generador de contenido
├── Ejercicio - Worker/              # Generador de ejercicios
├── Ejercicio Corrector - Worker/   # Corrector de ejercicios
├── Trabajo - Worker/                # Generador de microproyectos
├── Trabajo Corrector - Worker/     # Evaluador de trabajos
├── Programaciones - Worker/         # Gestión de programaciones
├── Secciones - Worker/              # Organización de secciones
├── Recomendador Profesor - Worker/ # IA recomendación profesores
└── Recomendador Salidas - Worker/  # IA salidas profesionales
```

## 🛠️ Tecnologías Utilizadas

### Backend
- **Framework**: FastAPI 0.115.6
- **Servidor**: Uvicorn
- **Lenguaje**: Python 3.10+
- **Autenticación**: PyJWT, Argon2-cffi
- **Validación**: Pydantic 2.10.4
- **Datos**: Pandas 2.2.0

### Inteligencia Artificial
- **IA Generativa**: Google Gemini (google-genai 1.57.0)
- **Síntesis de Voz**: ElevenLabs API
- **Generación PDF**: WeasyPrint

### Google Cloud Platform
- **Base de Datos**: BigQuery
- **Almacenamiento**: Cloud Storage
- **Autenticación**: Firestore
- **Orquestación**: Cloud Tasks
- **Pub/Sub**: Cloud Pub/Sub
- **Contenedores**: Cloud Run

### Frontend
- **Framework**: React 18.3.1
- **Lenguaje**: TypeScript 5.6.2
- **Enrutamiento**: React Router DOM 6.26.2
- **Build Tool**: Vite 5.4.8
- **Styling**: CSS personalizado

### DevOps
- **Contenedores**: Docker
- **CI/CD**: Cloud Build (cloudbuild.yaml)
- **API Management**: Google Cloud API Gateway
- **CORS**: Configuración personalizada (cors.json)

## 📚 Documentación Adicional

- **Despliegue**: Consulta los archivos `Despliegue.txt` en cada servicio
- **API Gateway**: Revisa los archivos `openapi-gateway.yaml` para especificaciones de endpoints
- **CORS**: Configuración en `cors.json` de cada worker

## 🔒 Seguridad

- Autenticación JWT con tokens seguros
- Contraseñas hasheadas con Argon2
- Service Accounts de GCP con permisos mínimos
- API Keys protegidas mediante variables de entorno
- CORS configurado restrictivamente
- Validación de entrada con Pydantic

## 🧪 Testing

```bash
# Ejecutar tests de backend
cd BaseDatos
pytest app/tests/

# Ejecutar tests de frontend
cd Portal
npm test
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Estándares de Código
- **Python**: Seguir PEP 8
- **TypeScript**: Seguir las reglas de ESLint configuradas
- **Commits**: Mensajes descriptivos en español o inglés

## 📄 Licencia

Este proyecto es privado y propietario. Todos los derechos reservados.

## 👥 Autores

- **FERRER** - Desarrollo y arquitectura

## 📞 Soporte

Para soporte técnico o consultas sobre el proyecto:
- Poner comentario
- **Documentación interna**: Consultar archivos `Despliegue.txt` de cada servicio

## 🗺️ Roadmap

- [ ] Implementar caché con Redis para mejorar rendimiento
- [ ] Añadir tests unitarios y de integración
- [ ] Dashboard de analíticas avanzadas
- [ ] Soporte multiidioma
- [ ] App móvil nativa (React Native)
- [ ] Integración con LMS externos (Moodle, Canvas)
- [ ] Sistema de notificaciones en tiempo real
- [ ] Gamificación del aprendizaje

## 🙏 Agradecimientos

- Google Cloud Platform por la infraestructura
- Google Gemini por las capacidades de IA generativa
- ElevenLabs por la síntesis de voz de alta calidad
- La comunidad de FastAPI y React por las excelentes herramientas

---

**Versión**: 1.0.0  
**Última actualización**: Febrero 2026
