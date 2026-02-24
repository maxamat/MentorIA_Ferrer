import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, me } from "../api";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    console.log("🔐 [LOGIN] Iniciando login para usuario:", username);
    try {
      console.log("🔐 [LOGIN] Llamando a API login...");
      const out = await login(username, password); // {access_token, token_type}
      console.log("🔐 [LOGIN] ✅ Login exitoso, access_token recibido:", out.access_token.substring(0, 20) + "...");
      
      localStorage.setItem("jwt", out.access_token);
      console.log("🔐 [LOGIN] ✅ JWT guardado en localStorage");
      
      // Obtener información del usuario para redirigir según el rol
      console.log("🔐 [LOGIN] Llamando a /me para obtener datos del usuario...");
      const userData = await me(out.access_token);
      console.log("🔐 [LOGIN] ✅ Datos de usuario recibidos:", userData);
      
      // Si es alumno, redirigir a /avatar, si no a /app
      if (userData.role === "alumno") {
        console.log("🔐 [LOGIN] 🎒 Usuario es alumno, navegando a /avatar");
        nav("/avatar");
      } else {
        console.log("🔐 [LOGIN] 👨‍🏫 Usuario es", userData.role, "navegando a /app");
        nav("/app");
      }
    } catch (err: any) {
      console.error("🔐 [LOGIN] ❌ ERROR:", err);
      setError(err.message ?? String(err));
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
          src="/MentorIA.png" 
          alt="MentorIA" 
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
          background: "linear-gradient(to right, rgba(200, 200, 200, 0.3), rgba(180, 180, 180, 0.3))",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "flex-start",
          padding: "48px"
        }}>
          <img 
            src="/logoblanco.png" 
            alt="Logo" 
            style={{ 
              height: "60px",
              width: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))"
            }} 
          />
        </div>

        {/* Gradiente difuso: vertical con opacidad horizontal */}
        <div style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "30%",
          height: "100%",
          background: "#F5F5F5",
          maskImage: "linear-gradient(to right, transparent 0%, black 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 100%)",
          pointerEvents: "none"
        }} />
      </div>

      {/* Right: Login Panel (30%) - Centrado verticalmente */}
      <div style={{ 
        width: "30%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#F5F5F5",
        overflow: "hidden",
        boxShadow: "-30px 0 60px rgba(0, 0, 0, 0.2)"
      }}>
        <div style={{ 
          width: "100%",
          maxWidth: 400,
          display: "flex",
          flexDirection: "column",
          gap: 40
        }}>
          {/* Bloque de texto informativo */}
          <div>
            <h2 style={{
              margin: "0 0 16px 0",
              fontSize: 28,
              fontWeight: 700,
              color: "#92D050",
              textAlign: "center"
            }}>
              Abre nuevos caminos
            </h2>
            <p style={{
              margin: "0 0 16px 0",
              fontSize: 14,
              lineHeight: 1.6,
              color: "#374151",
              textAlign: "center"
            }}>
              Por primera vez, <strong style={{ color: "#92D050" }}>todo lo que vas a aprender se adaptará a lo que te interesa</strong>, a cómo aprendes mejor y a lo que necesitas reforzar. Actividades cortas y retadoras para que avances sin agobiarte, resúmenes en audio y ejercicios con claros ejemplos.
            </p>
            <p style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: "#374151",
              textAlign: "center"
            }}>
              Casi sin darte cuenta, <strong style={{ color: "#92D050" }}>irás descubriendo qué temas te enganchan de veras, qué se te da bien y cómo elegir qué estudiar después</strong> para acercarte a un futuro en el que puedas trabajar en lo que verdaderamente te apasiona.
            </p>
          </div>

          {/* Formulario de login */}
          <div style={{ 
            padding: "32px",
            background: "white",
            borderRadius: 20,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)"
          }}>
          <h2 style={{ 
            marginTop: 0, 
            marginBottom: 24,
            fontSize: 28,
            fontWeight: 700,
            color: "#92D050",
            textAlign: "center"
          }}>
            Iniciar sesión
          </h2>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                Usuario
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Introduce tu nombre de usuario"
                required
                style={{ 
                  padding: "12px 16px", 
                  borderRadius: 12, 
                  border: "2px solid #e5e7eb",
                  fontSize: 14,
                  transition: "border-color 0.2s",
                  outline: "none"
                }}
                onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                Contraseña
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Introduce tu contraseña"
                required
                style={{ 
                  padding: "12px 16px", 
                  borderRadius: 12, 
                  border: "2px solid #e5e7eb",
                  fontSize: 14,
                  transition: "border-color 0.2s",
                  outline: "none"
                }}
                onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
              />
            </label>

            <button
              disabled={busy}
              style={{
                marginTop: 8,
                padding: "14px 24px",
                borderRadius: 12,
                border: "none",
                background: "#92D050",
                color: "white",
                fontSize: 16,
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.7 : 1,
                transition: "all 0.2s",
                boxShadow: "0 4px 12px rgba(146, 208, 80, 0.3)"
              }}
              onMouseEnter={(e) => {
                if (!busy) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(146, 208, 80, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(146, 208, 80, 0.3)";
              }}
            >
              {busy ? "Iniciando sesión..." : "Iniciar Sesión"}
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
    </div>
  );
}