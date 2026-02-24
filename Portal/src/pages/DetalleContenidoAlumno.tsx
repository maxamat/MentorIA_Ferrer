import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { me } from "../api";

export default function DetalleContenidoAlumno() {
  const nav = useNavigate();
  const { clase, asignatura, unidad } = useParams<{ clase: string; asignatura: string; unidad: string }>();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [alumnoId, setAlumnoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSecciones, setLoadingSecciones] = useState(true);

  // Datos del contenido
  const [secciones, setSecciones] = useState<any[]>([]);
  const [seccionActual, setSeccionActual] = useState(0); // Índice de la sección actual (0-based)
  const [tituloUnidad, setTituloUnidad] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function logout() {
    localStorage.removeItem("jwt");
    nav("/login");
  }

  const handleAnterior = () => {
    if (seccionActual > 0) {
      setSeccionActual(seccionActual - 1);
    }
  };

  const handleSiguiente = () => {
    if (seccionActual < secciones.length - 1) {
      setSeccionActual(seccionActual + 1);
    }
  };

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

      // Cargar secciones disponibles desde el backend
      if (clase && asignatura && unidad && data.centro_id) {
        setLoadingSecciones(true);
        fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_contenidos_unidad`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY 
          },
          body: JSON.stringify({ 
            centro_id: data.centro_id,
            clase: decodeURIComponent(clase), 
            asignatura: decodeURIComponent(asignatura),
            unidad: parseInt(unidad || "0")
          })
        })
          .then(r => r.json())
          .then(res => {
            if (res.contenidos && res.contenidos.length > 0) {
              setSecciones(res.contenidos);
              setSeccionActual(0); // Mostrar la primera sección
              setTituloUnidad(res.titulo_unidad || `Unidad ${unidad}`);
            } else {
              setSecciones([]);
              setTituloUnidad(res.titulo_unidad || `Unidad ${unidad}`);
            }
            setLoadingSecciones(false);
          })
          .catch(() => {
            setSecciones([]);
            setTituloUnidad(`Unidad ${unidad}`);
            setLoadingSecciones(false);
          });
      }

      setLoading(false);
    });
  }, [nav, clase, asignatura, unidad]);

  const handleOpenContent = async (url: string, seccion: string) => {
    // Registrar la acción en la base de datos
    try {
      await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/registrar_accion_contenido_html`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
        body: JSON.stringify({
          centro_id: centroId,
          clase: decodeURIComponent(clase!),
          asignatura: decodeURIComponent(asignatura!),
          unidad: parseInt(unidad!),
          seccion: seccion,
          alumno_id: alumnoId
        })
      });
    } catch (error) {
      console.error("Error registrando acción HTML:", error);
    }
    
    window.open(url, '_blank');
  };

  const handleOpenAudio = async (url: string, seccion: string) => {
    // Registrar la acción en la base de datos
    try {
      await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/registrar_accion_contenido_audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
        body: JSON.stringify({
          centro_id: centroId,
          clase: decodeURIComponent(clase!),
          asignatura: decodeURIComponent(asignatura!),
          unidad: parseInt(unidad!),
          seccion: seccion,
          alumno_id: alumnoId
        })
      });
    } catch (error) {
      console.error("Error registrando acción audio:", error);
    }
    
    window.open(url, '_blank');
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
            <button 
              onClick={() => nav(`/contenido-asignatura/${clase}/${asignatura}`)} 
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                border: "none", 
                background: "rgba(146, 208, 80, 0.1)", 
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
              }}>
              <i className="fa-solid fa-arrow-left" style={{ fontSize: "16px" }}></i>
              Volver
            </button>
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
              <div style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>Cargando...</div>
            </div>
          ) : loadingSecciones ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <div style={{ textAlign: "center", color: "#6b7280" }}>
                <div style={{ fontSize: "48px", marginBottom: 16, color: "#84BD00" }}>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                </div>
                <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando contenido...</div>
                <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
              </div>
            </div>
          ) : secciones.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column" }}>
              <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                <i className="fa-solid fa-book-open"></i>
              </div>
              <p style={{ fontSize: 16, color: "#9ca3af", margin: 0 }}>
                No hay contenido disponible para esta unidad
              </p>
            </div>
          ) : (
          <div style={{ flex: 1, display: "flex", gap: 24, padding: 24, overflow: "hidden" }}>
            {/* Contenido principal - Panel con iframe */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              {/* Título */}
              <h3 style={{ 
                margin: "0 0 24px 0", 
                color: "#84BD00",
                fontWeight: 700, 
                fontSize: "32px" 
              }}>
                Unidad {unidad} | {tituloUnidad || `Unidad ${unidad}`}
              </h3>

              {/* Panel de contenido */}
              <div style={{ 
                flex: 1, 
                background: "white", 
                borderRadius: 16, 
                padding: 32, 
                border: "1px solid #e5e5e5",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative"
              }}>
                {/* Título de la sección */}
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ 
                    margin: 0, 
                    color: "#1f2937", 
                    fontSize: 20, 
                    fontWeight: 700 
                  }}>
                    <i className="fa-solid fa-book" style={{ marginRight: 12, color: "#84BD00" }}></i>
                    {secciones[seccionActual]?.titulo || `Sección ${secciones[seccionActual]?.seccion}`}
                  </h4>
                </div>

                {/* Iframe del contenido */}
                <div style={{ 
                  flex: 1, 
                  overflow: "hidden"
                }}>
                  {secciones[seccionActual]?.url_contenido ? (
                    <iframe 
                      src={secciones[seccionActual].url_contenido}
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        borderRadius: 8
                      }}
                      title="Contenido HTML"
                    />
                  ) : (
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "center", 
                      alignItems: "center", 
                      height: "100%",
                      color: "#9ca3af"
                    }}>
                      No hay contenido disponible
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel lateral derecho - Selector y botones */}
            <div style={{ 
              width: "320px", 
              display: "flex", 
              flexDirection: "column",
              gap: 24,
              paddingTop: 80
            }}>
              {/* Selector de secciones */}
              <div style={{ 
                background: "transparent", 
                borderRadius: 16, 
                padding: 24
              }}>
                <h4 style={{ 
                  margin: "0 0 20px 0", 
                  color: "#1f2937", 
                  fontSize: 16, 
                  fontWeight: 700,
                  textAlign: "center"
                }}>
                  Secciones:
                </h4>

                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between",
                  gap: 12 
                }}>
                  <button
                    onClick={handleAnterior}
                    disabled={seccionActual === 0}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      border: "2px solid #84BD00",
                      background: seccionActual === 0 ? "#f3f4f6" : "rgba(132, 189, 0, 0.1)",
                      color: seccionActual === 0 ? "#9ca3af" : "#84BD00",
                      cursor: seccionActual === 0 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      transition: "all 0.2s",
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      if (seccionActual > 0) {
                        e.currentTarget.style.background = "#84BD00";
                        e.currentTarget.style.color = "white";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (seccionActual > 0) {
                        e.currentTarget.style.background = "rgba(132, 189, 0, 0.1)";
                        e.currentTarget.style.color = "#84BD00";
                      }
                    }}
                  >
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>

                  <div style={{ 
                    padding: "12px 16px",
                    background: "transparent",
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#111827",
                    textAlign: "center",
                    flex: 1
                  }}>
                    {seccionActual + 1}/{secciones.length}
                  </div>

                  <button
                    onClick={handleSiguiente}
                    disabled={seccionActual === secciones.length - 1}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      border: "2px solid #84BD00",
                      background: seccionActual === secciones.length - 1 ? "#f3f4f6" : "rgba(132, 189, 0, 0.1)",
                      color: seccionActual === secciones.length - 1 ? "#9ca3af" : "#84BD00",
                      cursor: seccionActual === secciones.length - 1 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      transition: "all 0.2s",
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      if (seccionActual < secciones.length - 1) {
                        e.currentTarget.style.background = "#84BD00";
                        e.currentTarget.style.color = "white";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (seccionActual < secciones.length - 1) {
                        e.currentTarget.style.background = "rgba(132, 189, 0, 0.1)";
                        e.currentTarget.style.color = "#84BD00";
                      }
                    }}
                  >
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              </div>

              {/* Botón de audio */}
              <div style={{ 
                display: "flex", 
                justifyContent: "center",
                background: "transparent",
                marginTop: "auto"
              }}>
                <button
                  onClick={async () => {
                    if (isPlaying && audioRef.current) {
                      // Pausar el audio si está reproduciéndose
                      audioRef.current.pause();
                      setIsPlaying(false);
                    } else {
                      // Registrar la acción
                      try {
                        await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/registrar_accion_contenido_audio`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
                          body: JSON.stringify({
                            centro_id: centroId,
                            clase: decodeURIComponent(clase!),
                            asignatura: decodeURIComponent(asignatura!),
                            unidad: parseInt(unidad!),
                            seccion: secciones[seccionActual]?.seccion,
                            alumno_id: alumnoId
                          })
                        });
                      } catch (error) {
                        console.error("Error registrando acción audio:", error);
                      }
                      
                      // Reproducir audio
                      const audioUrl = secciones[seccionActual]?.url_audio;
                      if (audioUrl) {
                        // Pausar audio anterior si existe
                        if (audioRef.current) {
                          audioRef.current.pause();
                        }
                        
                        // Crear nuevo audio
                        const audio = new Audio(audioUrl);
                        audioRef.current = audio;
                        
                        audio.play().then(() => {
                          setIsPlaying(true);
                        }).catch(err => {
                          console.error("Error reproduciendo audio:", err);
                          setIsPlaying(false);
                        });
                        
                        // Listener para cuando el audio termine
                        audio.addEventListener('ended', () => {
                          setIsPlaying(false);
                        });
                      }
                    }
                  }}
                  style={{
                    padding: "14px 24px",
                    border: "none",
                    borderRadius: 8,
                    background: isPlaying ? "#6fa300" : "#84BD00",
                    color: "white",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 15,
                    transition: "all 0.2s",
                    boxShadow: "0 2px 8px rgba(132, 189, 0, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                  }}
                  onMouseEnter={e => {
                    if (!isPlaying) {
                      e.currentTarget.style.background = "#6fa300";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(132, 189, 0, 0.4)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isPlaying) {
                      e.currentTarget.style.background = "#84BD00";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(132, 189, 0, 0.3)";
                    }
                  }}
                >
                  <i className={isPlaying ? "fa-solid fa-pause" : "fa-solid fa-headphones"}></i>
                  {isPlaying ? "Pausar audio" : "Escuchar audio"}
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
