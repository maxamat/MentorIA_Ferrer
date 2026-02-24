import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { signup, getInvitationInfo, me } from "../api";

export default function Alta() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const token = useMemo(() => sp.get("token") ?? "", [sp]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingToken, setLoadingToken] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar información del token al montar el componente
  useEffect(() => {
    if (!token) {
      setLoadingToken(false);
      return;
    }

    getInvitationInfo(token)
      .then((info) => {
        setUsername(info.username);
        setLoadingToken(false);
      })
      .catch((err) => {
        console.error("Error obteniendo info del token:", err);
        setError(err.message || "Token inválido o expirado");
        setLoadingToken(false);
      });
  }, [token]);

  // Validación de requisitos de contraseña
  const passwordValidation = useMemo(() => ({
    hasMinLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[@$!%*?&]/.test(password)
  }), [password]);

  const isPasswordValid = Object.values(passwordValidation).every(v => v);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const out = await signup(token, username, password, username);
      // out: { access_token, token_type }
      localStorage.setItem("jwt", out.access_token);
      
      // Obtener información del usuario para redirigir según el rol
      const userData = await me(out.access_token);
      
      // Si es alumno, redirigir a /avatar, si no a /app
      if (userData.role === "alumno") {
        navigate("/avatar");
      } else {
        navigate("/app");
      }
    } catch (err: any) {
      console.error("Error en signup:", err);
      
      // Manejar diferentes tipos de errores
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError("Error de conexión: No se puede conectar al servidor.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === 'string') {
        setError(err);
      } else if (err && typeof err === 'object') {
        // Si es un objeto, intentar extraer el mensaje
        setError(err.detail || err.message || JSON.stringify(err));
      } else {
        setError("Error desconocido al crear la cuenta.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ 
      height: "100%",
      width: "100%",
      display: "flex",
      fontFamily: "system-ui",
      background: "linear-gradient(135deg, #84BD00 0%, #009CA6 100%)",
      overflow: "hidden",
      position: "fixed",
      top: 0,
      left: 0
    }}>
      {/* Left: Video Section (70%) */}
      <div style={{ 
        width: "70%", 
        height: "100%",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Logo en esquina superior izquierda */}
        <img 
          src="/logo.png" 
          alt="Logo" 
          style={{
            position: "absolute",
            top: "24px",
            left: "24px",
            height: "60px",
            zIndex: 10,
            filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))"
          }}
        />

        {/* Video - Coloca tu archivo de video en: Portal/public/video-landing.mp4 */}
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }}
        >
          <source src="/video-landing.mp4" type="video/mp4" />
          <source src="/video-landing.webm" type="video/webm" />
        </video>

        {/* Overlay con gradiente para mejor legibilidad */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "linear-gradient(to right, rgba(132, 189, 0, 0.3), rgba(0, 156, 166, 0.3))",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "48px"
        }}>
          <img 
            src="/MentorIA.png" 
            alt="MentorIA" 
            style={{ 
              maxWidth: 400,
              width: "100%",
              height: "auto",
              marginTop: 20,
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))"
            }} 
          />
          <p style={{ 
            marginTop: 16, 
            fontSize: 20, 
            lineHeight: 1.6,
            color: "white",
            maxWidth: 500,
            textShadow: "0 2px 8px rgba(0,0,0,0.3)"
          }}>
            Plataforma educativa inteligente para centros, educadores y alumnos
          </p>
        </div>

        {/* Gradiente difuso: vertical verde-azul con opacidad horizontal */}
        <div style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "30%",
          height: "100%",
          background: "linear-gradient(to bottom, #84BD00 0%, #009CA6 100%)",
          maskImage: "linear-gradient(to right, transparent 0%, black 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 100%)",
          pointerEvents: "none"
        }} />
      </div>

      {/* Right: Alta Panel (30%) - Centrado verticalmente */}
      <div style={{ 
        width: "30%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "linear-gradient(to bottom, #84BD00 0%, #009CA6 100%)",
        overflow: "auto",
        boxShadow: "-30px 0 60px rgba(0, 0, 0, 0.2)"
      }}>
        <div style={{ 
          width: "100%",
          maxWidth: 400,
          padding: "32px",
          background: "white",
          borderRadius: 20,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
          boxSizing: "border-box"
        }}>
          <h2 style={{ 
            marginTop: 0, 
            marginBottom: 16,
            fontSize: 28,
            fontWeight: 700,
            background: "linear-gradient(135deg, #84BD00 0%, #009CA6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textAlign: "center"
          }}>
            Crear cuenta
          </h2>

          {!token && (
            <div style={{ 
              padding: 12, 
              background: "#fff3cd", 
              border: "1px solid #ffeeba",
              borderRadius: 10,
              fontSize: 14,
              marginBottom: 16,
              textAlign: "center"
            }}>
              Falta token en la URL. Debe ser /alta?token=...
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                Usuario
              </span>
              <input
                value={username}
                readOnly
                disabled
                placeholder={loadingToken ? "Cargando..." : ""}
                style={{ 
                  padding: "12px 16px", 
                  borderRadius: 12, 
                  border: "2px solid #e5e7eb",
                  fontSize: 16,
                  transition: "border-color 0.2s",
                  outline: "none",
                  background: "#f3f4f6",
                  color: "#6b7280",
                  cursor: "not-allowed"
                }}
              />
              <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>
                Usuario asignado por el administrador
              </span>
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                Contraseña
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ 
                  padding: "12px 16px", 
                  borderRadius: 12, 
                  border: "2px solid #e5e7eb",
                  fontSize: 16,
                  transition: "border-color 0.2s",
                  outline: "none"
                }}
                onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
              />
              
              {/* Requisitos de contraseña con checks dinámicos */}
              <div style={{ 
                fontSize: 12, 
                color: "#374151",
                background: "#f9fafb",
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb"
              }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  La contraseña debe contener:
                </div>
                <ul style={{ 
                  margin: 0, 
                  paddingLeft: 0, 
                  listStyle: "none",
                  display: "grid",
                  gap: 4
                }}>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{passwordValidation.hasMinLength ? "✅" : "❌"}</span>
                    <span style={{ color: passwordValidation.hasMinLength ? "#10b981" : "#6b7280" }}>
                      Mínimo 8 caracteres
                    </span>
                  </li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{passwordValidation.hasUpperCase ? "✅" : "❌"}</span>
                    <span style={{ color: passwordValidation.hasUpperCase ? "#10b981" : "#6b7280" }}>
                      Al menos una mayúscula (A-Z)
                    </span>
                  </li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{passwordValidation.hasLowerCase ? "✅" : "❌"}</span>
                    <span style={{ color: passwordValidation.hasLowerCase ? "#10b981" : "#6b7280" }}>
                      Al menos una minúscula (a-z)
                    </span>
                  </li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{passwordValidation.hasNumber ? "✅" : "❌"}</span>
                    <span style={{ color: passwordValidation.hasNumber ? "#10b981" : "#6b7280" }}>
                      Al menos un número (0-9)
                    </span>
                  </li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{passwordValidation.hasSpecialChar ? "✅" : "❌"}</span>
                    <span style={{ color: passwordValidation.hasSpecialChar ? "#10b981" : "#6b7280" }}>
                      Un carácter especial (@$!%*?&)
                    </span>
                  </li>
                </ul>
              </div>
            </label>

            <button
              disabled={busy || !token || !isPasswordValid}
              style={{
                marginTop: 8,
                padding: "14px 24px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #84BD00 0%, #009CA6 100%)",
                color: "white",
                fontSize: 16,
                fontWeight: 600,
                cursor: (busy || !token || !isPasswordValid) ? "not-allowed" : "pointer",
                opacity: (busy || !token || !isPasswordValid) ? 0.7 : 1,
                transition: "all 0.2s",
                boxShadow: "0 4px 12px rgba(0, 156, 166, 0.3)"
              }}
              onMouseEnter={(e) => {
                if (!busy && token && isPasswordValid) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(59, 130, 246, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
              }}
            >
              {busy ? "Creando..." : "Crear cuenta"}
            </button>

            {error && (
              <div style={{ 
                color: "#ef4444",
                background: "#fee2e2",
                padding: "12px 16px",
                borderRadius: 10,
                fontSize: 14,
                textAlign: "center"
              }}>
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
