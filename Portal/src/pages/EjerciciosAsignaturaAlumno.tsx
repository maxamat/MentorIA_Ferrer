import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { me } from "../api";

export default function EjerciciosAsignaturaAlumno() {
  const nav = useNavigate();
  const { clase, asignatura } = useParams<{ clase: string; asignatura: string }>();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [alumnoId, setAlumnoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function logout() {
    localStorage.removeItem("jwt");
    nav("/login");
  }

  // Datos de unidades
  const [unidades, setUnidades] = useState<any[]>([]);

  useEffect(() => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      nav("/");
      return;
    }
    me(jwt).then(data => {
      setUserRole(data.role);
      setCentroId(data.centro_id);
      setAlumnoId(data.username);

      // Cargar unidades disponibles para esta asignatura
      if (clase && asignatura && data.centro_id) {
        fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_unidades_disponibles_alumno`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
          body: JSON.stringify({ 
            centro_id: data.centro_id,
            alumno_id: data.username,
            clase: decodeURIComponent(clase), 
            asignatura: decodeURIComponent(asignatura) 
          })
        })
          .then(r => r.json())
          .then(res => {
            setUnidades(res.unidades || []);
          })
          .catch(() => setUnidades([]));
      }

      setLoading(false);
    });
  }, [nav, clase, asignatura]);

  // Función para ver ejercicio
  const handleVerContenido = (unidad: any) => {
    // Navegar a la página de detalle del ejercicio
    nav(`/ejercicio/${clase}/${asignatura}/${unidad.unidad}`);
  };

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
        <img src="/logoblanco.png" alt="Ferrer" style={{ height: "40px" }} />
        <img src="/MentorIA.png" alt="MentorIA" style={{ height: "40px" }} />
      </header>

      {/* Contenedor con sidebar y contenido */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Panel lateral de navegación */}
        {!loading && (
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
            <button onClick={() => nav("/ejercicios")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "rgba(146, 208, 80, 0.1)", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }}><i className="fa-solid fa-arrow-left" style={{ fontSize: "16px" }}></i>Volver</button>
          </div>

          {/* Botón de cerrar sesión */}
          <div style={{ padding: "0 16px", marginTop: "auto" }}>
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
        )}

        {/* Área de contenido */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#F5F5F5", overflow: "hidden" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <div style={{ textAlign: "center", color: "#6b7280" }}>
                <div style={{ fontSize: "48px", marginBottom: 16, color: "#84BD00" }}>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                </div>
                <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando unidades...</div>
                <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
              </div>
            </div>
          ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%", overflow: "hidden" }}>
            <h3 style={{ margin: "0 0 12px 0", background: "linear-gradient(135deg, #84BD00 0%, #009CA6 100%)", backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 700, fontSize: "32px" }}>{decodeURIComponent(asignatura || "")}</h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
              Selecciona una <span style={{ fontWeight: 700, color: "#92D050" }}>unidad disponible</span> para acceder al contenido formativo de tu asignatura.
            </p>

            {/* Contenido principal */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              {/* Panel de listado de unidades */}
              <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, background: "white", padding: 32, flex: 1, overflow: "auto", minHeight: 0 }}>
                {unidades.length === 0 ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 300, flexDirection: "column" }}>
                    <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                      <i className="fa-solid fa-book-open"></i>
                    </div>
                    <p style={{ fontSize: 16, color: "#9ca3af", margin: 0 }}>
                      No hay contenido formativo disponible en este momento
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 16 }}>
                    {unidades.map((unidad, index) => (
                      <div 
                        key={index} 
                        onClick={() => handleVerContenido(unidad)}
                        style={{ 
                          padding: 20, 
                          background: "#F9FAFB", 
                          border: "1px solid #e5e7eb", 
                          borderRadius: 12,
                          transition: "all 0.2s",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(146, 208, 80, 0.15)";
                          e.currentTarget.style.borderColor = "#92D050";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.boxShadow = "none";
                          e.currentTarget.style.borderColor = "#e5e7eb";
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
                          <div style={{ 
                            minWidth: 48, 
                            height: 48, 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            color: "#84BD00", 
                            fontSize: 28 
                          }}>
                            <i className="fa-solid fa-book"></i>
                          </div>
                          <div style={{ flex: 1 }}>
                            <h5 style={{ margin: "0 0 12px 0", color: "#111827", fontSize: 18, fontWeight: 700 }}>
                              Unidad {unidad.unidad}: {unidad.titulo}
                            </h5>
                            <p style={{ 
                              margin: 0, 
                              fontSize: 14, 
                              color: "#6b7280", 
                              lineHeight: 1.6,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              textAlign: "justify"
                            }}>
                              {unidad.contenido}
                            </p>
                          </div>
                        </div>
                        
                        <div style={{ marginLeft: 16 }}>
                          <i className="fa-solid fa-chevron-right" style={{ fontSize: 16, color: "#84BD00" }}></i>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
