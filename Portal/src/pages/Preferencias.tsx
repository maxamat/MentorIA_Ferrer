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

export default function Preferencias() {
  const nav = useNavigate();
  const [data, setData] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    preguntaA: "",
    preguntaB: "",
    preguntaC: "",
    preguntaD: "",
    preguntaE: "",
    turnoFormativo: "",
    maxTiempoDesplazamiento: 30,
    avatarConfig: {
      colorPelo: "#1C1C1C",
      colorOjos: "#8B4513",
      colorPiel: "#A67C52",
      colorLabios: "#C48B79",
      colorCamiseta: "#92D050",
      genero: "neutro",
      tipoPeinado: "corto"
    }
  });

  const jwt = localStorage.getItem("jwt") || "";

  useEffect(() => {
    if (!jwt) {
      nav("/");
      return;
    }
    me(jwt)
      .then((userData) => {
        setData(userData);
        // Cargar preferencias existentes
        const centroId = (userData as any)?.centro_id || "";
        const alumnoId = userData?.username || "";
        
        return fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_intereses_alumnos`, {
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
      })
      .then(response => {
        if (response && response.ok) {
          return response.json();
        }
        return null;
      })
      .then(async (interesesData) => {
        if (interesesData && interesesData.intereses && interesesData.intereses.length > 0) {
          const interes = interesesData.intereses[0];
          
          // Definir arrays de colores
          const coloresPelo = [
            { nombre: "Castaño", valor: "#8B4513" },
            { nombre: "Negro", valor: "#1C1C1C" },
            { nombre: "Rubio", valor: "#F0E68C" },
            { nombre: "Rojo", valor: "#DC143C" },
            { nombre: "Blanco", valor: "#E8E8E8" }
          ];
          const coloresOjos = [
            { nombre: "Azul", valor: "#4A90E2" },
            { nombre: "Verde", valor: "#50C878" },
            { nombre: "Marrón", valor: "#8B4513" },
            { nombre: "Gris", valor: "#808080" },
            { nombre: "Ámbar", valor: "#FFBF00" }
          ];
          const coloresPiel = [
            { nombre: "Clara", valor: "#F5D5B8" },
            { nombre: "Morena", valor: "#A67C52" },
            { nombre: "Oscura", valor: "#6F4E37" }
          ];
          const coloresLabios = [
            { nombre: "Rosa", valor: "#E57373" },
            { nombre: "Rojo", valor: "#D32F2F" },
            { nombre: "Natural", valor: "#C48B79" },
            { nombre: "Coral", valor: "#FF7F50" }
          ];
          const coloresCamiseta = [
            { nombre: "Verde", valor: "#92D050" },
            { nombre: "Azul", valor: "#2196F3" },
            { nombre: "Rojo", valor: "#F44336" },
            { nombre: "Amarillo", valor: "#FFC107" },
            { nombre: "Morado", valor: "#9C27B0" },
            { nombre: "Negro", valor: "#424242" },
            { nombre: "Blanco", valor: "#FAFAFA" }
          ];
          
          // Cargar configuración del avatar desde interes si existe, sino valores por defecto
          let avatarConfig = {
            colorPelo: "#1C1C1C",
            colorOjos: "#8B4513",
            colorPiel: "#F5D5B8",
            colorLabios: "#C48B79",
            colorCamiseta: "#92D050",
            genero: "neutro",
            tipoPeinado: "corto"
          };

          // Intentar cargar desde interes primero (si el backend lo devuelve)
          if (interes.color_pelo || interes.color_ojos || interes.color_piel || interes.color_labios || interes.color_camiseta) {
            avatarConfig = {
              colorPelo: coloresPelo.find(c => c.nombre.toLowerCase() === interes.color_pelo?.toLowerCase())?.valor || "#1C1C1C",
              colorOjos: coloresOjos.find(c => c.nombre.toLowerCase() === interes.color_ojos?.toLowerCase())?.valor || "#8B4513",
              colorPiel: coloresPiel.find(c => c.nombre.toLowerCase() === interes.color_piel?.toLowerCase())?.valor || "#F5D5B8",
              colorLabios: coloresLabios.find(c => c.nombre.toLowerCase() === interes.color_labios?.toLowerCase())?.valor || "#C48B79",
              colorCamiseta: coloresCamiseta.find(c => c.nombre.toLowerCase() === interes.color_camiseta?.toLowerCase())?.valor || "#92D050",
              genero: interes.genero || "neutro",
              tipoPeinado: interes.tipo_peinado || "corto"
            };
          } else {
            // Si no están en interes, intentar cargar desde listar_avatar_config
            try {
              const avatarResponse = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_avatar_config`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
                },
                body: JSON.stringify({
                  centro_id: (data as any)?.centro_id || "",
                  alumno_id: data?.username || ""
                })
              });
              
              if (avatarResponse.ok) {
                const avatarData = await avatarResponse.json();
                if (avatarData.avatar) {
                  avatarConfig = {
                    colorPelo: coloresPelo.find(c => c.nombre.toLowerCase() === avatarData.avatar.color_pelo?.toLowerCase())?.valor || "#1C1C1C",
                    colorOjos: coloresOjos.find(c => c.nombre.toLowerCase() === avatarData.avatar.color_ojos?.toLowerCase())?.valor || "#8B4513",
                    colorPiel: coloresPiel.find(c => c.nombre.toLowerCase() === avatarData.avatar.color_piel?.toLowerCase())?.valor || "#F5D5B8",
                    colorLabios: coloresLabios.find(c => c.nombre.toLowerCase() === avatarData.avatar.color_labios?.toLowerCase())?.valor || "#C48B79",
                    colorCamiseta: coloresCamiseta.find(c => c.nombre.toLowerCase() === avatarData.avatar.color_camiseta?.toLowerCase())?.valor || "#92D050",
                    genero: avatarData.avatar.genero || "neutro",
                    tipoPeinado: avatarData.avatar.tipo_peinado || "corto"
                  };
                }
              }
            } catch (e) {
              console.log("Error cargando configuración de avatar", e);
            }
          }

          setFormData({
            preguntaA: interes.texto_tiempo_libre || "",
            preguntaB: interes.texto_que_te_motiva || "",
            preguntaC: interes.texto_que_te_ayuda_a_entender || "",
            preguntaD: interes.texto_que_te_frustra_a_estudiar || "",
            preguntaE: interes.texto_que_asignaturas_se_te_dan_mejor || "",
            turnoFormativo: interes.turno_formativo || "",
            maxTiempoDesplazamiento: interes.max_tiempo_desplazamiento || 30,
            avatarConfig: avatarConfig
          });
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

  function handleNext() {
    if (step < 4) {
      setStep(step + 1);
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep(step - 1);
    }
  }

  function handleSubmit() {
    if (isSaving) return;
    
    setIsSaving(true);
    const centroId = (data as any)?.centro_id || "";
    const alumnoId = data?.username || "";
    
    // Convertir colores HEX a nombres
    const coloresPelo = [
      { nombre: "Castaño", valor: "#8B4513" },
      { nombre: "Negro", valor: "#1C1C1C" },
      { nombre: "Rubio", valor: "#F0E68C" },
      { nombre: "Rojo", valor: "#DC143C" },
      { nombre: "Blanco", valor: "#E8E8E8" }
    ];
    const coloresOjos = [
      { nombre: "Azul", valor: "#4A90E2" },
      { nombre: "Verde", valor: "#50C878" },
      { nombre: "Marrón", valor: "#8B4513" },
      { nombre: "Gris", valor: "#808080" },
      { nombre: "Ámbar", valor: "#FFBF00" }
    ];
    const coloresPiel = [
      { nombre: "Clara", valor: "#F5D5B8" },
      { nombre: "Morena", valor: "#A67C52" },
      { nombre: "Oscura", valor: "#6F4E37" }
    ];
    const coloresLabios = [
      { nombre: "Rosa", valor: "#E57373" },
      { nombre: "Rojo", valor: "#D32F2F" },
      { nombre: "Natural", valor: "#C48B79" },
      { nombre: "Coral", valor: "#FF7F50" }
    ];
    const coloresCamiseta = [
      { nombre: "Verde", valor: "#92D050" },
      { nombre: "Azul", valor: "#2196F3" },
      { nombre: "Rojo", valor: "#F44336" },
      { nombre: "Amarillo", valor: "#FFC107" },
      { nombre: "Morado", valor: "#9C27B0" },
      { nombre: "Negro", valor: "#424242" },
      { nombre: "Blanco", valor: "#FAFAFA" }
    ];

    const colorPeloNombre = coloresPelo.find(c => c.valor === formData.avatarConfig.colorPelo)?.nombre || "Negro";
    const colorOjosNombre = coloresOjos.find(c => c.valor === formData.avatarConfig.colorOjos)?.nombre || "Marrón";
    const colorPielNombre = coloresPiel.find(c => c.valor === formData.avatarConfig.colorPiel)?.nombre || "Morena";
    const colorLabiosNombre = coloresLabios.find(c => c.valor === formData.avatarConfig.colorLabios)?.nombre || "Natural";
    const colorCamisetaNombre = coloresCamiseta.find(c => c.valor === formData.avatarConfig.colorCamiseta)?.nombre || "Verde";
    
    // Llamar a la API de base de datos para actualizar T_ALUMNO_INTERES con datos del avatar incluidos
    fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/actualizar_alumno_interes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
      },
      body: JSON.stringify({
        centro_id: centroId,
        alumno_id: alumnoId,
        texto_tiempo_libre: formData.preguntaA,
        texto_que_te_motiva: formData.preguntaB,
        texto_que_te_ayuda_a_entender: formData.preguntaC,
        texto_que_te_frustra_a_estudiar: formData.preguntaD,
        texto_que_asignaturas_se_te_dan_mejor: formData.preguntaE,
        turno_formativo: formData.turnoFormativo,
        max_tiempo_desplazamiento: formData.maxTiempoDesplazamiento,
        color_pelo: colorPeloNombre,
        color_ojos: colorOjosNombre,
        color_piel: colorPielNombre,
        color_labios: colorLabiosNombre,
        color_camiseta: colorCamisetaNombre,
        genero: formData.avatarConfig.genero,
        tipo_peinado: formData.avatarConfig.tipoPeinado
      })
    })
      .then(response => {
        if (!response.ok) throw new Error("Error al guardar preferencias");
        return response.json();
      })
      .then(() => {
        setShowSuccessModal(true);
        setStep(1); // Volver al primer paso
      })
      .catch((error) => {
        console.error("Error:", error);
        setError("Error al guardar preferencias");
      })
      .finally(() => {
        setIsSaving(false);
      });
  }

  const getProgress = () => {
    if (step === 1) return 0;
    if (step === 2) return 25;
    if (step === 3) return 50;
    if (step === 4) return 75;
    return 0;
  };

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
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#F5F5F5", overflow: "auto", position: "relative" }}>
          {isSaving && (
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255, 255, 255, 0.9)",
              zIndex: 1000,
              gap: 12
            }}>
              <div style={{
                width: 48,
                height: 48,
                border: "4px solid #e5e7eb",
                borderTop: "4px solid #92D050",
                borderRadius: "50%",
                animation: "spin 1s linear infinite"
              }}></div>
              <div style={{
                fontSize: 14,
                color: "#6b7280",
                fontWeight: 600
              }}>Guardando preferencias...</div>
            </div>
          )}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%", overflow: "hidden" }}>
            {error && <div style={{ color: "crimson", padding: 16, background: "#fee2e2", borderRadius: 12, marginBottom: 16 }}>{error}</div>}
            
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                <div style={{ textAlign: "center", color: "#6b7280" }}>
                  <div style={{ fontSize: "48px", marginBottom: 16, color: "#84BD00" }}>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando preferencias...</div>
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
                }}>Mis preferencias</h3>
                <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700, color: "#92D050" }}>Personaliza tu experiencia en 2 minutos</span>. 
                  Ayúdanos a conocer tus preferencias y aficiones para personalizar tu experiencia de aprendizaje. 
                  Recuerda, no hay respuestas buenas o malas.
                </p>

                {/* Panel del formulario */}
                <div style={{ flex: 1, padding: 24, background: "white", border: "1px solid #e5e7eb", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                  {/* Barra de progreso */}
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                      Progreso: {getProgress()}%
                    </div>
                    <div style={{ width: "100%", height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ 
                        width: `${getProgress()}%`, 
                        height: "100%", 
                        background: "#92D050",
                        transition: "width 0.3s ease"
                      }}></div>
                    </div>
                  </div>

                  {/* Paso 1: Preguntas A y B */}
                  {step === 1 && (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                      <div style={{ flex: 1, marginBottom: 16, display: "flex", flexDirection: "column" }}>
                        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: "#92D050" }}>Para empezar: ¿Qué te encanta hacer cuando tienes tiempo libre?</span>
                        </label>
                        <textarea
                          value={formData.preguntaA}
                          onChange={(e) => setFormData({ ...formData, preguntaA: e.target.value })}
                          placeholder="Piensa en tardes, findes o vacaciones. Vale cualquier cosa: deporte, juegos, música, quedar con gente, dibujar, cocinar,..."
                          style={{
                            width: "100%",
                            flex: 1,
                            padding: 12,
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            fontSize: 14,
                            fontFamily: "system-ui",
                            resize: "none"
                          }}
                        />
                      </div>

                      <div style={{ flex: 1, marginBottom: 16, display: "flex", flexDirection: "column" }}>
                        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: "#92D050" }}>¿Qué te motiva más cuando haces algo?</span>
                        </label>
                        <textarea
                          value={formData.preguntaB}
                          onChange={(e) => setFormData({ ...formData, preguntaB: e.target.value })}
                          placeholder="Por ejemplo: mejorar poco a poco, competir, hacer cosas con amigos, crear algo, que sirva en tu día a día, que te salga bien, ..."
                          style={{
                            width: "100%",
                            flex: 1,
                            padding: 12,
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            fontSize: 14,
                            fontFamily: "system-ui",
                            resize: "none"
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}>
                        <button
                          onClick={handleNext}
                          style={{
                            padding: "12px 24px",
                            borderRadius: 8,
                            border: "none",
                            background: "#92D050",
                            color: "white",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: 14
                          }}
                        >
                          Adelante
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Paso 2: Preguntas C y D */}
                  {step === 2 && (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                      <div style={{ flex: 1, marginBottom: 16, display: "flex", flexDirection: "column" }}>
                        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: '#92D050' }}>Cuando estudias, ¿qué te ayuda más a entender?</span>
                        </label>
                        <textarea
                          value={formData.preguntaC}
                          onChange={(e) => setFormData({ ...formData, preguntaC: e.target.value })}
                          placeholder="Por ejemplo: ver un ejemplo resuelto, practicar con ejercicios cortos, que te lo expliquen con un caso real,..."
                          style={{
                            width: "100%",
                            flex: 1,
                            padding: 12,
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            fontSize: 14,
                            fontFamily: "system-ui",
                            resize: "none"
                          }}
                        />
                      </div>

                      <div style={{ flex: 1, marginBottom: 16, display: "flex", flexDirection: "column" }}>
                        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: '#92D050' }}>¿Qué te aburre o te frustra más al estudiar?</span>
                        </label>
                        <textarea
                          value={formData.preguntaD}
                          onChange={(e) => setFormData({ ...formData, preguntaD: e.target.value })}
                          placeholder="Dinos qué se te hace cuesta arriba: memorizar, ejercicios largos, no entender el enunciado, distraerte, no saber por donde empezar,..."
                          style={{
                            width: "100%",
                            flex: 1,
                            padding: 12,
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            fontSize: 14,
                            fontFamily: "system-ui",
                            resize: "none"
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto" }}>
                        <button
                          onClick={handleBack}
                          style={{
                            padding: "12px 24px",
                            borderRadius: 8,
                            border: "none",
                            background: "#A3A3A3",
                            color: "white",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: 14
                          }}
                        >
                          Atrás
                        </button>
                        <button
                          onClick={handleNext}
                          style={{
                            padding: "12px 24px",
                            borderRadius: 8,
                            border: "none",
                            background: "#92D050",
                            color: "white",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: 14
                          }}
                        >
                          Adelante
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Paso 3: Pregunta E, turno formativo y tiempo de desplazamiento */}
                  {step === 3 && (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                      <div style={{ flex: 1, marginBottom: 16, display: "flex", flexDirection: "column" }}>
                        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: '#92D050' }}>¿Qué asignaturas se te dan mejor?</span>
                        </label>
                        <textarea
                          value={formData.preguntaE}
                          onChange={(e) => setFormData({ ...formData, preguntaE: e.target.value })}
                          placeholder="Puedes poner varias asignaturas y explicar el por qué se te dan bien."
                          style={{
                            width: "100%",
                            flex: 1,
                            padding: 12,
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            fontSize: 14,
                            fontFamily: "system-ui",
                            resize: "none"
                          }}
                        />
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: '#92D050' }}>¿Prefieres estudiar de mañanas o de tardes?</span>
                        </label>
                        <select
                          value={formData.turnoFormativo}
                          onChange={(e) => setFormData({ ...formData, turnoFormativo: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "12px 40px 12px 16px",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            fontSize: 14,
                            fontFamily: "system-ui",
                            backgroundColor: "#ffffff",
                            cursor: "pointer"
                          }}
                        >
                          <option value="">Selecciona una opción</option>
                          <option value="Mañanas">Mañanas</option>
                          <option value="Tardes">Tardes</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: '#92D050' }}>En un futuro, ¿cuanto tiempo estarías dispuesto a invertir para desplazarte al centro formativo donde continuar con tus estudios?</span>
                        </label>
                        <input
                          type="number"
                          value={formData.maxTiempoDesplazamiento}
                          onChange={(e) => setFormData({ ...formData, maxTiempoDesplazamiento: parseInt(e.target.value) || 0 })}
                          min="0"
                          max="300"
                          placeholder="Ej: 30"
                          style={{
                            width: "100%",
                            padding: 12,
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            fontSize: 14,
                            fontFamily: "system-ui"
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto" }}>
                        <button
                          onClick={handleBack}
                          style={{
                            padding: "12px 24px",
                            borderRadius: 8,
                            border: "none",
                            background: "#A3A3A3",
                            color: "white",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: 14
                          }}
                        >
                          Atrás
                        </button>
                        <button
                          onClick={handleNext}
                          style={{
                            padding: "12px 24px",
                            borderRadius: 8,
                            border: "none",
                            background: "#92D050",
                            color: "white",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: 14
                          }}
                        >
                          Adelante
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Paso 4: Configuración del avatar */}
                  {step === 4 && (() => {
                    const coloresPelo = [
                      { nombre: "Castaño", valor: "#8B4513" },
                      { nombre: "Negro", valor: "#1C1C1C" },
                      { nombre: "Rubio", valor: "#F0E68C" },
                      { nombre: "Rojo", valor: "#DC143C" },
                      { nombre: "Blanco", valor: "#E8E8E8" }
                    ];
                    const coloresOjos = [
                      { nombre: "Azul", valor: "#4A90E2" },
                      { nombre: "Verde", valor: "#50C878" },
                      { nombre: "Marrón", valor: "#8B4513" },
                      { nombre: "Gris", valor: "#808080" },
                      { nombre: "Ámbar", valor: "#FFBF00" }
                    ];
                    const coloresPiel = [
                      { nombre: "Clara", valor: "#F5D5B8" },
                      { nombre: "Morena", valor: "#A67C52" },
                      { nombre: "Oscura", valor: "#6F4E37" }
                    ];
                    const coloresLabios = [
                      { nombre: "Rosa", valor: "#E57373" },
                      { nombre: "Rojo", valor: "#D32F2F" },
                      { nombre: "Natural", valor: "#C48B79" },
                      { nombre: "Coral", valor: "#FF7F50" }
                    ];
                    const coloresCamiseta = [
                      { nombre: "Verde", valor: "#92D050" },
                      { nombre: "Azul", valor: "#2196F3" },
                      { nombre: "Rojo", valor: "#F44336" },
                      { nombre: "Amarillo", valor: "#FFC107" },
                      { nombre: "Morado", valor: "#9C27B0" },
                      { nombre: "Negro", valor: "#424242" },
                      { nombre: "Blanco", valor: "#FAFAFA" }
                    ];
                    const generos = ["Femenino", "Masculino", "Neutro"];
                    const tiposPeinado = ["Corto", "Largo", "Liso", "Rizado", "Alineado", "Despeinado"];

                    return (
                      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: "block", fontSize: 14, fontWeight: 400, color: "#6b7280", marginBottom: 8 }}>
                            <span style={{ fontWeight: 700, color: "#92D050" }}>Personaliza tu avatar</span>. Define la apariencia de tu avatar en <span style={{ fontWeight: 700, color: "#92D050" }}>MentorIA</span>.
                          </label>
                        </div>
                        
                        <div style={{ 
                          flex: 1,
                          background: "white",
                          border: "2px solid transparent",
                          borderRadius: 12,
                          padding: 24,
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column"
                        }}>
                          <div style={{ 
                            display: "flex", 
                            flexDirection: "column", 
                            flex: 1, 
                            justifyContent: "space-evenly", 
                            overflowY: "auto",
                            paddingLeft: 16, 
                            paddingRight: 16
                          }}>
                          {/* Color de pelo */}
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <label style={{ fontSize: 14, fontWeight: 700, color: "#6b7280", minWidth: 140, flexShrink: 0 }}>Color de pelo:</label>
                            <div style={{ display: "flex", gap: 8, flex: 1 }}>
                              {coloresPelo.map(color => (
                                <button
                                  key={color.valor}
                                  onClick={() => setFormData({ ...formData, avatarConfig: { ...formData.avatarConfig, colorPelo: color.valor } })}
                                  style={{
                                    padding: "6px 12px",
                                    border: formData.avatarConfig.colorPelo === color.valor ? "2px solid #92D050" : "2px solid #e5e7eb",
                                    background: formData.avatarConfig.colorPelo === color.valor ? "rgba(146, 208, 80, 0.1)" : "white",
                                    borderRadius: 8,
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: formData.avatarConfig.colorPelo === color.valor ? 700 : 600,
                                    color: "#1f2937",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flex: 1,
                                    justifyContent: "center"
                                  }}
                                >
                                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: color.valor, border: "1px solid #e5e7eb" }}></div>
                                  {color.nombre}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Color de ojos */}
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <label style={{ fontSize: 14, fontWeight: 700, color: "#6b7280", minWidth: 140, flexShrink: 0 }}>Color de ojos:</label>
                          <div style={{ display: "flex", gap: 8, flex: 1 }}>
                            {coloresOjos.map(color => (
                              <button
                                key={color.valor}
                                onClick={() => setFormData({ ...formData, avatarConfig: { ...formData.avatarConfig, colorOjos: color.valor } })}
                                style={{
                                  padding: "6px 12px",
                                  border: formData.avatarConfig.colorOjos === color.valor ? "2px solid #92D050" : "2px solid #e5e7eb",
                                  background: formData.avatarConfig.colorOjos === color.valor ? "rgba(146, 208, 80, 0.1)" : "white",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontSize: 13,
                                  fontWeight: formData.avatarConfig.colorOjos === color.valor ? 700 : 600,
                                  color: "#1f2937",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  flex: 1,
                                  justifyContent: "center"
                                }}
                              >
                                <div style={{ width: 16, height: 16, borderRadius: "50%", background: color.valor, border: "1px solid #e5e7eb" }}></div>
                                {color.nombre}
                              </button>
                            ))}
                          </div>
                        </div>

                          {/* Color de piel */}
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <label style={{ fontSize: 14, fontWeight: 700, color: "#6b7280", minWidth: 140, flexShrink: 0 }}>Color de piel:</label>
                          <div style={{ display: "flex", gap: 8, flex: 1 }}>
                            {coloresPiel.map(color => (
                              <button
                                key={color.valor}
                                onClick={() => setFormData({ ...formData, avatarConfig: { ...formData.avatarConfig, colorPiel: color.valor } })}
                                style={{
                                  padding: "6px 12px",
                                  border: formData.avatarConfig.colorPiel === color.valor ? "2px solid #92D050" : "2px solid #e5e7eb",
                                  background: formData.avatarConfig.colorPiel === color.valor ? "rgba(146, 208, 80, 0.1)" : "white",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontSize: 13,
                                  fontWeight: formData.avatarConfig.colorPiel === color.valor ? 700 : 600,
                                  color: "#1f2937",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  flex: 1,
                                  justifyContent: "center"
                                }}
                              >
                                <div style={{ width: 16, height: 16, borderRadius: "50%", background: color.valor, border: "1px solid #e5e7eb" }}></div>
                                {color.nombre}
                              </button>
                            ))}
                          </div>
                        </div>

                          {/* Color de labios */}
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <label style={{ fontSize: 14, fontWeight: 700, color: "#6b7280", minWidth: 140, flexShrink: 0 }}>Color de labios:</label>
                          <div style={{ display: "flex", gap: 8, flex: 1 }}>
                            {coloresLabios.map(color => (
                              <button
                                key={color.valor}
                                onClick={() => setFormData({ ...formData, avatarConfig: { ...formData.avatarConfig, colorLabios: color.valor } })}
                                style={{
                                  padding: "6px 12px",
                                  border: formData.avatarConfig.colorLabios === color.valor ? "2px solid #92D050" : "2px solid #e5e7eb",
                                  background: formData.avatarConfig.colorLabios === color.valor ? "rgba(146, 208, 80, 0.1)" : "white",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontSize: 13,
                                  fontWeight: formData.avatarConfig.colorLabios === color.valor ? 700 : 600,
                                  color: "#1f2937",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  flex: 1,
                                  justifyContent: "center"
                                }}
                              >
                                <div style={{ width: 16, height: 16, borderRadius: "50%", background: color.valor, border: "1px solid #e5e7eb" }}></div>
                                {color.nombre}
                              </button>
                            ))}
                          </div>
                        </div>

                          {/* Color de camiseta */}
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <label style={{ fontSize: 14, fontWeight: 700, color: "#6b7280", minWidth: 140, flexShrink: 0 }}>Color de camiseta:</label>
                          <div style={{ display: "flex", gap: 8, flex: 1 }}>
                            {coloresCamiseta.map(color => (
                              <button
                                key={color.valor}
                                onClick={() => setFormData({ ...formData, avatarConfig: { ...formData.avatarConfig, colorCamiseta: color.valor } })}
                                style={{
                                  padding: "6px 12px",
                                  border: formData.avatarConfig.colorCamiseta === color.valor ? "2px solid #92D050" : "2px solid #e5e7eb",
                                  background: formData.avatarConfig.colorCamiseta === color.valor ? "rgba(146, 208, 80, 0.1)" : "white",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontSize: 13,
                                  fontWeight: formData.avatarConfig.colorCamiseta === color.valor ? 700 : 600,
                                  color: "#1f2937",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  flex: 1,
                                  justifyContent: "center"
                                }}
                              >
                                <div style={{ width: 16, height: 16, borderRadius: "50%", background: color.valor, border: "1px solid #e5e7eb" }}></div>
                                {color.nombre}
                              </button>
                            ))}
                          </div>
                        </div>

                          {/* Género */}
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <label style={{ fontSize: 14, fontWeight: 700, color: "#6b7280", minWidth: 140, flexShrink: 0 }}>Género:</label>
                          <div style={{ display: "flex", gap: 8, flex: 1 }}>
                            {generos.map(gen => (
                              <button
                                key={gen}
                                onClick={() => setFormData({ ...formData, avatarConfig: { ...formData.avatarConfig, genero: gen.toLowerCase() } })}
                                style={{
                                  padding: "6px 12px",
                                  border: formData.avatarConfig.genero === gen.toLowerCase() ? "2px solid #92D050" : "2px solid #e5e7eb",
                                  background: formData.avatarConfig.genero === gen.toLowerCase() ? "rgba(146, 208, 80, 0.1)" : "white",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontSize: 13,
                                  fontWeight: formData.avatarConfig.genero === gen.toLowerCase() ? 700 : 600,
                                  color: "#1f2937",
                                  flex: 1,
                                  justifyContent: "center"
                                }}
                              >
                                {gen}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Tipo de peinado */}
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <label style={{ fontSize: 14, fontWeight: 700, color: "#6b7280", minWidth: 140, flexShrink: 0 }}>Tipo de peinado:</label>
                          <div style={{ display: "flex", gap: 8, flex: 1 }}>
                            {tiposPeinado.map(tipo => (
                              <button
                                key={tipo}
                                onClick={() => setFormData({ ...formData, avatarConfig: { ...formData.avatarConfig, tipoPeinado: tipo.toLowerCase() } })}
                                style={{
                                  padding: "6px 12px",
                                  border: formData.avatarConfig.tipoPeinado === tipo.toLowerCase() ? "2px solid #92D050" : "2px solid #e5e7eb",
                                  background: formData.avatarConfig.tipoPeinado === tipo.toLowerCase() ? "rgba(146, 208, 80, 0.1)" : "white",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontSize: 13,
                                  fontWeight: formData.avatarConfig.tipoPeinado === tipo.toLowerCase() ? 700 : 600,
                                  color: "#1f2937",
                                  flex: 1,
                                  justifyContent: "center"
                                }}
                              >
                                {tipo}
                              </button>
                            ))}
                          </div>
                        </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 16 }}>
                          <button
                            onClick={handleBack}
                            style={{
                              padding: "12px 24px",
                              borderRadius: 8,
                              border: "none",
                              background: "#A3A3A3",
                              color: "white",
                              fontWeight: 600,
                              cursor: "pointer",
                              fontSize: 14
                            }}
                          >
                            Atrás
                          </button>
                          <button
                            onClick={handleSubmit}
                            disabled={isSaving}
                            style={{
                              padding: "12px 24px",
                              borderRadius: 8,
                              border: "none",
                              background: isSaving ? "#d1d5db" : "#92D050",
                              color: "white",
                              fontWeight: 600,
                              cursor: isSaving ? "not-allowed" : "pointer",
                              fontSize: 14,
                              opacity: isSaving ? 0.6 : 1
                            }}
                          >
                            {isSaving ? "Guardando..." : "Finalizar y enviar"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Modal de éxito */}
    {showSuccessModal && (
      <div 
        onClick={() => setShowSuccessModal(false)}
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
            background: "#84BD00",
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
            lineHeight: 1.6,
            fontFamily: "system-ui"
          }}>
            Tu solicitud se está procesando en este momento. Esto puede tardar entre <strong style={{ color: "#84BD00" }}>5-10 minutos</strong>.
          </p>
        </div>
      </div>
    )}
    </>
  );
}
