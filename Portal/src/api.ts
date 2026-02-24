export async function obtenerImagenSalida(centro_id: string, alumno_id: string, titulo: string) {
  const res = await fetch(`${BASEDATOS_BASE}/obtener_imagen_salida`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": BASEDATOS_API_KEY,
    },
    body: JSON.stringify({ centro_id, alumno_id, titulo })
  });
  if (!res.ok) throw new Error("No se pudo obtener la imagen de la salida");
  return res.json();
}
const API_BASE = import.meta.env.VITE_API_BASE as string; // ej: https://tu-gateway.ew.gateway.dev
const API_KEY = import.meta.env.VITE_API_KEY as string;   // tu x-api-key

if (!API_BASE) throw new Error("Missing VITE_API_BASE");
if (!API_KEY) throw new Error("Missing VITE_API_KEY");

async function request(path: string, opts: RequestInit = {}, jwt?: string) {
  const headers: Record<string, string> = {
    "x-api-key": API_KEY,
    ...(opts.headers as any),
  };

  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
    headers["X-JWT-Token"] = `Bearer ${jwt}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = (data && data.detail) ? data.detail : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function health() {
  return request("/health");
}

export async function getInvitationInfo(token: string) {
  return request(`/auth/invitation-info?token=${encodeURIComponent(token)}`);
}

export async function signup(token: string, username: string, password: string, name: string) {
  return request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, username, password, name }),
  });
}

export async function login(username: string, password: string) {
  return request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function me(jwt: string) {
  return request("/me", { method: "GET" }, jwt);
}

export async function createInvitation(jwt: string, role: string, username: string, ttl_hours: number = 72) {
  return request("/centro/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, username, ttl_hours }),
  }, jwt);
}

export async function listInvitations(jwt: string) {
  return request("/centro/invitations", { method: "GET" }, jwt);
}

export async function deleteUser(jwt: string, username: string) {
  return request(`/centro/invitations/${username}`, {
    method: "DELETE",
  }, jwt);
}

export async function regenerateInvitation(jwt: string, username: string) {
  return request(`/centro/invitations/${username}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }, jwt);
}

// BaseDatos API
const BASEDATOS_BASE = import.meta.env.VITE_BASEDATOS_BASE as string;
const BASEDATOS_API_KEY = import.meta.env.VITE_BASEDATOS_API_KEY as string;

if (!BASEDATOS_BASE) throw new Error("Missing VITE_BASEDATOS_BASE");
if (!BASEDATOS_API_KEY) throw new Error("Missing VITE_BASEDATOS_API_KEY");

export async function verificarConsentimiento(userId: string, centroId: string) {
  const res = await fetch(`${BASEDATOS_BASE}/verificar_consentimiento?user_id=${encodeURIComponent(userId)}&centro_id=${encodeURIComponent(centroId)}`, {
    method: "GET",
    headers: {
      "x-api-key": BASEDATOS_API_KEY,
    },
  });
  return res.json();
}

export async function registrarConsentimiento(userId: string, centroId: string) {
  const res = await fetch(`${BASEDATOS_BASE}/registrar_consentimiento?user_id=${encodeURIComponent(userId)}&centro_id=${encodeURIComponent(centroId)}`, {
    method: "POST",
    headers: {
      "x-api-key": BASEDATOS_API_KEY,
    },
  });
  return res.json();
}
