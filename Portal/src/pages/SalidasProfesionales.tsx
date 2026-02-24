import React, { useEffect, useState } from "react";
import { obtenerImagenSalida } from "../api";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

type Me = { username: string; role: "centro" | "profesor" | "alumno"; centro_id?: string | null };

type Salida = {
  salida_id: string;
  ranking: number;
  flag_like: boolean;
  titulo: string;
  centro: string;
  localidad: string;
  distancia: number;
  co2: number;
  perfiles: string;
  curriculo: string;
  imagebase64?: string;
};

export default function SalidasProfesionales() {
  const nav = useNavigate();
  const [data, setData] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [showChatModal, setShowChatModal] = useState(false);
  const [currentSalidaId, setCurrentSalidaId] = useState<string | null>(null);
  const [currentSalidaTitulo, setCurrentSalidaTitulo] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant", content: string }>>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const jwt = localStorage.getItem("jwt") || "";

  useEffect(() => {
    if (!jwt) {
      nav("/");
      return;
    }
    me(jwt)
      .then(async (userData) => {
        setData(userData);
        const centroId = (userData as any)?.centro_id || "";
        const alumnoId = userData?.username || "";
        
        const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_salidas_alumno`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
          },
          body: JSON.stringify({
            centro_id: centroId,
            alumno_id: alumnoId
          })
        });
        
        if (!response || !response.ok) {
          setLoading(false);
          return;
        }
        
        const salidasData = await response.json();
        
        if (salidasData && salidasData.salidas && salidasData.salidas.length > 0) {
          // Crear caché para imágenes por título para evitar llamadas redundantes
          const imageCache = new Map<string, string>();
          const uniqueTitulos = [...new Set(salidasData.salidas.map((s: any) => s.titulo))];
          
          // Fetch solo las imágenes únicas en paralelo
          await Promise.all(
            uniqueTitulos.map(async (titulo: string) => {
              try {
                const imgResp = await obtenerImagenSalida(centroId, alumnoId, titulo);
                if (imgResp?.imagebase64) {
                  imageCache.set(titulo, imgResp.imagebase64);
                }
              } catch (err) {
                console.error(`Error fetching image for ${titulo}:`, err);
              }
            })
          );
          
          // Asignar imágenes desde el caché
          const salidasWithImages = salidasData.salidas.map((salida: any) => ({
            ...salida,
            imagebase64: imageCache.get(salida.titulo)
          }));
          
          setSalidas(salidasWithImages);
        }
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e.message ?? String(e));
        setLoading(false);
      });
  }, [nav, jwt]);

  function logout() {
    localStorage.removeItem("jwt");
    nav("/");
  }

  async function toggleLike(salidaId: string, currentLike: boolean) {
    const centroId = (data as any)?.centro_id || "";
    const alumnoId = data?.username || "";
    
    // Actualizar el estado local inmediatamente para feedback visual
    setSalidas(prev => prev.map(s => 
      s.salida_id === salidaId ? { ...s, flag_like: !currentLike } : s
    ));
    
    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/modificar_salidas_alumno`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          alumno_id: alumnoId,
          salida_id: salidaId,
          flag_like: !currentLike
        })
      });
      
      if (!response.ok) {
        // Si falla, revertir el cambio
        setSalidas(prev => prev.map(s => 
          s.salida_id === salidaId ? { ...s, flag_like: currentLike } : s
        ));
      }
    } catch (e) {
      console.error("Error al actualizar like:", e);
      // Si hay error, revertir el cambio
      setSalidas(prev => prev.map(s => 
        s.salida_id === salidaId ? { ...s, flag_like: currentLike } : s
      ));
    }
  }

  function openChat(salidaId: string, titulo: string) {
    setCurrentSalidaId(salidaId);
    setCurrentSalidaTitulo(titulo);
    setChatMessages([]);
    setMessageInput("");
    setShowChatModal(true);
  }

  function closeChat() {
    setShowChatModal(false);
    setCurrentSalidaId(null);
    setCurrentSalidaTitulo("");
    setChatMessages([]);
    setMessageInput("");
  }

  function formatMessageContent(content: string) {
    // Reemplazar **texto** por <strong style="color: #92D050; font-weight: bold;">texto</strong>
    const formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #92D050; font-weight: bold;">$1</strong>');
    return formatted;
  }

  async function sendMessage() {
    if (!messageInput.trim() || !currentSalidaId || isSendingMessage) return;

    const centroId = (data as any)?.centro_id || "";
    const alumnoId = data?.username || "";
    const userMessage = messageInput.trim();

    // Agregar el mensaje del usuario al historial
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setMessageInput("");
    setIsSendingMessage(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/conversa_yo_futuro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          alumno_id: alumnoId,
          mensaje: userMessage,
          salida_id: currentSalidaId
        })
      });

      if (!response.ok) {
        throw new Error("Error al enviar el mensaje");
      }

      const responseData = await response.json();
      
      // Agregar la respuesta del asistente
      if (responseData.respuesta) {
        setChatMessages(prev => [...prev, { role: "assistant", content: responseData.respuesta }]);
      }
    } catch (e) {
      console.error("Error al enviar mensaje:", e);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo." }]);
    } finally {
      setIsSendingMessage(false);
    }
  }

  return (
    <>
      <style>{`
        .salidas-scroll::-webkit-scrollbar {
          width: 12px;
        }
        .salidas-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .salidas-scroll::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 6px;
        }
        .salidas-scroll::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
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
              onClick={() => nav("/microproyectos")}
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
          <div style={{ padding: "0 16px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
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
                fontWeight: 700,
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
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%", overflow: "hidden" }}>
            {error && <div style={{ color: "crimson", padding: 16, background: "#fee2e2", borderRadius: 12, marginBottom: 16 }}>{error}</div>}
            
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                <div style={{ textAlign: "center", color: "#6b7280" }}>
                  <div style={{ fontSize: "48px", marginBottom: 16, color: "#84BD00" }}>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando salidas profesionales...</div>
                  <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
                </div>
              </div>
            )}

            {!loading && data && (
              <div style={{ 
                display: "flex", 
                flexDirection: "column", 
                flex: 1,
                overflow: "hidden"
              }}>
                <h3 style={{ 
                  margin: "0 0 12px 0", 
                  color: "#84BD00",
                  fontWeight: 700,
                  fontSize: "32px"
                }}>Salidas profesionales</h3>
                <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
                  Explora las <span style={{ fontWeight: 700, color: "#92D050" }}>oportunidades profesionales</span> que se ajustan a tu perfil y preferencias.
                </p>

                {/* Contenedor principal */}
                {salidas.length === 0 ? (
                  <div style={{ 
                    flex: 1,
                    padding: 24,
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    minHeight: 0,
                    justifyContent: "center",
                    alignItems: "center"
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 24, color: "#92D050" }}>
                      <i className="fa-solid fa-briefcase"></i>
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "#1f2937", marginBottom: 12 }}>
                      No hay salidas profesionales disponibles
                    </div>
                    <div style={{ fontSize: "15px", color: "#6b7280", lineHeight: 1.6, maxWidth: 500, textAlign: "center" }}>
                      Las salidas profesionales aparecerán una vez completes el apartado de <span style={{ fontWeight: 600, color: "#92D050" }}>Mis preferencias</span> y habiendo transcurrido unos minutos hasta que se procese la evaluación.
                    </div>
                  </div>
                ) : (
                  <div 
                    className="salidas-scroll"
                    style={{ 
                      flex: 1, 
                      overflowY: "auto",
                      overflowX: "hidden"
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {salidas.map((salida) => (
                      <div
                        key={salida.salida_id}
                        style={{
                          background: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: 16,
                          padding: 20,
                          display: "flex",
                          gap: 20,
                          transition: "transform 0.2s, box-shadow 0.2s",
                          cursor: "pointer",
                          position: "relative"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        {/* Medalla de ranking en esquina superior derecha */}
                        {salida.ranking <= 3 && (
                          <div style={{
                            position: "absolute",
                            top: 8,
                            right: 12,
                            fontSize: "32px",
                            zIndex: 10
                          }}>
                            {salida.ranking === 1 && "🥇"}
                            {salida.ranking === 2 && "🥈"}
                            {salida.ranking === 3 && "🥉"}
                          </div>
                        )}

                        {/* Imagen */}
                        <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                          <img 
                            src={salida.imagebase64 || "/avatar.png"}
                            alt={salida.titulo}
                            style={{ 
                              width: "160px", 
                              height: "160px", 
                              objectFit: "cover", 
                              borderRadius: "12px",
                              border: "1px solid #e5e7eb"
                            }}
                          />
                        </div>

                        {/* Contenido */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "160px", justifyContent: "space-between" }}>
                          {/* Título con botón de like y chat */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLike(salida.salida_id, salida.flag_like);
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "20px",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                transition: "transform 0.2s",
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.2)"}
                              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                            >
                              <i className={salida.flag_like ? "fa-solid fa-star" : "fa-regular fa-star"} 
                                 style={{ color: "#92D050" }}></i>
                            </button>
                            <h4 style={{ 
                              margin: 0, 
                              fontSize: "22px", 
                              fontWeight: 700, 
                              color: "#1f2937"
                            }}>
                              {salida.titulo}
                            </h4>
                          </div>

                          {/* Subtítulo: Centro y Localidad */}
                          <div style={{ display: "flex", gap: 200 }}>
                            <div style={{ fontSize: "14px", color: "#6b7280", lineHeight: 1.5 }}>
                              <span style={{ fontWeight: 700 }}>Centro:</span> {salida.centro}
                            </div>
                            <div style={{ fontSize: "14px", color: "#6b7280", lineHeight: 1.5 }}>
                              <span style={{ fontWeight: 700 }}>Localidad:</span> {salida.localidad}
                            </div>
                          </div>

                          {/* Enlaces */}
                          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                            {salida.perfiles && (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const url = salida.perfiles.startsWith('http://') || salida.perfiles.startsWith('https://') 
                                    ? salida.perfiles 
                                    : `https://${salida.perfiles}`;
                                  window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                                style={{ 
                                  display: "flex", 
                                  alignItems: "center", 
                                  gap: 8,
                                  padding: "8px 16px",
                                  background: "#f3f4f6",
                                  borderRadius: 8,
                                  flex: 2,
                                  cursor: "pointer",
                                  transition: "background 0.2s"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "#e5e7eb"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "#f3f4f6"}
                              >
                                <i className="fa-solid fa-user-tie" style={{ color: "#92D050", fontSize: "16px" }}></i>
                                <div>
                                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600 }}>Ver detalles</div>
                                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#1f2937" }}>Perfiles Profesionales</div>
                                </div>
                              </div>
                            )}
                            {salida.curriculo && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const url = salida.curriculo.startsWith('http://') || salida.curriculo.startsWith('https://') 
                                    ? salida.curriculo 
                                    : `https://${salida.curriculo}`;
                                  window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                                style={{ 
                                  display: "flex", 
                                  alignItems: "center", 
                                  gap: 8,
                                  padding: "8px 16px",
                                  background: "#f3f4f6",
                                  borderRadius: 8,
                                  flex: 2,
                                  cursor: "pointer",
                                  transition: "background 0.2s"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "#e5e7eb"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "#f3f4f6"}
                              >
                                <i className="fa-solid fa-graduation-cap" style={{ color: "#92D050", fontSize: "16px" }}></i>
                                <div>
                                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600 }}>Ver detalles</div>
                                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#1f2937" }}>Currículo</div>
                                </div>
                              </div>
                            )}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                openChat(salida.salida_id, salida.titulo);
                              }}
                              style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: 8,
                                padding: "8px 16px",
                                background: "#f3f4f6",
                                borderRadius: 8,
                                flex: 2,
                                cursor: "pointer",
                                transition: "background 0.2s"
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#e5e7eb"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "#f3f4f6"}
                            >
                              <i className="fa-solid fa-comments" style={{ color: "#92D050", fontSize: "16px" }}></i>
                              <div>
                                <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600 }}>Resuelve tus dudas</div>
                                <div style={{ fontSize: "16px", fontWeight: 700, color: "#1f2937" }}>Chatea con tu yo futuro</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de chat */}
      {showChatModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}
          onClick={closeChat}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              width: "90%",
              maxWidth: 700,
              height: "80vh",
              maxHeight: 600,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#92D050" }}>
                <i className="fa-solid fa-comments" style={{ color: "#92D050", marginRight: 8 }}></i>
                Conversa con tu "yo" del futuro
              </h3>
            </div>

            {/* Mensaje de advertencia */}
            <div style={{
              padding: "16px 24px",
              background: "linear-gradient(135deg, rgba(132, 189, 0, 0.08) 0%, rgba(0, 156, 166, 0.08) 100%)",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start"
            }}>
              <i className="fa-solid fa-info-circle" style={{ color: "#009CA6", fontSize: "18px", marginTop: "2px", flexShrink: 0 }}></i>
              <p style={{
                margin: 0,
                fontSize: "13px",
                lineHeight: "1.5",
                color: "#374151",
                textAlign: "justify"
              }}>
                MentorIA utiliza un sistema de IA para generar contenidos educativos personalizados y orientación acadèmica. Aunque està diseñada para ayudarte, puede cometer errores. Si algo no te resulta claro o adecuado, puedes consultar con tu tutor/a o solicitar revisión humana en cualquier momento.
              </p>
            </div>

            {/* Panel de conversaciones */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              background: "#f9fafb"
            }}>
              {chatMessages.length === 0 ? (
                <div style={{
                  textAlign: "center",
                  color: "#6b7280",
                  padding: 40,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%"
                }}>
                  <i className="fa-solid fa-comments" style={{ fontSize: 48, color: "#92D050", marginBottom: 16 }}></i>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    Inicia una conversación
                  </div>
                  <div style={{ fontSize: 14 }}>
                    Pregúntale a tu "yo" del futuro sobre {currentSalidaTitulo}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "70%",
                        padding: "12px 16px",
                        borderRadius: 12,
                        background: msg.role === "user" ? "#92D050" : "white",
                        color: msg.role === "user" ? "white" : "#1f2937",
                        fontSize: 14,
                        lineHeight: 1.5,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        wordBreak: "break-word",
                        textAlign: "justify"
                      }}
                      dangerouslySetInnerHTML={{ __html: formatMessageContent(msg.content) }}
                    />
                  </div>
                ))
              )}
              {isSendingMessage && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{
                    maxWidth: "70%",
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: "white",
                    color: "#6b7280",
                    fontSize: 14,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                  }}>
                    <i className="fa-solid fa-spinner fa-spin"></i> Respondiendo...
                  </div>
                </div>
              )}
            </div>

            {/* Panel de input */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              gap: 12
            }}>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Escribe tu mensaje..."
                disabled={isSendingMessage}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                  transition: "border-color 0.2s"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#92D050"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#e5e7eb"}
              />
              <button
                onClick={sendMessage}
                disabled={!messageInput.trim() || isSendingMessage}
                style={{
                  padding: "12px 24px",
                  background: messageInput.trim() && !isSendingMessage ? "#92D050" : "#e5e7eb",
                  color: messageInput.trim() && !isSendingMessage ? "white" : "#9ca3af",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: messageInput.trim() && !isSendingMessage ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
                onMouseEnter={(e) => {
                  if (messageInput.trim() && !isSendingMessage) {
                    e.currentTarget.style.background = "#7ab841";
                  }
                }}
                onMouseLeave={(e) => {
                  if (messageInput.trim() && !isSendingMessage) {
                    e.currentTarget.style.background = "#92D050";
                  }
                }}
              >
                <i className="fa-solid fa-paper-plane"></i>
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}