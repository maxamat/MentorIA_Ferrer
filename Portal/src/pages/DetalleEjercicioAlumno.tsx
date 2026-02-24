import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { me } from "../api";

export default function DetalleEjercicioAlumno() {
  const nav = useNavigate();
  const { clase, asignatura, unidad } = useParams<{ clase: string; asignatura: string; unidad: string }>();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [alumnoId, setAlumnoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEjercicios, setLoadingEjercicios] = useState(true);

  // Datos del ejercicio
  const [ejercicios, setEjercicios] = useState<any[]>([]);
  const [ejercicioActual, setEjercicioActual] = useState(0); // Índice del ejercicio actual (0-based)
  const [tituloUnidad, setTituloUnidad] = useState<string>("");
  const [showGeneratingModal, setShowGeneratingModal] = useState(false);
  const [showCorreccionModal, setShowCorreccionModal] = useState(false);
  const [imagenCorreccion, setImagenCorreccion] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function logout() {
    localStorage.removeItem("jwt");
    nav("/login");
  }

  const handleAnterior = () => {
    if (ejercicioActual > 0) {
      setEjercicioActual(ejercicioActual - 1);
    }
  };

  const handleSiguiente = () => {
    if (ejercicioActual < ejercicios.length - 1) {
      setEjercicioActual(ejercicioActual + 1);
    }
  };

  const handleGenerarNuevo = () => {
    if (!centroId || !alumnoId || !clase || !asignatura || !unidad) {
      alert("Faltan datos para generar el ejercicio");
      return;
    }

    // Llamar al backend para crear Cloud Task
    fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/generar_ejercicio`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY 
      },
      body: JSON.stringify({ 
        centro_id: centroId,
        alumno_id: alumnoId,
        clase: decodeURIComponent(clase), 
        asignatura: decodeURIComponent(asignatura),
        unidad: parseInt(unidad)
      })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setShowGeneratingModal(true);
        } else {
          alert("Error al generar el ejercicio. Por favor, inténtalo de nuevo.");
        }
      })
      .catch(err => {
        console.error(err);
        alert("Error de conexión al generar el ejercicio.");
      });
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

      // Cargar ejercicios disponibles desde el backend
      if (clase && asignatura && unidad && data.centro_id) {
        setLoadingEjercicios(true);
        fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_ejercicios_alumno`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY 
          },
          body: JSON.stringify({ 
            centro_id: data.centro_id,
            alumno_id: data.username,
            clase: decodeURIComponent(clase), 
            asignatura: decodeURIComponent(asignatura),
            unidad: parseInt(unidad || "0")
          })
        })
          .then(r => r.json())
          .then(res => {
            if (res.ejercicios && res.ejercicios.length > 0) {
              setEjercicios(res.ejercicios);
              setEjercicioActual(0); // Mostrar el primer ejercicio
              setTituloUnidad(res.titulo_unidad || `Unidad ${unidad}`);
            } else {
              setEjercicios([]);
              setTituloUnidad(res.titulo_unidad || `Unidad ${unidad}`);
            }
            setLoadingEjercicios(false);
          })
          .catch(() => {
            setEjercicios([]);
            setTituloUnidad(`Unidad ${unidad}`);
            setLoadingEjercicios(false);
          });
      }

      setLoading(false);
    });
  }, [nav, clase, asignatura, unidad]);

  const handlePista = () => {
    if (!ejercicios[ejercicioActual]?.url_audio_hint) {
      alert("No hay audio de pista disponible para este ejercicio");
      return;
    }
    
    if (isPlayingAudio && audioRef.current) {
      // Pausar el audio si está reproduciéndose
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      // Pausar audio anterior si existe
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Reproducir el audio del hint
      const audio = new Audio(ejercicios[ejercicioActual].url_audio_hint);
      audioRef.current = audio;
      
      audio.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(err => {
        console.error("Error al reproducir audio:", err);
        alert("No se pudo reproducir el audio de la pista");
        setIsPlayingAudio(false);
      });
      
      // Listener para cuando el audio termine
      audio.addEventListener('ended', () => {
        setIsPlayingAudio(false);
      });
    }
  };

  const handleCorregir = () => {
    setShowCorreccionModal(true);
  };

  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagenCorreccion(file);
      // Crear preview de la imagen
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagenPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEnviarCorreccion = () => {
    if (!imagenCorreccion) {
      alert("Por favor, carga una imagen del ejercicio resuelto");
      return;
    }

    if (!centroId || !alumnoId || !clase || !asignatura || !unidad) {
      alert("Faltan datos para enviar la corrección");
      return;
    }

    // Convertir imagen a base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Extraer solo la parte base64 (sin el prefijo data:image/...)
      const base64Data = base64String.split(',')[1];

      // Llamar al backend para enviar corrección
      fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/corregir_ejercicio`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY 
        },
        body: JSON.stringify({ 
          centro_id: centroId,
          alumno_id: alumnoId,
          clase: decodeURIComponent(clase), 
          asignatura: decodeURIComponent(asignatura),
          unidad: parseInt(unidad),
          id_ejercicio: ejercicios[ejercicioActual]?.id,
          imagen_base64: base64Data
        })
      })
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            // Cerrar modal de corrección
            setShowCorreccionModal(false);
            setImagenCorreccion(null);
            setImagenPreview(null);
            // Mostrar modal de "generando"
            setShowGeneratingModal(true);
          } else {
            alert("Error al enviar el ejercicio para corrección. Por favor, inténtalo de nuevo.");
          }
        })
        .catch(err => {
          console.error(err);
          alert("Error de conexión al enviar el ejercicio.");
        });
    };
    
    reader.readAsDataURL(imagenCorreccion);
  };

  const handleCerrarModalCorreccion = () => {
    setShowCorreccionModal(false);
    setImagenCorreccion(null);
    setImagenPreview(null);
  };

  // Función para renderizar texto con formato **negrita**
  const renderTextWithBold = (text: string) => {
    if (!text) return null;
    
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        return <strong key={index} style={{ color: "#84BD00" }}>{boldText}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
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
              onClick={() => nav(`/ejercicios-asignatura/${clase}/${asignatura}`)} 
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
          ) : loadingEjercicios ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <div style={{ textAlign: "center", color: "#6b7280" }}>
                <div style={{ fontSize: "48px", marginBottom: 16, color: "#84BD00" }}>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                </div>
                <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando ejercicios...</div>
                <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
              </div>
            </div>
          ) : ejercicios.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column" }}>
              <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                <i className="fa-solid fa-clipboard-question"></i>
              </div>
              <p style={{ fontSize: 16, color: "#9ca3af", margin: "0 0 24px 0" }}>
                No hay ejercicios disponibles para esta unidad
              </p>
              <button
                onClick={handleGenerarNuevo}
                style={{
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: 8,
                  background: "#84BD00",
                  color: "white",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(132, 189, 0, 0.3)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#6fa300";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(132, 189, 0, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#84BD00";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(132, 189, 0, 0.3)";
                }}
              >
                <i className="fa-solid fa-plus"></i>
                Generar primer ejercicio
              </button>
            </div>
          ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, maxWidth: 1400, margin: "0 auto", width: "100%", overflow: "hidden" }}>
            {/* Título */}
            <h3 style={{ 
              margin: "0 0 24px 0", 
              color: "#84BD00",
              fontWeight: 700, 
              fontSize: "32px" 
            }}>
              Unidad {unidad} | {tituloUnidad || `Unidad ${unidad}`}
            </h3>

            {/* Barra de control - Selector de ejercicios y botón generar */}
            <div style={{ 
              display: "flex", 
              justifyContent: "center", 
              alignItems: "center", 
              marginBottom: 24,
              padding: "16px 24px",
              background: "transparent",
              borderRadius: 12,
              position: "relative"
            }}>
              {/* Selector de ejercicios con flechas - centrado */}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  onClick={handleAnterior}
                  disabled={ejercicioActual === 0}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    border: "2px solid #84BD00",
                    background: ejercicioActual === 0 ? "#f3f4f6" : "rgba(132, 189, 0, 0.1)",
                    color: ejercicioActual === 0 ? "#9ca3af" : "#84BD00",
                    cursor: ejercicioActual === 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    if (ejercicioActual > 0) {
                      e.currentTarget.style.background = "#84BD00";
                      e.currentTarget.style.color = "white";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (ejercicioActual > 0) {
                      e.currentTarget.style.background = "rgba(132, 189, 0, 0.1)";
                      e.currentTarget.style.color = "#84BD00";
                    }
                  }}
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>

                <div style={{ 
                  padding: "8px 20px",
                  background: "transparent",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111827"
                }}>
                  Ejercicio {ejercicioActual + 1} de {ejercicios.length}
                </div>

                <button
                  onClick={handleSiguiente}
                  disabled={ejercicioActual === ejercicios.length - 1}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    border: "2px solid #84BD00",
                    background: ejercicioActual === ejercicios.length - 1 ? "#f3f4f6" : "rgba(132, 189, 0, 0.1)",
                    color: ejercicioActual === ejercicios.length - 1 ? "#9ca3af" : "#84BD00",
                    cursor: ejercicioActual === ejercicios.length - 1 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    if (ejercicioActual < ejercicios.length - 1) {
                      e.currentTarget.style.background = "#84BD00";
                      e.currentTarget.style.color = "white";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (ejercicioActual < ejercicios.length - 1) {
                      e.currentTarget.style.background = "rgba(132, 189, 0, 0.1)";
                      e.currentTarget.style.color = "#84BD00";
                    }
                  }}
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>

              {/* Botón generar nuevo ejercicio - posición absoluta a la derecha */}
              <button
                onClick={handleGenerarNuevo}
                style={{
                  position: "absolute",
                  right: 24,
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: 8,
                  background: "#84BD00",
                  color: "white",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(132, 189, 0, 0.3)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#6fa300";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(132, 189, 0, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#84BD00";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(132, 189, 0, 0.3)";
                }}
              >
                <i className="fa-solid fa-plus"></i>
                Generar nuevo ejercicio
              </button>
            </div>

            {/* Contenido principal - Dos paneles */}
            <div style={{ flex: 1, display: "flex", gap: 24, overflow: "hidden", minHeight: 0 }}>
              {/* Panel izquierdo - Ejercicio */}
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
                <div style={{ 
                  flex: 1, 
                  marginBottom: 24,
                  overflow: "hidden"
                }}>
                  {ejercicios[ejercicioActual]?.url_html ? (
                    <iframe 
                      src={ejercicios[ejercicioActual].url_html}
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        borderRadius: 8
                      }}
                      title="Ejercicio HTML"
                    />
                  ) : (
                    "No hay contenido disponible"
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    onClick={handlePista}
                    style={{
                      padding: "12px 24px",
                      border: "2px solid #84BD00",
                      borderRadius: 8,
                      background: isPlayingAudio ? "#84BD00" : "white",
                      color: isPlayingAudio ? "white" : "#84BD00",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: 14,
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={e => {
                      if (!isPlayingAudio) {
                        e.currentTarget.style.background = "#84BD00";
                        e.currentTarget.style.color = "white";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isPlayingAudio) {
                        e.currentTarget.style.background = "white";
                        e.currentTarget.style.color = "#84BD00";
                      }
                    }}
                  >
                    <i className={isPlayingAudio ? "fa-solid fa-pause" : "fa-solid fa-lightbulb"} style={{ marginRight: 8 }}></i>
                    {isPlayingAudio ? "Pausar pista" : "Pista"}
                  </button>

                  <button
                    onClick={handleCorregir}
                    style={{
                      padding: "14px 24px",
                      border: "none",
                      borderRadius: 8,
                      background: "#84BD00",
                      color: "white",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 16,
                      transition: "all 0.2s",
                      boxShadow: "0 2px 8px rgba(132, 189, 0, 0.3)"
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "#6fa300";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(132, 189, 0, 0.4)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "#84BD00";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(132, 189, 0, 0.3)";
                    }}
                  >
                    <i className="fa-solid fa-paper-plane" style={{ marginRight: 8 }}></i>
                    Enviar respuesta
                  </button>
                </div>
              </div>

              {/* Panel derecho - Comentarios */}
              <div style={{ 
                width: "400px", 
                background: "white", 
                borderRadius: 16, 
                padding: 32, 
                border: "1px solid #e5e5e5",
                display: "flex",
                flexDirection: "column"
              }}>
                {/* Comentarios */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <h4 style={{ 
                    margin: "0 0 12px 0", 
                    fontSize: "18px", 
                    fontWeight: 700, 
                    color: "#111827" 
                  }}>
                    Comentarios:
                  </h4>
                  <div style={{
                    flex: 1,
                    padding: "16px",
                    background: "#F9FAFB",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    overflow: "auto",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    color: "#374151",
                    textAlign: "justify"
                  }}>
                    {ejercicios[ejercicioActual]?.comentarios_alumno ? (
                      renderTextWithBold(ejercicios[ejercicioActual].comentarios_alumno)
                    ) : (
                      <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                        No hay comentarios disponibles
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Modal de generación de ejercicio */}
      {showGeneratingModal && (
        <div 
          onClick={() => setShowGeneratingModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20
          }}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 16,
              padding: 40,
              maxWidth: 500,
              width: "100%",
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              textAlign: "center"
            }}>
            {/* Icono de éxito */}
            <div style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #84BD00 0%, #6fa300 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              boxShadow: "0 4px 12px rgba(132, 189, 0, 0.3)"
            }}>
              <i className="fa-solid fa-check" style={{ fontSize: 40, color: "white" }}></i>
            </div>

            {/* Mensaje */}
            <p style={{ 
              margin: "0", 
              color: "#6b7280", 
              fontSize: 16, 
              lineHeight: 1.6 
            }}>
              Tu solicitud se está procesando en este momento. Esto puede tardar entre <strong style={{ color: "#84BD00" }}>5-10 minutos</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Modal de Corrección */}
      {showCorreccionModal && (
        <div 
          onClick={handleCerrarModalCorreccion}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20
          }}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 16,
              padding: 40,
              maxWidth: 600,
              width: "100%",
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
            }}>
            
            <div style={{ marginBottom: 24 }}>
              <label style={{ 
                display: "block", 
                marginBottom: 12, 
                fontSize: 15, 
                fontWeight: 600, 
                color: "#374151" 
              }}>
                Sube una imagen del ejercicio resuelto:
              </label>
              
              <input 
                type="file" 
                accept="image/png"
                onChange={handleImagenChange}
                style={{ display: "none" }}
                id="file-upload"
              />
              
              <label 
                htmlFor="file-upload"
                style={{
                  display: "inline-block",
                  padding: "12px 24px",
                  background: "#f3f4f6",
                  border: "2px dashed #d1d5db",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#6b7280",
                  transition: "all 0.2s",
                  textAlign: "center",
                  width: "100%"
                }}>
                <i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: 8 }}></i>
                {imagenCorreccion ? imagenCorreccion.name : "Haz clic para seleccionar una imagen"}
              </label>
              
              {imagenPreview && (
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <img 
                    src={imagenPreview} 
                    alt="Preview" 
                    style={{
                      maxWidth: "100%",
                      maxHeight: 300,
                      borderRadius: 8,
                      border: "1px solid #e5e5e5"
                    }} 
                  />
                </div>
              )}
            </div>
            
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                onClick={handleEnviarCorreccion}
                style={{
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: 8,
                  background: "#84BD00",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                  transition: "all 0.2s"
                }}
              >
                <i className="fa-solid fa-check-circle" style={{ marginRight: 8 }}></i>
                Corregir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
