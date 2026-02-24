import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

type Me = { username: string; role: "centro" | "profesor" | "alumno"; centro_id?: string | null };

// Añadir estilos de animación para el spinner
const spinnerStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

type AsignaturaValor = {
  asignatura: string;
  unidad: number;
  valor: number;
};

type Medalla = {
  asignatura: string;
  unidad: number;
  tipo: 'ejercicio' | 'trabajo';
  medalla: 'bronce' | 'plata' | 'oro' | null;
  nota: number;
};

export default function Avatar() {
  const nav = useNavigate();
  const [data, setData] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [avatarImage, setAvatarImage] = useState<string>("/avatar.png");
  const [medallas, setMedallas] = useState<Medalla[]>([]);
  const [asignaturasIconos, setAsignaturasIconos] = useState<{[key: string]: string}>({});
  const [recomendacion, setRecomendacion] = useState<string>("");

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
        
        // Cargar imagen del avatar y asignaturas con valores desde la nueva función
        const response = await fetch(`${BASEDATOS_BASE}/obtener_avatar_imagen`, {
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
          const responseData = await response.json();
          
          // Cargar la imagen del avatar si existe
          if (responseData.imagebase64) {
            setAvatarImage(responseData.imagebase64);
          }
          
          // Procesar medallas de ejercicios y trabajos
          const medallasArray: Medalla[] = [];
          
          // Función para determinar el tipo de medalla según la nota
          const getMedalla = (nota: number): 'bronce' | 'plata' | 'oro' | null => {
            if (nota >= 0 && nota < 5) return 'bronce';
            if (nota >= 5 && nota < 8) return 'plata';
            if (nota >= 8) return 'oro';
            return null;
          };
          
          // Procesar ejercicios
          if (responseData.asignaturas_ejercicios) {
            responseData.asignaturas_ejercicios.forEach((item: AsignaturaValor) => {
              medallasArray.push({
                asignatura: item.asignatura,
                unidad: item.unidad,
                tipo: 'ejercicio',
                medalla: getMedalla(item.valor),
                nota: item.valor
              });
            });
          }
          
          // Procesar trabajos
          if (responseData.asignaturas_trabajos) {
            responseData.asignaturas_trabajos.forEach((item: AsignaturaValor) => {
              medallasArray.push({
                asignatura: item.asignatura,
                unidad: item.unidad,
                tipo: 'trabajo',
                medalla: getMedalla(item.valor),
                nota: item.valor
              });
            });
          }
          
          // Ordenar por asignatura y unidad
          medallasArray.sort((a, b) => {
            if (a.asignatura !== b.asignatura) {
              return a.asignatura.localeCompare(b.asignatura);
            }
            return a.unidad - b.unidad;
          });
          
          setMedallas(medallasArray);
          
          // Guardar los iconos de las asignaturas
          if (responseData.asignaturas_iconos) {
            setAsignaturasIconos(responseData.asignaturas_iconos);
          }
          
          // Guardar la recomendación
          if (responseData.recomendacion) {
            setRecomendacion(responseData.recomendacion);
          }
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
    <>
      <style>{spinnerStyles}</style>
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
          
          <div style={{ padding: "0 16px", paddingTop: "16px", borderTop: "1px solid #e5e7eb", marginTop: "auto" }}>
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#F5F5F5", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, maxWidth: 1400, margin: "0 auto", width: "100%", overflow: "hidden" }}>
            {error && <div style={{ color: "crimson", padding: 16, background: "#fee2e2", borderRadius: 12, marginBottom: 16 }}>{error}</div>}
            
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                <div style={{ textAlign: "center", color: "#6b7280" }}>
                  <div style={{ fontSize: "48px", marginBottom: 16, color: "#84BD00" }}>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando progreso...</div>
                  <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
                </div>
              </div>
            )}

            {!loading && data && (
              <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                <h3 style={{ 
                  margin: "0 0 12px 0", 
                  color: "#84BD00",
                  fontWeight: 700,
                  fontSize: "32px"
                }}>Mi progreso</h3>
                <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
                  Visualiza tu progreso académico en cada asignatura y recibe tips semanales personalizados que te ayudarán a mejorar y avanzar en tu aprendizaje
                </p>

                {/* Mensaje de advertencia */}
                <div style={{
                  padding: "16px 24px",
                  background: "linear-gradient(135deg, rgba(132, 189, 0, 0.08) 0%, rgba(0, 156, 166, 0.08) 100%)",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                  marginBottom: "24px"
                }}>
                  <i className="fa-solid fa-info-circle" style={{ color: "#009CA6", fontSize: "18px", marginTop: "2px", flexShrink: 0 }}></i>
                  <p style={{
                    margin: 0,
                    fontSize: "13px",
                    lineHeight: "1.5",
                    color: "#374151",
                    textAlign: "justify"
                  }}>
                    <strong>MentorIA</strong> utiliza el modelo <strong>Gemini 2.5</strong> para la generación de contenidos educativos personalizados. El sistema opera bajo principios de <strong>supervisión humana</strong>, <strong>minimización de datos</strong>, <strong>evaluación continua de riesgos</strong> y <strong>diseño centrado en el menor</strong>.
                  </p>
                </div>

                {/* Panel único con imagen a la izquierda y asignaturas a la derecha */}
                <div style={{ 
                  flex: 1,
                  background: "white", 
                  padding: 24, 
                  borderRadius: 16, 
                  border: "1px solid #e5e7eb",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  minHeight: 0
                }}>
                  <div style={{ 
                    display: "flex",
                    gap: 16,
                    minHeight: "100%"
                  }}>
                    {/* Columna izquierda: Imagen del avatar y cuadro de texto */}
                    <div style={{ 
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                      maxWidth: 300,
                      flex: 1
                    }}>
                    {/* Imagen del avatar */}
                    <div style={{ 
                      width: 300, 
                      height: 300, 
                      borderRadius: 16, 
                      overflow: "hidden",
                      border: "2px solid #84BD00",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#f9fafb"
                    }}>
                      <img
                        src={avatarImage}
                        alt="Avatar"
                        style={{ 
                          width: "100%", 
                          height: "100%", 
                          objectFit: "cover" 
                        }}
                      />
                    </div>

                      {/* Cuadro de texto debajo de la imagen */}
                      <div
                        style={{
                          width: "300px",
                          flex: 1,
                          padding: 12,
                          borderRadius: 8,
                          border: "2px solid #84BD00",
                          fontSize: 14,
                          fontFamily: "system-ui",
                          color: "#374151",
                          background: "#e8f5e9",
                          overflowY: "auto",
                          textAlign: "justify",
                          lineHeight: 1.6,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center"
                        }}
                      >
                        {recomendacion ? (
                          recomendacion.split('\n').map((line, i) => (
                            <p key={i} style={{ margin: "0 0 8px 0" }}>
                              {line.split(/\*\*(.*?)\*\*/g).map((part, j) => 
                                j % 2 === 1 ? (
                                  <strong key={j} style={{ color: "#84BD00" }}>{part}</strong>
                                ) : (
                                  <React.Fragment key={j}>{part}</React.Fragment>
                                )
                              )}
                            </p>
                          ))
                        ) : (
                          <span style={{ color: "#9ca3af" }}>
                            En este panel se mostrarán los comentarios semanales que vayas recibiendo de MentorIA para ayudarte a progresar. Sigue utilizando la plataforma y recibirás nuevos consejos.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Columna derecha: Medallas obtenidas */}
                    <div style={{ 
                      flex: 1,
                      display: "flex",
                      flexDirection: "column"
                    }}>
                      {medallas.length === 0 ? (
                        <p style={{ color: "#6b7280", fontSize: 14 }}>
                          No hay medallas disponibles
                        </p>
                      ) : (
                        <div style={{ 
                          overflowY: "auto",
                          flex: 1,
                          border: "2px solid #84BD00",
                          borderRadius: 8
                        }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                              {(() => {
                                // Calcular número máximo de unidades (mínimo 8)
                                let maxUnidades = 8;
                                medallas.forEach(m => {
                                  if (m.unidad > maxUnidades) maxUnidades = m.unidad;
                                });

                                // Agrupar medallas por asignatura, tipo y unidad
                                const datosPorAsignatura: { 
                                  [asignatura: string]: { 
                                    [tipo: string]: { [unidad: number]: Medalla } 
                                  } 
                                } = {};
                                
                                medallas.forEach(m => {
                                  if (!datosPorAsignatura[m.asignatura]) {
                                    datosPorAsignatura[m.asignatura] = { ejercicio: {}, trabajo: {} };
                                  }
                                  datosPorAsignatura[m.asignatura][m.tipo][m.unidad] = m;
                                });

                                // Función para obtener icono de medalla según nota
                                const getMedallaIcon = (nota: number | undefined) => {
                                  if (nota === undefined) return '';
                                  if (nota >= 8) return '🥇';
                                  if (nota >= 6) return '🥈';
                                  if (nota >= 4) return '🥉';
                                  return '';
                                };

                                // Obtener asignaturas únicas
                                const asignaturasSet = new Set<string>();
                                medallas.forEach(m => asignaturasSet.add(m.asignatura));
                                const asignaturas = Array.from(asignaturasSet);

                                return asignaturas.map(asignatura => (
                                  <>
                                    {/* Fila de Ejercicios */}
                                    <tr key={`${asignatura}-ejercicios`}>
                                      {/* Imagen asignatura con rowspan=2 */}
                                      <td 
                                        rowSpan={2}
                                        style={{
                                          padding: "8px",
                                          width: "96px",
                                          height: "96px",
                                          background: "#e8f5e9",
                                          borderBottom: "2px solid #e5e7eb",
                                          borderRight: "2px solid #e5e7eb",
                                          verticalAlign: "middle",
                                          textAlign: "center"
                                        }}
                                      >
                                        {asignaturasIconos[asignatura] ? (
                                          <img 
                                            src={asignaturasIconos[asignatura]} 
                                            alt={asignatura}
                                            style={{
                                              width: "80px",
                                              height: "80px",
                                              objectFit: "contain",
                                              borderRadius: "8px"
                                            }}
                                          />
                                        ) : (
                                          <span style={{
                                            fontWeight: 700,
                                            fontSize: 15,
                                            color: "#1f2937"
                                          }}>{asignatura}</span>
                                        )}
                                      </td>
                                      
                                      {/* Etiqueta Ejercicios */}
                                      <td style={{
                                        padding: "12px 16px",
                                        width: "120px",
                                        background: "#ffffff",
                                        color: "#84BD00",
                                        fontWeight: 600,
                                        fontSize: 15,
                                        textAlign: "center",
                                        borderBottom: "1px solid #e5e7eb",
                                        borderRight: "1px solid #e5e7eb"
                                      }}>
                                        Ejercicios
                                      </td>
                                      
                                      {/* Columnas de unidades con medallas de ejercicios */}
                                      {Array.from({ length: maxUnidades }, (_, i) => i + 1).map(unidad => {
                                        const medalla = datosPorAsignatura[asignatura]?.ejercicio?.[unidad];
                                        const icono = getMedallaIcon(medalla?.nota);
                                        return (
                                          <td 
                                            key={`ej-${unidad}`}
                                            style={{
                                              padding: "8px",
                                              width: "60px",
                                              height: "48px",
                                              textAlign: "center",
                                              fontSize: 24,
                                              background: icono ? "#e8f5e9" : "#ffffff",
                                              borderBottom: "1px solid #e5e7eb",
                                              borderRight: "1px solid #e5e7eb",
                                              verticalAlign: "middle"
                                            }}
                                            title={medalla ? `Nota: ${medalla.nota.toFixed(2)}` : ""}
                                          >
                                            {icono}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                    
                                    {/* Fila de Trabajos */}
                                    <tr key={`${asignatura}-trabajos`}>
                                      {/* Etiqueta Trabajos */}
                                      <td style={{
                                        padding: "12px 16px",
                                        width: "120px",
                                        background: "#ffffff",
                                        color: "#84BD00",
                                        fontWeight: 600,
                                        fontSize: 15,
                                        textAlign: "center",
                                        borderBottom: "2px solid #e5e7eb",
                                        borderRight: "1px solid #e5e7eb"
                                      }}>
                                        Trabajos
                                      </td>
                                      
                                      {/* Columnas de unidades con medallas de trabajos */}
                                      {Array.from({ length: maxUnidades }, (_, i) => i + 1).map(unidad => {
                                        const medalla = datosPorAsignatura[asignatura]?.trabajo?.[unidad];
                                        const icono = getMedallaIcon(medalla?.nota);
                                        return (
                                          <td 
                                            key={`tr-${unidad}`}
                                            style={{
                                              padding: "8px",
                                              width: "60px",
                                              height: "48px",
                                              textAlign: "center",
                                              fontSize: 24,
                                              background: icono ? "#e8f5e9" : "#ffffff",
                                              borderBottom: "2px solid #e5e7eb",
                                              borderRight: "1px solid #e5e7eb",
                                              verticalAlign: "middle"
                                            }}
                                            title={medalla ? `Nota: ${medalla.nota.toFixed(2)}` : ""}
                                          >
                                            {icono}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  </>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
