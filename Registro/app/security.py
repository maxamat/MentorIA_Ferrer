import hashlib
import time
from dataclasses import dataclass
from typing import Any, Dict

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher()

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    try:
        ph.verify(password_hash, password)
        return True
    except VerifyMismatchError:
        return False

def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

@dataclass
class JwtConfig:
    secret: str
    issuer: str = "app-api"
    audience: str = "app-frontend"
    access_ttl_seconds: int = 60 * 60 * 8  # 8h

def create_access_token(cfg: JwtConfig, claims: Dict[str, Any]) -> str:
    now = int(time.time())
    payload = {
        "iss": cfg.issuer,
        "aud": cfg.audience,
        "iat": now,
        "exp": now + cfg.access_ttl_seconds,
        **claims,
    }
    return jwt.encode(payload, cfg.secret, algorithm="HS256")

def decode_access_token(cfg: JwtConfig, token: str) -> Dict[str, Any]:
    return jwt.decode(
        token,
        cfg.secret,
        algorithms=["HS256"],
        audience=cfg.audience,
        issuer=cfg.issuer,
    )
