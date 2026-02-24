import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { me, registrarConsentimiento, verificarConsentimiento } from "../api";

export default function TerminosCondiciones() {
  const nav = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      nav("/");
      return;
    }
    me(jwt).then(async data => {
      console.log("Datos de me():", data);
      setUserRole(data.role);
      let currentUserId = "";
      let currentCentroId = "";
      
      // Guardar el ID del usuario según su rol
      if (data.role === "centro") {
        // Para centros, usar username como userId
        currentUserId = data.username || data.centro_id;
        currentCentroId = data.centro_id;
        console.log("Rol centro - username:", data.username, "centro_id:", data.centro_id);
      } else if (data.role === "profesor") {
        currentUserId = data.username || data.profesor_id;
        currentCentroId = data.centro_id;
        console.log("Rol profesor - username:", data.username, "centro_id:", data.centro_id);
      } else if (data.role === "alumno") {
        currentUserId = data.username || data.alumno_id;
        currentCentroId = data.centro_id;
        console.log("Rol alumno - username:", data.username, "centro_id:", data.centro_id);
      }
      
      console.log("Estableciendo - userId:", currentUserId, "centroId:", currentCentroId);
      setUserId(currentUserId);
      setCentroId(currentCentroId);
      
      // Verificar si el consentimiento ya existe
      if (currentUserId && currentCentroId) {
        try {
          console.log("Verificando consentimiento existente...");
          const response = await verificarConsentimiento(currentUserId, currentCentroId);
          console.log("Respuesta verificación:", response);
          if (response.existe) {
            setAccepted(true);
          }
        } catch (error) {
          console.error("Error verificando consentimiento:", error);
        }
      }
      
      setLoading(false);
    });
  }, [nav]);

  const handleAcceptClick = async () => {
    console.log("handleAcceptClick llamado", { accepted, userId, centroId });
    
    // Solo permitir marcar, no desmarcar
    if (accepted) {
      console.log("Ya está aceptado, no se hace nada");
      return;
    }
    
    if (!userId || !centroId) {
      console.error("Faltan userId o centroId", { userId, centroId });
      return;
    }
    
    console.log("Marcando como aceptado y registrando...");
    setAccepted(true);
    
    // Registrar en la BD
    try {
      console.log("Llamando a registrarConsentimiento", { userId, centroId });
      const response = await registrarConsentimiento(userId, centroId);
      console.log("Consentimiento registrado exitosamente", response);
    } catch (error) {
      console.error("Error registrando consentimiento:", error);
      // Si hay error, revertir el estado
      setAccepted(false);
    }
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
        {/* Panel lateral de navegación - solo se muestra cuando no está cargando */}
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
            {userRole !== "profesor" && userRole !== "alumno" && (
              <>
                <button onClick={() => nav("/app")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-users" style={{ fontSize: "16px" }}></i>Usuarios</button>
                <button onClick={() => nav("/clases")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-school" style={{ fontSize: "16px" }}></i>Clases</button>
                <button onClick={() => nav("/asignaturas")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-book" style={{ fontSize: "16px" }}></i>Asignaturas</button>
                <button onClick={() => nav("/profesores")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-chalkboard-user" style={{ fontSize: "16px" }}></i>Profesores</button>
                <button onClick={() => nav("/alumnos")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-user-graduate" style={{ fontSize: "16px" }}></i>Alumnos</button>
                <button onClick={() => nav("/curriculums")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-file-pdf" style={{ fontSize: "16px" }}></i>Curriculums</button>
                <button onClick={() => nav("/configuracion")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-gear" style={{ fontSize: "16px" }}></i>Configuración</button>
              </>
            )}
            {userRole === "profesor" && (
              <>
                <button onClick={() => nav("/programacion")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-calendar-days" style={{ fontSize: "16px" }}></i>Programación</button>
                <button onClick={() => nav("/secciones")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-list-check" style={{ fontSize: "16px" }}></i>Secciones</button>
                <button onClick={() => nav("/contenido-formativo")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-book-open" style={{ fontSize: "16px" }}></i>Contenido Formativo</button>
                <button onClick={() => nav("/dashboard-profesor")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-chart-line" style={{ fontSize: "16px" }}></i>Dashboard</button>
              </>
            )}
            {userRole === "alumno" && (
              <>
                <button onClick={() => nav("/avatar")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-user" style={{ fontSize: "16px" }}></i>Mi progreso</button>
                <button onClick={() => nav("/preferencias")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-sliders" style={{ fontSize: "16px" }}></i>Mis preferencias</button>
                <button onClick={() => nav("/salidas-profesionales")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-briefcase" style={{ fontSize: "16px" }}></i>Salidas profesionales</button>
                <button onClick={() => nav("/asignaturas-alumno")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-book-open" style={{ fontSize: "16px" }}></i>Asignaturas</button>
                <button onClick={() => nav("/ejercicios")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-pen-to-square" style={{ fontSize: "16px" }}></i>Ejercicios</button>
                <button onClick={() => nav("/microproyectos")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-diagram-project" style={{ fontSize: "16px" }}></i>Microproyectos</button>
              </>
            )}
            <button onClick={() => nav("/terminos-condiciones")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "rgba(146, 208, 80, 0.1)", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }}><i className="fa-solid fa-file-contract" style={{ fontSize: "16px" }}></i>Términos legales</button>
          </div>
          <div style={{ padding: "0 16px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            <button onClick={() => { localStorage.removeItem("jwt"); nav("/"); }} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#ef4444", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-right-from-bracket" style={{ fontSize: "16px" }}></i>Cerrar sesión</button>
          </div>
        </nav>
        )}

        {/* Área de contenido */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "transparent", overflow: "auto" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <div style={{ textAlign: "center", color: "#6b7280" }}>
                <div style={{ fontSize: "48px", marginBottom: 16, color: "#84BD00" }}>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                </div>
                <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando términos y condiciones...</div>
                <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
              </div>
            </div>
          ) : (
          <div style={{ display: "flex", flexDirection: "column", padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
            {/* Contenido de términos y condiciones */}
            <div style={{ background: "transparent", borderRadius: 12, padding: 32, maxHeight: "calc(100vh - 200px)", overflow: "auto" }}>
              <div style={{ maxWidth: 800, margin: "0 auto" }}>
                <h3 style={{ margin: "0 0 12px 0", color: "#84BD00", fontWeight: 700, fontSize: "32px" }}>Términos y Condiciones Generales de Uso</h3>
                <p style={{ margin: "0 0 32px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6, fontStyle: "italic" }}>
                  Última actualización: 23 febrero 2026
                </p>

                <div style={{ borderTop: "1px solid #e5e7eb", margin: "32px 0" }}></div>

                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 24, textAlign: "justify" }}>
                  Estos Términos y Condiciones Generales de Uso regulan el acceso, navegación y uso de la plataforma <strong>MentorIA</strong> (en adelante, "MentorIA"), desarrollada por <strong>FERRER INTERNACIONAL, S.A.</strong> (en adelante, "Ferrer"), así como las responsabilidades derivadas de la utilización de sus contenidos y servicios.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  Los datos identificativos de Ferrer como responsable de MentorIA se detallan a continuación:
                </p>
                <ul style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 16, paddingLeft: 24, textAlign: "justify" }}>
                  <li style={{ marginBottom: 8 }}>Domicilio social: Avenida Diagonal, 549, 5ª Planta, 08029, Barcelona (España)</li>
                  <li style={{ marginBottom: 8 }}>NIF: A-08041162</li>
                  <li style={{ marginBottom: 8 }}>Datos del registro: Registro Mercantil de Barcelona, Tomo 24.875, Folio 163, Hoja B-78.309, Inscripción 54ª</li>
                </ul>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  La expresión "Usuario" comprende cualquier persona que acceda a MentorIA, ya sea directamente, o desde cualquier otro lugar de Internet.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 32, textAlign: "justify" }}>
                  El Usuario puede efectuar sus consultas remitiendo un escrito a la dirección señalada o bien a través del teléfono 935053550 o el correo electrónico de contacto <strong style={{ color: "#374151" }}>legal@ferrer.com</strong>.
                </p>

                <h4 style={{ color: "#84BD00", fontWeight: 700, fontSize: "20px", marginBottom: 16 }}>1. Objeto y alcance de MentorIA</h4>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  MentorIA es una plataforma educativa basada en inteligencia artificial que ofrece contenido académico personalizado, tutoría virtual y orientación profesional a estudiantes de entre 10 y 14 años en riesgo de abandono escolar.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  MentorIA proporciona herramientas de apoyo orientadas a:
                </p>
                <ul style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 16, paddingLeft: 24, textAlign: "justify" }}>
                  <li style={{ marginBottom: 8 }}>planificación y hábitos de estudio;</li>
                  <li style={{ marginBottom: 8 }}>acompañamiento en itinerarios académicos;</li>
                  <li style={{ marginBottom: 8 }}>identificación de intereses y preferencias;</li>
                  <li style={{ marginBottom: 8 }}>recomendaciones informativas sobre competencias y salidas formativas y profesionales;</li>
                  <li style={{ marginBottom: 8 }}>recursos para mejorar la toma de decisiones educativas.</li>
                </ul>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  <strong>1.1. Naturaleza orientativa.</strong> MentorIA ofrece recomendaciones y contenidos de carácter informativo y orientador. No constituye asesoramiento profesional individualizado (por ejemplo, psicológico, clínico o de selección laboral) ni sustituye la intervención educativa del Centro Educativo.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 32, textAlign: "justify" }}>
                  <strong>1.2 Sin garantía de resultados.</strong> Ferrer no garantiza resultados concretos (p. ej., calificaciones, acceso a programas, obtención de becas, prácticas o empleo).
                </p>

                <h4 style={{ color: "#84BD00", fontWeight: 700, fontSize: "20px", marginBottom: 16 }}>2. Condiciones de acceso para menores de edad</h4>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  MentorIA está concebida para su uso en el ámbito educativo, por lo que una parte relevante del alumnado será menor de edad.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  El acceso del alumnado menor se realizará bajo la supervisión y habilitación del Centro Educativo, y con las bases legitimadoras y autorizaciones que correspondan conforme a la normativa aplicable (incluida la normativa de protección de datos). Cuando proceda, el Centro Educativo será responsable de recabar el consentimiento o autorización de madres, padres o tutores legales, o de articular la base jurídica alternativa que corresponda.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 32, textAlign: "justify" }}>
                  Ferrer podrá establecer mecanismos razonables de verificación y, si detecta un uso no autorizado, podrá suspender la cuenta o limitar funcionalidades para proteger al menor y la integridad del servicio.
                </p>

                <h4 style={{ color: "#84BD00", fontWeight: 700, fontSize: "20px", marginBottom: 16 }}>3. Requisitos de Acceso</h4>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 32, textAlign: "justify" }}>
                  Para acceder a MentorIA, el Usuario debe contar con una cuenta de Usuario y contraseña, y su acceso es gratuito.
                </p>

                <h4 style={{ color: "#84BD00", fontWeight: 700, fontSize: "20px", marginBottom: 16 }}>4. Uso Adecuado</h4>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 32, textAlign: "justify" }}>
                  El Usuario se compromete a utilizar MentorIA conforme a la legislación vigente, la buena fe, el orden público y las presentes Condiciones. Queda prohibido introducir contenidos ilícitos, discriminatorios, ofensivos o que vulneren derechos fundamentales.
                </p>

                <h4 style={{ color: "#84BD00", fontWeight: 700, fontSize: "20px", marginBottom: 16 }}>5. Responsabilidades y exclusión de garantías</h4>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  MentorIA constituye una herramienta de apoyo educativo. Ferrer no garantiza resultados académicos específicos ni sustituye la intervención de profesionales docentes o psicopedagógicos.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  <strong>5.1 Responsabilidad por el uso de MentorIA:</strong> El Usuario es el único responsable de las infracciones en las que pueda incurrir o de los perjuicios que pueda causar por la utilización de MentorIA, quedando Ferrer exonerado de cualquier clase de responsabilidad que pudiera derivarse de las acciones del Usuario.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  Ferrer empleará todos los esfuerzos y medios razonables para facilitar información actualizada y fehaciente en MentorIA. No obstante, Ferrer no asume ninguna garantía con relación a la presencia de errores o posibles inexactitudes y/u omisiones en ninguno de los contenidos accesibles a través de MentorIA.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  El Usuario es el único responsable frente a cualquier reclamación o acción legal, judicial o extrajudicial, iniciada por terceras personas contra Ferrer basada en la utilización de MentorIA por el Usuario. En su caso, el Usuario asumirá cuantos gastos, costes e indemnizaciones sean irrogados a Ferrer con motivo de tales reclamaciones o acciones legales.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  <strong>5.2 Responsabilidad por el funcionamiento de MentorIA:</strong> Ferrer excluye toda responsabilidad que se pudiera derivar de interferencias, omisiones, interrupciones, virus informáticos, averías o desconexiones en el funcionamiento operativo del sistema electrónico.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  Asimismo, también se excluye cualquier responsabilidad que pudiera derivarse por retrasos o bloqueos en el funcionamiento operativo de este sistema electrónico causado por deficiencias o sobrecarga en las líneas telefónicas o en Internet, así como de daños causados por terceras personas mediante intromisiones ilegítimas fuera del control de Ferrer. Esta está facultada para suspender temporalmente, y sin previo aviso, la accesibilidad a MentorIA con motivo de operaciones de mantenimiento, reparación, actualización o mejora.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  <strong>5.3 Responsabilidad por contenido:</strong> Ferrer no se hará responsable, a no ser en aquellos extremos a los que obligue la ley, de los daños o perjuicios que se pudieran ocasionar por el uso, reproducción, distribución o comunicación pública o cualquier tipo de actividad que realice sobre los textos y/o fotografías que se encuentren protegidos por derechos de propiedad intelectual pertenecientes a terceros, sin que el Usuario haya obtenido previamente de sus titulares la autorización necesaria para llevar a cabo el uso que efectúa o pretende efectuar.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  Por otro lado, Ferrer no será responsable por la información enviada por el Usuario cuando no tenga conocimiento efectivo de que la información almacenada es ilícita o de que lesiona bienes o derechos de un tercero susceptibles de indemnización. En el momento que Ferrer tenga conocimiento efectivo de que aloja datos como los anteriormente referidos, se compromete a actuar con diligencia para retirarlos o impedir el acceso a los mismos.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 32, textAlign: "justify" }}>
                  En su caso, para interponer cualquier reclamación relacionada con los contenidos insertados en cualquiera de las secciones de MentorIA, puede hacerlo dirigiéndose a Ferrer a través de las direcciones de contacto indicadas en este texto.
                </p>

                <h4 style={{ color: "#84BD00", fontWeight: 700, fontSize: "20px", marginBottom: 16 }}>6. Propiedad Intelectual</h4>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  Todos los contenidos, algoritmos, modelos de IA, diseños y materiales del MentorIA, salvo que se indique lo contrario, son titularidad exclusiva de Ferrer y, con carácter enunciativo, que no limitativo, el diseño gráfico, código fuente, logos, textos, gráficos, ilustraciones, fotografías, y demás elementos que aparecen en MentorIA. Igualmente, todos los nombres comerciales, marcas o signos distintivos de cualquier clase contenidos en la están protegidos por la Ley.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  Ferrer no concede ningún tipo de licencia o autorización de uso personal al Usuario sobre sus derechos de propiedad intelectual e industrial o sobre cualquier otro derecho relacionado con su MentorIA y los servicios ofrecidos en la misma.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 32, textAlign: "justify" }}>
                  Por ello, el Usuario reconoce que la reproducción, distribución, comercialización, transformación, y en general, cualquier otra forma de explotación, por cualquier procedimiento, de todo o parte de los contenidos de esta constituye una infracción de los derechos de propiedad intelectual y/o industrial de Ferrer o del titular de los mismos.
                </p>

                <h4 style={{ color: "#84BD00", fontWeight: 700, fontSize: "20px", marginBottom: 16 }}>7. Enlaces de terceros</h4>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  <strong>a) Web enlazante:</strong> Los terceros que tengan la intención de incluir en su página web un enlace de la presente tendrán que cumplir con la legislación vigente y no podrán alojar contenidos que sean inapropiados y/o ilícitos. En ningún caso, Ferrer se hace responsable del contenido de la del tercero, ni promueve, garantiza, supervisa ni recomienda los contenidos de esta. En el caso de que el sitio web enlazante incumpla alguno de los aspectos anteriores estará obligado a suprimir el enlace de manera inmediata.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 32, textAlign: "justify" }}>
                  <strong>b) Web enlazada:</strong> En esta se pueden incluir enlaces de páginas web de terceros que permitan al Usuario acceder. No obstante lo anterior, Ferrer no se hace responsable del contenido de estas páginas web enlazadas, sino que será el Usuario el encargado de aceptar y comprobar los accesos cada vez que acceda. El presente Aviso Legal y Condiciones de Uso se refieren únicamente a esta y contenidos de Ferrer, y no se aplica a los enlaces o a las páginas webs de terceros accesibles a través de MentorIA. Tales enlaces o menciones tienen una finalidad que no implica el apoyo, la aprobación, comercialización o relación alguna entre FERRER y las personas o entidades titulares de los lugares donde se encuentren.
                </p>

                <h4 style={{ color: "#84BD00", fontWeight: 700, fontSize: "20px", marginBottom: 16 }}>8. Recomendaciones, contenidos automatizados e intervención humana</h4>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  MentorIA puede emplear sistemas automatizados (principalmente inteligencia artificial) para generar sugerencias, rutas formativas o contenidos.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  <strong>8.1. Revisión crítica y contraste.</strong> Las recomendaciones:
                </p>
                <ul style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 16, paddingLeft: 24, textAlign: "justify" }}>
                  <li style={{ marginBottom: 8 }}>dependen de la información aportada por el Usuario y del contexto educativo;</li>
                  <li style={{ marginBottom: 8 }}>pueden contener errores, omisiones o desactualización.</li>
                </ul>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  <strong>8.2.</strong> El Usuario (y, en su caso, el Profesional Docente) debe contrastar la información antes de adoptar decisiones relevantes (p. ej., elección de itinerarios, optativas, FP, Bachillerato, universidad, etc.). El Centro Educativo mantiene su rol de acompañamiento y decisión educativa conforme a sus procedimientos.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 32, textAlign: "justify" }}>
                  <strong>8.3.</strong> MentorIA no está destinada a diagnosticar condiciones de salud, trastornos, ni a emitir valoraciones clínicas.
                </p>

                <h4 style={{ color: "#84BD00", fontWeight: 700, fontSize: "20px", marginBottom: 16 }}>9. Transparencia algorítmica</h4>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  MentorIA utiliza el modelo Gemini 2.5 para la generación de contenidos educativos personalizados. El sistema opera bajo principios de supervisión humana, minimización de datos, evaluación continua de riesgos y diseño centrado en el menor.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  Los usuarios serán informados de que interactúan con un sistema de inteligencia artificial. Se implementan mecanismos de revisión humana cuando sea necesario y procedimientos para detectar sesgos, errores o contenidos inapropiados.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 32, textAlign: "justify" }}>
                  El sistema no realiza perfilado con efectos jurídicos ni toma decisiones automatizadas que produzcan efectos legales sobre el menor.
                </p>

                <h4 style={{ color: "#84BD00", fontWeight: 700, fontSize: "20px", marginBottom: 16 }}>10. Uso de chatbot</h4>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  MentorIA utiliza un chatbot basado en tecnología de Inteligencia Artificial con la finalidad de poder conversar con una versión futura del Usuario lo que podrá orientar sobre posibles dudas en relación con las diferentes opciones que te esté planteando MentorIA.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  Se recomienda no introducir datos personales en las conversaciones con el chatbot. En caso de que se traten datos personales, dicho tratamiento se realizará de conformidad con la normativa vigente en materia de protección de datos, y conforme a lo dispuesto en la Política de Privacidad.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 32, textAlign: "justify" }}>
                  Las respuestas proporcionadas por el chatbot son orientativas, no constituyen asesoramiento profesional y pueden estar sujetas a limitaciones propias de los sistemas automatizados.
                </p>

                <h4 style={{ color: "#84BD00", fontWeight: 700, fontSize: "20px", marginBottom: 16 }}>11. Protección de Datos Personales y seguridad de la información</h4>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  Ferrer no recopila ni gestiona datos personales de quienes utilizan MentorIA. Los Usuarios pueden acceder a MentorIA con un usuario y contraseña que será facilitado por el/la tutor/a. Esta cuenta de usuario se genera automáticamente y de forma alternativa por el sistema. Asimismo, tampoco se obtendrá información sobre la navegación a través de las cookies u otras tecnologías similares instaladas en la misma.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  MentorIA utiliza sistemas automatizados para personalizar contenidos. No se adoptan decisiones con efectos jurídicos o significativamente equivalentes exclusivamente basadas en tratamiento automatizado.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  Al utilizar el chatbot disponible en MentorIA, se ruega no proporcionar datos personales ni información que permita la identificación de las personas físicas a las que corresponde. En caso de que dicha información sea suministrada, será utilizada exclusivamente para responder a la consulta realizada y, posteriormente, eliminada de manera inmediata tras el contacto correspondiente.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  Ferrer procurará mantener MentorIA operativa y segura, pero no garantiza disponibilidad ininterrumpida ni ausencia total de errores. Ferrer podrá realizar mantenimientos, actualizaciones o cambios técnicos que afecten temporalmente al servicio. El Usuario no introducirá malware, archivos dañinos ni llevará a cabo acciones que comprometan la seguridad o disponibilidad de MentorIA.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 32, textAlign: "justify" }}>
                  Si tiene cualquier duda en relación con el posible tratamiento de sus datos personales, puedes contactar con nuestro delegado de protección de datos escribiendo a la dirección de correo electrónico <strong style={{ color: "#374151" }}>dpo@ferrer.com</strong>.
                </p>

                <h4 style={{ color: "#84BD00", fontWeight: 700, fontSize: "20px", marginBottom: 16 }}>12. Legislación y Jurisdicción</h4>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 12, textAlign: "justify" }}>
                  Las presentes Condiciones se rigen por la legislación española. Las controversias se someterán a los Juzgados y Tribunales competentes conforme a la normativa de consumidores y usuarios.
                </p>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, marginBottom: 0, textAlign: "justify" }}>
                  Ferrer se reserva el derecho de efectuar sin previo aviso las modificaciones que considere oportunas en MentorIA pudiendo cambiar, suprimir o añadir tanto los contenidos y servicios que se presten a través de la misma como la forma en la que éstos aparezcan presentados o localizados. Por ello, recomendamos que el Usuario acceda y las lea periódicamente.
                </p>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
