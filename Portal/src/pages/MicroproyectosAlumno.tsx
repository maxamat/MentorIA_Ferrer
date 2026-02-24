import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

type Me = { username: string; role: "centro" | "profesor" | "alumno"; centro_id?: string | null };

// Función helper para formatear texto con ** en negrita y verde
function formatDescription(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} style={{ color: "#92D050", fontWeight: 700 }}>{part}</strong>;
    }
    return part;
  });
}

type Microproyecto = {
  asignatura: string;
  clase: string;
  imagebase64?: string;
  descripcion?: string;
};

export default function MicroproyectosAlumno() {
  const nav = useNavigate();
  const [data, setData] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [microproyectos, setMicroproyectos] = useState<Microproyecto[]>([]);

  const jwt = localStorage.getItem("jwt") || "";
  const BASEDATOS_BASE = import.meta.env.VITE_BASEDATOS_BASE || "";
  const BASEDATOS_API_KEY = import.meta.env.VITE_BASEDATOS_API_KEY || "";

  useEffect(() => {
    if (!jwt) {
      nav("/");
      return;
    }
    
    async function loadData() {
      try {
        const userData = await me(jwt);
        setData(userData);
        
        // Cargar microproyectos con contenido disponible (ahora incluye las imágenes)
        const response = await fetch(`${BASEDATOS_BASE}/listar_asignaturas_contenido_alumno`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": BASEDATOS_API_KEY
          },
          body: JSON.stringify({
            centro_id: userData.centro_id || "",
            alumno_id: userData.username
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          // Las imágenes ya vienen incluidas en la respuesta
          setMicroproyectos(result.asignaturas || []);
        }
        
        setLoading(false);
      } catch (e: any) {
        setError(e.message ?? String(e));
        setLoading(false);
      }
    }
    
    loadData();
  }, [nav, jwt, BASEDATOS_BASE, BASEDATOS_API_KEY]);

  function logout() {
    localStorage.removeItem("jwt");
    nav("/");
  }

  return (
    <div style={{ fontFamily: "system-ui", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Barra superior negra */}
      <header style={{
        background: "#000000",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
      }}>
        <img 
          src="/logoblanco.png" 
          alt="Ferrer" 
          style={{ height: "40px" }}
        />
        <img 
          src="/MentorIA.png" 
          alt="MentorIA" 
          style={{ height: "40px" }}
        />
      </header>

      {/* Contenedor con sidebar y contenido */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Panel lateral de navegación */}
        <nav style={{
          width: "250px",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          padding: "24px 0",
          boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
          borderRight: "1px solid #e5e7eb"
        }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", padding: "0 16px" }}>
            <button
              onClick={() => nav("/avatar")}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 700,
                color: "#92D050",
                borderRadius: "8px",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <i className="fa-solid fa-user" style={{ fontSize: "16px" }}></i>
              Mi progreso
            </button>
            <button
              onClick={() => nav("/preferencias")}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 700,
                color: "#92D050",
                borderRadius: "8px",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <i className="fa-solid fa-sliders" style={{ fontSize: "16px" }}></i>
              Mis preferencias
            </button>
            <button
              onClick={() => nav("/salidas-profesionales")}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 700,
                color: "#92D050",
                borderRadius: "8px",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <i className="fa-solid fa-briefcase" style={{ fontSize: "16px" }}></i>
              Salidas profesionales
            </button>
            <button
              onClick={() => nav("/asignaturas-alumno")}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 700,
                color: "#92D050",
                borderRadius: "8px",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <i className="fa-solid fa-book-open" style={{ fontSize: "16px" }}></i>
              Asignaturas
            </button>
            <button
              onClick={() => nav("/ejercicios")}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 700,
                color: "#92D050",
                borderRadius: "8px",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <i className="fa-solid fa-pen-to-square" style={{ fontSize: "16px" }}></i>
              Ejercicios
            </button>
            <button
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "none",
                background: "rgba(146, 208, 80, 0.1)",
                textAlign: "left",
                cursor: "default",
                fontSize: "14px",
                fontWeight: 700,
                color: "#92D050",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
            >
              <i className="fa-solid fa-diagram-project" style={{ fontSize: "16px" }}></i>
              Microproyectos
            </button>
            <button
              onClick={() => nav("/terminos-condiciones")}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 700,
                color: "#92D050",
                borderRadius: "8px",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <i className="fa-solid fa-file-contract" style={{ fontSize: "16px" }}></i>
              Términos legales
            </button>
          </div>

          {/* Botón de cerrar sesión */}
          <div style={{ padding: "0 16px", marginTop: "auto", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            <button
              onClick={logout}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
                color: "#ef4444",
                borderRadius: "8px",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <i className="fa-solid fa-right-from-bracket" style={{ fontSize: "16px" }}></i>
              Cerrar sesión
            </button>
          </div>
        </nav>
        
        {/* Contenido principal */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#F5F5F5", overflow: "auto" }}>
          <div style={{ flex: 1, padding: 24, maxWidth: 1400, margin: "0 auto", width: "100%" }}>
            {error && <div style={{ color: "crimson", padding: 16, background: "#fee2e2", borderRadius: 12, marginBottom: 16 }}>{error}</div>}
            
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                <div style={{ textAlign: "center", color: "#6b7280" }}>
                  <div style={{ fontSize: "48px", marginBottom: 16, color: "#84BD00" }}>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando microproyectos...</div>
                  <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
                </div>
              </div>
            )}

            {!loading && data && (
              <div>
                <h3 style={{ 
                  margin: "0 0 12px 0", 
                  color: "#84BD00",
                  fontWeight: 700,
                  fontSize: "32px"
                }}>Microproyectos</h3>
                <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
                  Elige una asignatura para explorar lecciones personalizadas según tus intereses y tus objetivos de aprendizaje.
                </p>

                {/* Grid de microproyectos - 3 columnas */}
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(3, 1fr)", 
                  gap: "24px",
                  marginTop: "32px"
                }}>
                  {microproyectos.map((microproyecto, index) => (
                    <div
                      key={index}
                      style={{
                        background: "white",
                        borderRadius: "12px",
                        padding: "20px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        display: "flex",
                        gap: "16px",
                        transition: "transform 0.2s, box-shadow 0.2s",
                        cursor: "pointer",
                        borderLeft: "3px solid #84BD00",
                        height: "160px"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.15)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                      }}
                    >
                      {/* Imagen a la izquierda */}
                      <img 
                        src={microproyecto.imagebase64}
                        alt={microproyecto.asignatura}
                        style={{
                          width: "80px",
                          height: "80px",
                          objectFit: "cover",
                          borderRadius: "8px",
                          flexShrink: 0,
                          alignSelf: "center"
                        }}
                      />
                      
                      {/* Contenido a la derecha */}
                      <div style={{ 
                        flex: 1, 
                        display: "flex", 
                        flexDirection: "column",
                        justifyContent: "space-between"
                      }}>
                        <div>
                          <h4 style={{ 
                            margin: "0 0 8px 0", 
                            fontSize: "18px", 
                            fontWeight: 700, 
                            color: "#1f2937" 
                          }}>
                            {microproyecto.asignatura}
                          </h4>
                          <p style={{
                            margin: 0,
                            fontSize: "13px",
                            color: "#6b7280",
                            lineHeight: 1.4,
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            textAlign: "justify"
                          }}>
                            {microproyecto.descripcion ? formatDescription(microproyecto.descripcion) : "Explora contenido diseñado para desarrollar tus habilidades y conocimientos. Aprende a tu ritmo con lecciones interactivas que se adaptan a tu estilo de aprendizaje y objetivos profesionales."}
                          </p>
                        </div>
                        
                        <button
                          onClick={() => nav(`/microproyectos-asignatura/${encodeURIComponent(microproyecto.clase)}/${encodeURIComponent(microproyecto.asignatura)}`)}
                          style={{
                            marginTop: "12px",
                            padding: "6px 12px",
                            border: "2px solid #84BD00",
                            borderRadius: "6px",
                            background: "#84BD00",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.2s",
                            alignSelf: "flex-end",
                            whiteSpace: "nowrap"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "white";
                            e.currentTarget.style.color = "#84BD00";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#84BD00";
                            e.currentTarget.style.color = "white";
                          }}
                        >
                          Continuar mi aprendizaje
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
