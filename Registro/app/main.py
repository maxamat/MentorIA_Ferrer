import os
import secrets
import datetime as dt
from typing import Optional, Literal

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

from google.cloud import firestore

from app.security import (
    sha256_hex, hash_password, verify_password,
    JwtConfig, create_access_token, decode_access_token
)

Role = Literal["centro", "profesor", "alumno"]

APP_BASE_URL = os.getenv("APP_BASE_URL", "")
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")
JWT_SECRET = os.getenv("JWT_SECRET", "")
BASEDATOS_ENDPOINT = os.getenv("BASEDATOS_ENDPOINT", "")
BASEDATOS_API_KEY = os.getenv("BASEDATOS_API_KEY", "")

jwt_cfg = JwtConfig(secret=JWT_SECRET)

app = FastAPI(title="App API (Firestore)", version="1.0")

# Configurar CORS para permitir llamadas desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://odiseia-gw-portal-baej0f92.ew.gateway.dev",
        "https://portal-cwf5jjcg7a-ew.a.run.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = firestore.Client()  # usa credenciales del entorno (en Cloud Run via SA)

USERS_COL = "users"           # doc id = username  (garantiza unicidad)
INVITES_COL = "invitations"   # doc id = token_hash (lookup O(1))

# ---------- Schemas ----------
class InvitationCreateIn(BaseModel):
    role: Role
    username: str = Field(min_length=5, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    centro_id: Optional[str] = None
    ttl_hours: int = Field(default=72, ge=1, le=720)

class AdminInvitationCreateOut(BaseModel):
    signup_url: str
    expires_at: dt.datetime

class CentroInvitationCreateOut(BaseModel):
    username: str
    password: str
    created_at: dt.datetime

class CentroInvitationCreateIn(BaseModel):
    role: Literal["profesor", "alumno"]
    username: str = Field(min_length=5, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    ttl_hours: int = Field(default=72, ge=1, le=720)

class InvitationInfoOut(BaseModel):
    username: str
    role: Role
    centro_id: Optional[str] = None
    expires_at: dt.datetime

class InvitationListItem(BaseModel):
    username: str
    role: Role
    created_at: dt.datetime
    password: Optional[str] = None  # Contraseña en texto plano

class SignupIn(BaseModel):
    token: str
    username: str = Field(min_length=5, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8, max_length=200)
    name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Nombre completo del usuario")

class LoginIn(BaseModel):
    username: str
    password: str

class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class MeOut(BaseModel):
    username: str
    name: str
    role: Role
    centro_id: Optional[str] = None

# ---------- Helpers ----------
def require_admin(x_admin_secret: Optional[str]) -> None:
    if not ADMIN_SECRET:
        raise HTTPException(status_code=500, detail="ADMIN_SECRET not configured")
    
    #incoming = (x_admin_secret or "").strip()
    #expected = ADMIN_SECRET.strip()
    if ADMIN_SECRET != x_admin_secret:
        raise HTTPException(status_code=401, detail="Invalid admin secret")
    
def check_centro(role: Optional[str], centro_id: Optional[str]) -> None:
    if centro_id is None and role in ("alumno", "profesor"):
        raise HTTPException(status_code=400, detail="centro_id is required for this role")

def require_auth(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        return decode_access_token(jwt_cfg, token)
    except Exception as e:
        import traceback
        print(f"JWT decode error: {e}")
        print(f"JWT: {token[:50]}...")
        print(traceback.format_exc())
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)

async def crear_centro_en_bigquery(centro_id: str) -> bool:
    """Llama al servicio de BaseDatos para crear el centro en BigQuery"""
    if not BASEDATOS_ENDPOINT or not BASEDATOS_API_KEY:
        print("Warning: BASEDATOS_ENDPOINT o BASEDATOS_API_KEY no configurados")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://{BASEDATOS_ENDPOINT}/crear_centro",
                json={"centro_id": centro_id},
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": BASEDATOS_API_KEY
                }
            )
            response.raise_for_status()
            return True
    except Exception as e:
        print(f"Error al crear centro en BigQuery: {e}")
        return False

async def crear_profesor_en_bigquery(profesor_id: str, centro_id: str) -> bool:
    """Llama al servicio de BaseDatos para crear el profesor en BigQuery"""
    if not BASEDATOS_ENDPOINT or not BASEDATOS_API_KEY:
        print("Warning: BASEDATOS_ENDPOINT o BASEDATOS_API_KEY no configurados")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://{BASEDATOS_ENDPOINT}/crear_profesor",
                json={"profesor_id": profesor_id, "centro_id": centro_id},
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": BASEDATOS_API_KEY
                }
            )
            response.raise_for_status()
            return True
    except Exception as e:
        print(f"Error al crear profesor en BigQuery: {e}")
        return False

async def crear_alumno_en_bigquery(alumno_id: str, centro_id: str) -> bool:
    """Llama al servicio de BaseDatos para crear el alumno en BigQuery"""
    if not BASEDATOS_ENDPOINT or not BASEDATOS_API_KEY:
        print("Warning: BASEDATOS_ENDPOINT o BASEDATOS_API_KEY no configurados")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://{BASEDATOS_ENDPOINT}/crear_alumno",
                json={"alumno_id": alumno_id, "centro_id": centro_id},
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": BASEDATOS_API_KEY
                }
            )
            response.raise_for_status()
            return True
    except Exception as e:
        print(f"Error al crear alumno en BigQuery: {e}")
        return False

async def borrar_centro_en_bigquery(centro_id: str) -> bool:
    """Llama al servicio de BaseDatos para eliminar el centro de BigQuery"""
    if not BASEDATOS_ENDPOINT or not BASEDATOS_API_KEY:
        print("Warning: BASEDATOS_ENDPOINT o BASEDATOS_API_KEY no configurados")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://{BASEDATOS_ENDPOINT}/borrar_centro",
                json={"centro_id": centro_id},
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": BASEDATOS_API_KEY
                }
            )
            response.raise_for_status()
            return True
    except Exception as e:
        print(f"Error al borrar centro en BigQuery: {e}")
        return False

async def borrar_profesor_en_bigquery(profesor_id: str, centro_id: str) -> bool:
    """Llama al servicio de BaseDatos para eliminar el profesor de BigQuery"""
    if not BASEDATOS_ENDPOINT or not BASEDATOS_API_KEY:
        print("Warning: BASEDATOS_ENDPOINT o BASEDATOS_API_KEY no configurados")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://{BASEDATOS_ENDPOINT}/borrar_profesor",
                json={"profesor_id": profesor_id, "centro_id": centro_id},
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": BASEDATOS_API_KEY
                }
            )
            response.raise_for_status()
            return True
    except Exception as e:
        print(f"Error al borrar profesor en BigQuery: {e}")
        return False

async def borrar_alumno_en_bigquery(alumno_id: str, centro_id: str) -> bool:
    """Llama al servicio de BaseDatos para eliminar el alumno de BigQuery"""
    if not BASEDATOS_ENDPOINT or not BASEDATOS_API_KEY:
        print("Warning: BASEDATOS_ENDPOINT o BASEDATOS_API_KEY no configurados")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://{BASEDATOS_ENDPOINT}/borrar_alumno",
                json={"alumno_id": alumno_id, "centro_id": centro_id},
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": BASEDATOS_API_KEY
                }
            )
            response.raise_for_status()
            return True
    except Exception as e:
        print(f"Error al borrar alumno en BigQuery: {e}")
        return False

# ---------- Endpoints ----------
@app.get("/health")
def health():
    return {"ok": True}

@app.post("/admin/invitations", response_model=AdminInvitationCreateOut)
async def create_invitation(
    payload: InvitationCreateIn,
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
    
):
    require_admin(x_admin_secret)
    check_centro(payload.role, payload.centro_id)

    # Verificar que el usuario no exista ya
    user_ref = db.collection(USERS_COL).document(payload.username)
    user_snap = user_ref.get()
    if user_snap.exists:
        raise HTTPException(status_code=409, detail=f"El usuario '{payload.username}' ya existe")

    token = secrets.token_urlsafe(32)
    token_hash = sha256_hex(token)
    now = utcnow()
    expires_at = now + dt.timedelta(hours=1) #El token de acceos dura 1 hora.

    invite_ref = db.collection(INVITES_COL).document(token_hash)
    invite_ref.set({
        "role": payload.role,
        "username": payload.username,
        "centro_id": payload.centro_id,
        "expires_at": expires_at,
        "used_at": None,
        "created_at": now,
    })

    # Crear registro en BigQuery según el rol
    if payload.role == "centro":
        centro_id = payload.centro_id if payload.centro_id else payload.username
        await crear_centro_en_bigquery(centro_id)
    elif payload.role == "profesor":
        if payload.centro_id:
            await crear_profesor_en_bigquery(payload.username, payload.centro_id)
    elif payload.role == "alumno":
        if payload.centro_id:
            await crear_alumno_en_bigquery(payload.username, payload.centro_id)

    signup_url = f"{APP_BASE_URL}/alta?token={token}"
    return AdminInvitationCreateOut(signup_url=signup_url, expires_at=expires_at)

@app.post("/centro/invitations", response_model=CentroInvitationCreateOut)
async def centro_create_invitation(
    payload: CentroInvitationCreateIn,
    authorization: Optional[str] = Header(default=None),
    x_forwarded_authorization: Optional[str] = Header(default=None, alias="X-Forwarded-Authorization")
):
    """Permite a un centro crear usuarios (profesores/alumnos) directamente con contraseña generada"""
    token_header = x_forwarded_authorization if x_forwarded_authorization else authorization
    claims = require_auth(token_header)
    
    # Verificar que el usuario es un centro
    username = claims.get("username") or claims.get("sub")
    role = claims.get("role")
    centro_id = claims.get("centro_id")
    
    if role != "centro":
        raise HTTPException(status_code=403, detail="Solo los centros pueden crear usuarios")
    
    # Verificar que el usuario no exista ya
    user_ref = db.collection(USERS_COL).document(payload.username)
    user_snap = user_ref.get()
    if user_snap.exists:
        raise HTTPException(status_code=409, detail=f"El usuario '{payload.username}' ya existe")
    
    # Generar contraseña con formato: Animal + Signo + Color + Signo + 5 dígitos
    # Ejemplo: Perro#Azul$12345
    import random
    
    # Lista de 30 animales (primera letra mayúscula, sin acentos)
    animales = [
        "Perro", "Gato", "Leon", "Tigre", "Elefante", "Jirafa", "Cebra", "Mono",
        "Caballo", "Vaca", "Oveja", "Cerdo", "Gallina", "Pato", "Conejo", "Raton",
        "Lobo", "Oso", "Zorro", "Aguila", "Halcon", "Buho", "Pinguino", "Delfin",
        "Ballena", "Tortuga", "Cocodrilo", "Serpiente", "Rana", "Mariposa"
    ]
    
    # Lista de 15 colores (primera letra mayúscula, sin acentos)
    colores = [
        "Rojo", "Azul", "Verde", "Amarillo", "Naranja", "Rosa", "Morado", "Negro",
        "Blanco", "Gris", "Marron", "Turquesa", "Violeta", "Dorado", "Plateado"
    ]
    
    # Signos de puntuación permitidos
    signos = "!@#$%&*-_+=|?"
    
    # Generar contraseña
    animal = random.choice(animales)
    color = random.choice(colores)
    signo1 = random.choice(signos)
    signo2 = random.choice(signos)
    numero = random.randint(10000, 99999)  # Número de 5 cifras
    
    password = f"{animal}{signo1}{color}{signo2}{numero}"
    
    now = utcnow()
    pwd_hash = hash_password(password)
    
    # Obtener el centro_id del centro que crea el usuario
    actual_centro_id = centro_id if centro_id else username
    
    # Crear usuario directamente
    user_ref.set({
        "username": payload.username,
        "name": payload.username,  # Por defecto usar username como nombre
        "password_hash": pwd_hash,
        "role": payload.role,
        "centro_id": actual_centro_id,
        "created_at": now,
        "updated_at": now,
        "created_by": username
    })
    
    # Guardar en colección de invitaciones para historial (con la contraseña en texto plano)
    invite_id = f"{payload.username}_{now.timestamp()}"
    invite_ref = db.collection(INVITES_COL).document(invite_id)
    invite_ref.set({
        "role": payload.role,
        "username": payload.username,
        "centro_id": actual_centro_id,
        "created_by": username,
        "created_at": now,
        "password": password,  # Guardar contraseña para que el centro pueda recuperarla
    })
    
    # Crear registro en BigQuery según el rol
    if payload.role == "profesor":
        await crear_profesor_en_bigquery(payload.username, actual_centro_id)
    elif payload.role == "alumno":
        await crear_alumno_en_bigquery(payload.username, actual_centro_id)
    
    return CentroInvitationCreateOut(username=payload.username, password=password, created_at=now)

@app.get("/centro/invitations", response_model=list[InvitationListItem])
def centro_list_invitations(
    authorization: Optional[str] = Header(default=None),
    x_forwarded_authorization: Optional[str] = Header(default=None, alias="X-Forwarded-Authorization")
):
    """Lista los usuarios creados por el centro"""
    token_header = x_forwarded_authorization if x_forwarded_authorization else authorization
    claims = require_auth(token_header)
    
    username = claims.get("username") or claims.get("sub")
    role = claims.get("role")
    
    if role != "centro":
        raise HTTPException(status_code=403, detail="Solo los centros pueden ver sus usuarios")
    
    # Buscar todos los usuarios creados por este centro
    invites = db.collection(INVITES_COL).where("created_by", "==", username).stream()
    
    result = []
    for doc in invites:
        inv = doc.to_dict()
        result.append(InvitationListItem(
            username=inv.get("username", ""),
            role=inv.get("role"),
            created_at=inv.get("created_at"),
            password=inv.get("password", "")
        ))
    
    # Ordenar por fecha de creación descendente
    result.sort(key=lambda x: x.created_at, reverse=True)
    return result

@app.delete("/centro/invitations/{username}")
async def centro_delete_user(
    username: str,
    authorization: Optional[str] = Header(default=None),
    x_forwarded_authorization: Optional[str] = Header(default=None, alias="X-Forwarded-Authorization")
):
    """Elimina un usuario y su historial de invitaciones"""
    token_header = x_forwarded_authorization if x_forwarded_authorization else authorization
    claims = require_auth(token_header)
    
    centro_username = claims.get("username") or claims.get("sub")
    role = claims.get("role")
    centro_id = claims.get("centro_id")
    
    if role != "centro":
        raise HTTPException(status_code=403, detail="Solo los centros pueden eliminar usuarios")
    
    # Obtener datos del usuario antes de eliminarlo
    user_ref = db.collection(USERS_COL).document(username)
    user_snap = user_ref.get()
    user_role = None
    user_centro_id = None
    
    if user_snap.exists:
        user_data = user_snap.to_dict()
        user_role = user_data.get("role")
        user_centro_id = user_data.get("centro_id")
    
    # Verificar que el usuario fue creado por este centro
    invites_query = db.collection(INVITES_COL).where("created_by", "==", centro_username).where("username", "==", username).stream()
    
    found = False
    for doc in invites_query:
        found = True
        doc.reference.delete()
    
    if not found:
        raise HTTPException(status_code=404, detail="Usuario no encontrado o no pertenece a este centro")
    
    # Eliminar de BigQuery según el rol
    if user_role and user_centro_id:
        if user_role == "profesor":
            await borrar_profesor_en_bigquery(username, user_centro_id)
        elif user_role == "alumno":
            await borrar_alumno_en_bigquery(username, user_centro_id)
        elif user_role == "centro":
            await borrar_centro_en_bigquery(username)
    
    # Eliminar el usuario de la colección de usuarios
    if user_snap.exists:
        user_ref.delete()
    
    return {"ok": True, "message": f"Usuario {username} eliminado correctamente"}

@app.post("/centro/invitations/{username}/regenerate", response_model=AdminInvitationCreateOut)
def regenerate_invitation(
    username: str,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_forwarded_authorization: Optional[str] = Header(default=None, alias="X-Forwarded-Authorization")
):
    """Regenera una invitación expirada para un usuario específico"""
    token_header = x_forwarded_authorization if x_forwarded_authorization else authorization
    claims = require_auth(token_header)
    
    centro_username = claims.get("username") or claims.get("sub")
    role = claims.get("role")
    centro_id = claims.get("centro_id")
    
    if role != "centro":
        raise HTTPException(status_code=403, detail="Solo los centros pueden regenerar invitaciones")
    
    # Buscar la invitación expirada del usuario
    invites_query = db.collection(INVITES_COL).where("created_by", "==", centro_username).where("username", "==", username).stream()
    
    old_invite = None
    old_token_hash = None
    for doc in invites_query:
        inv_data = doc.to_dict()
        if inv_data.get("expires_at") < utcnow() and not inv_data.get("used_at"):
            old_invite = inv_data
            old_token_hash = doc.id
            break
    
    if not old_invite:
        raise HTTPException(status_code=404, detail="No se encontró una invitación expirada para este usuario")
    
    # Generar nuevo token y crear nueva invitación
    now = utcnow()
    ttl_hours = 72
    expires_at = now + dt.timedelta(hours=ttl_hours)
    token = secrets.token_urlsafe(32)
    token_hash = sha256_hex(token)
    
    invite_data = {
        "username": username,
        "role": old_invite["role"],
        "centro_id": centro_id,
        "created_at": now,
        "expires_at": expires_at,
        "used_at": None,
        "created_by": centro_username,
        "token": token
    }
    
    # Eliminar invitación antigua y crear nueva
    db.collection(INVITES_COL).document(old_token_hash).delete()
    db.collection(INVITES_COL).document(token_hash).set(invite_data)
    
    signup_url = f"{APP_BASE_URL}/alta?token={token}"
    return AdminInvitationCreateOut(signup_url=signup_url, expires_at=expires_at)

@app.get("/auth/invitation-info", response_model=InvitationInfoOut)
def get_invitation_info(token: str):
    """Obtiene la información de una invitación sin consumirla"""
    now = utcnow()
    token_hash = sha256_hex(token)
    
    invite_ref = db.collection(INVITES_COL).document(token_hash)
    invite_snap = invite_ref.get()
    
    if not invite_snap.exists:
        raise HTTPException(status_code=400, detail="Token inválido")
    
    inv = invite_snap.to_dict()
    if inv.get("used_at") is not None:
        raise HTTPException(status_code=400, detail="Token ya utilizado")
    
    expires_at = inv.get("expires_at")
    if not isinstance(expires_at, dt.datetime):
        raise HTTPException(status_code=500, detail="Datos de invitación inválidos")
    if expires_at < now:
        raise HTTPException(status_code=400, detail="Token expirado")
    
    return InvitationInfoOut(
        username=inv.get("username", ""),
        role=inv["role"],
        centro_id=inv.get("centro_id"),
        expires_at=expires_at
    )

@app.post("/auth/signup", response_model=AuthOut)
def signup(payload: SignupIn):
    now = utcnow()
    token_hash = sha256_hex(payload.token)

    invite_ref = db.collection(INVITES_COL).document(token_hash)
    user_ref = db.collection(USERS_COL).document(payload.username)

    @firestore.transactional
    def txn_create_user(transaction: firestore.Transaction):
        invite_snap = invite_ref.get(transaction=transaction)
        if not invite_snap.exists:
            raise HTTPException(status_code=400, detail="Invalid token")

        inv = invite_snap.to_dict()
        if inv.get("used_at") is not None:
            raise HTTPException(status_code=400, detail="Token already used")

        expires_at = inv.get("expires_at")
        if not isinstance(expires_at, dt.datetime):
            raise HTTPException(status_code=500, detail="Invalid invitation data")
        if expires_at < now:
            raise HTTPException(status_code=400, detail="Token expired")

        # Verificar que el username proporcionado coincida con el del token
        invited_username = inv.get("username")
        if invited_username and payload.username != invited_username:
            raise HTTPException(
                status_code=400, 
                detail=f"El usuario debe ser '{invited_username}', no '{payload.username}'"
            )

        # username único: si el doc existe, ya está ocupado
        user_snap = user_ref.get(transaction=transaction)
        if user_snap.exists:
            raise HTTPException(status_code=409, detail="Username already taken")

        pwd_hash = hash_password(payload.password)

        # Usar username como name si no se proporciona
        user_name = payload.name if payload.name else payload.username

        transaction.set(user_ref, {
            "username": payload.username,
            "name": user_name,
            "password_hash": pwd_hash,
            "role": inv["role"],
            "centro_id": inv.get("centro_id"),
            "created_at": now,
            "updated_at": now,
        })

        transaction.update(invite_ref, {
            "used_at": now,
            "password": payload.password,  # Guardar contraseña en texto plano para recuperación
        })

        return inv["role"], inv.get("centro_id")

    transaction = db.transaction()
    role, centro_id = txn_create_user(transaction)

    access = create_access_token(jwt_cfg, {
        "sub": payload.username,
        "username": payload.username,
        "name": payload.name,
        "role": role,
        "centro_id": centro_id,
    })
    return AuthOut(access_token=access)

@app.post("/auth/login", response_model=AuthOut)
def login(payload: LoginIn):
    user_ref = db.collection(USERS_COL).document(payload.username)
    snap = user_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    u = snap.to_dict()
    if not verify_password(payload.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access = create_access_token(jwt_cfg, {
        "sub": u["username"],
        "username": u["username"],
        "name": u.get("name", ""),
        "role": u["role"],
        "centro_id": u.get("centro_id"),
    })
    return AuthOut(access_token=access)

@app.get("/me", response_model=MeOut)
def me(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_forwarded_authorization: Optional[str] = Header(default=None, alias="X-Forwarded-Authorization")
):
    # API Gateway reemplaza Authorization con su propio RS256 JWT
    # El JWT original (HS256) del usuario se envía en X-Forwarded-Authorization
    token_header = x_forwarded_authorization if x_forwarded_authorization else authorization
    
    claims = require_auth(token_header)
    username = claims.get("username") or claims.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")

    snap = db.collection(USERS_COL).document(username).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="User not found")

    u = snap.to_dict()
    return MeOut(username=u["username"], name=u.get("name", ""), role=u["role"], centro_id=u.get("centro_id"))
