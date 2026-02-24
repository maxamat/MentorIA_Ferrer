import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

interface DashboardEjercicioItem {
  clase: string;
  asignatura: string;
  unidad: number;
  alumno_id: string;
  total_ejercicios: number;
  ejercicios_resueltos: number;
  nota_media: number | null;
}

interface DashboardTrabajoItem {
  clase: string;
  asignatura: string;
  unidad: number;
  alumno_id: string;
  total_trabajos: number;
  trabajos_resueltos: number;
  nota_media: number | null;
}

interface ComentarioItem {
  id: string;
  tipo: string; // "ejercicio" o "trabajo"
  timestamp: string;
  nota: string;
  comentarios_profesor: string;
  comentarios_alumno: string;
}

export default function DashboardProfesor() {
  const nav = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [profesorId, setProfesorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Función para formatear texto con ** en negrita y verde
  const formatearTexto = (texto: string) => {
    if (!texto) return texto;
    const partes = texto.split(/\*\*(.*?)\*\*/);
    return partes.map((parte, idx) => 
      idx % 2 === 1 ? (
        <span key={idx} style={{ fontWeight: 700, color: "#84BD00" }}>{parte}</span>
      ) : (
        parte
      )
    );
  };

  // Pestañas
  const [activeTab, setActiveTab] = useState<"ejercicios" | "trabajos">("ejercicios");

  // Datos
  const [ejercicios, setEjercicios] = useState<DashboardEjercicioItem[]>([]);
  const [trabajos, setTrabajos] = useState<DashboardTrabajoItem[]>([]);
  
  // Avatares de alumnos (mapa alumno_id -> url de avatar)
  const [avatares, setAvatares] = useState<{ [key: string]: string }>({});

  // Modal de comentarios
  const [modalAbierto, setModalAbierto] = useState(false);
  const [comentariosModal, setComentariosModal] = useState<ComentarioItem[]>([]);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<string>("");
  const [cargandoComentarios, setCargandoComentarios] = useState(false);
  
  // Recomendaciones
  const [recomendacionAlumno, setRecomendacionAlumno] = useState<string | null>(null);
  const [cargandoRecomendacion, setCargandoRecomendacion] = useState(false);
  const [showGeneratingModal, setShowGeneratingModal] = useState(false);
  
  // Tabs
  const [tabActiva, setTabActiva] = useState<"comentarios" | "recomendaciones">("comentarios");

  // Filtros
  const [claseSeleccionada, setClaseSeleccionada] = useState("");
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState("");
  const [unidadSeleccionada, setUnidadSeleccionada] = useState("");

  // Datos para filtros
  const [clases, setClases] = useState<string[]>([]);
  const [asignaturas, setAsignaturas] = useState<string[]>([]);
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
      setProfesorId(data.username);

      // Cargar clases
      fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_clases_profesores`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
        body: JSON.stringify({ centro_id: data.centro_id, profesor_id: data.username })
      })
        .then(r => r.json())
        .then(res => setClases(res.clases || []))
        .catch(() => setClases([]));

      setLoading(false);
    });
  }, [nav]);

  // Cuando se selecciona una clase, cargar asignaturas
  useEffect(() => {
    setAsignaturaSeleccionada("");
    setUnidadSeleccionada("");
    if (!claseSeleccionada || !centroId || !profesorId) {
      setAsignaturas([]);
      setUnidades([]);
      return;
    }
    fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_asignaturas_profesores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
      body: JSON.stringify({ centro_id: centroId, profesor_id: profesorId, clase: claseSeleccionada })
    })
      .then(r => r.json())
      .then(res => setAsignaturas(res.asignaturas || []))
      .catch(() => setAsignaturas([]));
  }, [claseSeleccionada, centroId, profesorId]);

  // Cuando se selecciona una asignatura, cargar unidades con status=true
  useEffect(() => {
    setUnidadSeleccionada("");
    if (!claseSeleccionada || !asignaturaSeleccionada || !centroId || !profesorId) {
      setUnidades([]);
      return;
    }
    fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_unidades_programaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
      body: JSON.stringify({ centro_id: centroId, profesor_id: profesorId, clase: claseSeleccionada, asignatura: asignaturaSeleccionada })
    })
      .then(r => r.json())
      .then(res => {
        // Filtrar solo unidades con status=true
        const unidadesValidadas = (res.unidades || []).filter((u: any) => u.status === true);
        setUnidades(unidadesValidadas);
      })
      .catch(() => setUnidades([]));
  }, [claseSeleccionada, asignaturaSeleccionada, centroId, profesorId]);

  // Cargar datos cuando se han seleccionado todos los filtros
  useEffect(() => {
    if (!claseSeleccionada || !asignaturaSeleccionada || !unidadSeleccionada || !centroId || !profesorId) {
      setEjercicios([]);
      setTrabajos([]);
      return;
    }

    const baseUrl = import.meta.env.VITE_BASEDATOS_BASE;
    const apiKey = import.meta.env.VITE_BASEDATOS_API_KEY;
    
    // Convertir unidad a número
    const unidadNumero = Number(unidadSeleccionada);
    
    console.log("📊 [DASHBOARD] Cargando datos con filtros:", {
      clase: claseSeleccionada,
      asignatura: asignaturaSeleccionada,
      unidad: unidadNumero
    });

    Promise.all([
      fetch(`${baseUrl}/listar_dashboard_ejercicios_profesor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ 
          centro_id: centroId, 
          profesor_id: profesorId,
          clase: claseSeleccionada,
          asignatura: asignaturaSeleccionada,
          unidad: unidadNumero
        })
      }),
      fetch(`${baseUrl}/listar_dashboard_trabajos_profesor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ 
          centro_id: centroId, 
          profesor_id: profesorId,
          clase: claseSeleccionada,
          asignatura: asignaturaSeleccionada,
          unidad: unidadNumero
        })
      })
    ]).then(([respEjercicios, respTrabajos]) => {
      if (respEjercicios.ok) {
        respEjercicios.json().then(dataE => {
          console.log("📊 [DASHBOARD] Ejercicios recibidos del backend:", dataE.ejercicios?.length || 0);
          console.log("📊 [DASHBOARD] Primeros ejercicios:", dataE.ejercicios?.slice(0, 3));
          setEjercicios(dataE.ejercicios || []);
          // Cargar avatares de los alumnos
          cargarAvatares(dataE.ejercicios || []);
        });
      }
      if (respTrabajos.ok) {
        respTrabajos.json().then(dataT => {
          console.log("📊 [DASHBOARD] Trabajos recibidos del backend:", dataT.trabajos?.length || 0);
          console.log("📊 [DASHBOARD] Primeros trabajos:", dataT.trabajos?.slice(0, 3));
          setTrabajos(dataT.trabajos || []);
          // Cargar avatares de los alumnos (si no están ya cargados)
          cargarAvatares(dataT.trabajos || []);
        });
      }
    }).catch(err => {
      console.error("Error cargando dashboard:", err);
    });
  }, [claseSeleccionada, asignaturaSeleccionada, unidadSeleccionada, centroId, profesorId]);

  // Función para cargar avatares de alumnos
  const cargarAvatares = async (items: (DashboardEjercicioItem | DashboardTrabajoItem)[]) => {
    const baseUrl = import.meta.env.VITE_BASEDATOS_BASE;
    const apiKey = import.meta.env.VITE_BASEDATOS_API_KEY;
    
    // Obtener IDs únicos de alumnos
    const alumnosIds = Array.from(new Set(items.map(item => item.alumno_id)));
    
    // Cargar avatar de cada alumno
    const nuevosAvatares: { [key: string]: string } = {};
    
    await Promise.all(
      alumnosIds.map(async (alumnoId) => {
        try {
          const response = await fetch(`${baseUrl}/listar_avatar_config`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify({ 
              centro_id: centroId, 
              alumno_id: alumnoId 
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.imagebase64) {
              nuevosAvatares[alumnoId] = data.imagebase64;
            }
          }
        } catch (err) {
          console.error(`Error cargando avatar de ${alumnoId}:`, err);
        }
      })
    );
    
    setAvatares(prev => ({ ...prev, ...nuevosAvatares }));
  };

  // Función para renderizar texto con formato **negrita** en verde
  const renderizarTextoConFormato = (texto: string) => {
    const partes = texto.split(/(\*\*.*?\*\*)/g);
    return partes.map((parte, index) => {
      if (parte.startsWith('**') && parte.endsWith('**')) {
        const contenido = parte.slice(2, -2);
        return <strong key={index} style={{ color: "#84BD00", fontWeight: 700 }}>{contenido}</strong>;
      }
      return <span key={index}>{parte}</span>;
    });
  };

  // Función para abrir el modal con comentarios del alumno
  const abrirModalComentarios = async (alumnoId: string) => {
    if (!centroId || !claseSeleccionada || !asignaturaSeleccionada || !unidadSeleccionada) {
      return;
    }

    setAlumnoSeleccionado(alumnoId);
    setModalAbierto(true);
    setTabActiva("comentarios"); // Siempre iniciar en la pestaña de comentarios
    setCargandoComentarios(true);
    setComentariosModal([]);

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_comentarios_alumno`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY 
        },
        body: JSON.stringify({ 
          centro_id: centroId, 
          clase: claseSeleccionada, 
          asignatura: asignaturaSeleccionada, 
          unidad: Number(unidadSeleccionada), 
          alumno_id: alumnoId 
        })
      });
      if (response.ok) {
        const data = await response.json();
        setComentariosModal(data.comentarios || []);
      }
    } catch (error) {
      console.error("Error cargando comentarios:", error);
    } finally {
      setCargandoComentarios(false);
    }
  };

  // Función para abrir el modal con recomendaciones del alumno
  const abrirModalRecomendaciones = async (alumnoId: string) => {
    if (!centroId || !claseSeleccionada || !asignaturaSeleccionada) {
      return;
    }

    setAlumnoSeleccionado(alumnoId);
    setModalAbierto(true);
    setTabActiva("recomendaciones"); // Iniciar en la pestaña de recomendaciones
    setCargandoRecomendacion(true);
    setRecomendacionAlumno(null);
    
    // Cargar recomendación
    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/obtener_recomendacion_alumno`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY 
        },
        body: JSON.stringify({
          centro_id: centroId,
          clase: claseSeleccionada,
          asignatura: asignaturaSeleccionada,
          alumno_id: alumnoId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRecomendacionAlumno(data.recomendacion);
      } else {
        console.error("Error al cargar recomendación");
      }
    } catch (err) {
      console.error("Error en la petición de recomendación:", err);
    } finally {
      setCargandoRecomendacion(false);
    }
  };

  // Filtrar datos según selección
  // Aunque el backend debería devolver datos filtrados, aplicamos filtro adicional por seguridad
  const datosFiltrados = React.useMemo(() => {
    const datos = activeTab === "ejercicios" ? ejercicios : trabajos;
    
    if (!claseSeleccionada || !asignaturaSeleccionada || !unidadSeleccionada) {
      return datos;
    }
    
    const unidadNumero = Number(unidadSeleccionada);
    
    const filtrados = datos.filter(item => 
      item.clase === claseSeleccionada && 
      item.asignatura === asignaturaSeleccionada && 
      item.unidad === unidadNumero
    );
    
    console.log("📊 [DASHBOARD] Datos filtrados en frontend:", {
      total: datos.length,
      filtrados: filtrados.length,
      filtros: { clase: claseSeleccionada, asignatura: asignaturaSeleccionada, unidad: unidadNumero }
    });
    
    return filtrados;
  }, [activeTab, ejercicios, trabajos, claseSeleccionada, asignaturaSeleccionada, unidadSeleccionada]);

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
            {userRole !== "profesor" && (
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
            <button onClick={() => nav("/programacion")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-calendar-days" style={{ fontSize: "16px" }}></i>Programación</button>
            <button onClick={() => nav("/secciones")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-list-check" style={{ fontSize: "16px" }}></i>Secciones</button>
            <button onClick={() => nav("/contenido-formativo")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-book-open" style={{ fontSize: "16px" }}></i>Contenido Formativo</button>
            <button onClick={() => nav("/dashboard-profesor")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "rgba(146, 208, 80, 0.1)", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }}><i className="fa-solid fa-chart-line" style={{ fontSize: "16px" }}></i>Dashboard</button>
            <button onClick={() => nav("/terminos-condiciones")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-file-contract" style={{ fontSize: "16px" }}></i>Términos legales</button>
          </div>
          <div style={{ padding: "0 16px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            <button onClick={() => { localStorage.removeItem("jwt"); nav("/"); }} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#ef4444", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-right-from-bracket" style={{ fontSize: "16px" }}></i>Cerrar sesión</button>
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
                <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando dashboard...</div>
                <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
              </div>
            </div>
          ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%", overflow: "hidden" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#84BD00", fontWeight: 700, fontSize: "32px" }}>Dashboard</h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
              Visualiza el progreso de tus alumnos en <span style={{ fontWeight: 700, color: "#92D050" }}>ejercicios</span> y <span style={{ fontWeight: 700, color: "#92D050" }}>trabajos</span>. Selecciona <span style={{ fontWeight: 700, color: "#92D050" }}>clase</span>, <span style={{ fontWeight: 700, color: "#92D050" }}>asignatura</span> y <span style={{ fontWeight: 700, color: "#92D050" }}>unidad</span> para obtener información detallada.
            </p>

            {/* Filtros */}
            <div style={{ display: "flex", gap: 16, marginBottom: 24, padding: 20, background: "white", border: "1px solid #e5e7eb", borderRadius: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Clase:</div>
                <select 
                  value={claseSeleccionada} 
                  onChange={e => setClaseSeleccionada(e.target.value)} 
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}
                >
                  <option value="">Selecciona una clase</option>
                  {clases.map(clase => (
                    <option key={clase} value={clase}>{clase}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Asignatura:</div>
                <select 
                  value={asignaturaSeleccionada} 
                  onChange={e => setAsignaturaSeleccionada(e.target.value)} 
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, outline: "none", opacity: claseSeleccionada ? 1 : 0.5, cursor: claseSeleccionada ? "pointer" : "not-allowed" }}
                  disabled={!claseSeleccionada}
                >
                  <option value="">Selecciona una asignatura</option>
                  {asignaturas.map(asignatura => (
                    <option key={asignatura} value={asignatura}>{asignatura}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Unidad:</div>
                <select 
                  value={unidadSeleccionada} 
                  onChange={e => setUnidadSeleccionada(e.target.value)} 
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, outline: "none", opacity: asignaturaSeleccionada ? 1 : 0.5, cursor: asignaturaSeleccionada ? "pointer" : "not-allowed" }}
                  disabled={!asignaturaSeleccionada}
                >
                  <option value="">Selecciona una unidad</option>
                  {unidades.map(unidad => (
                    <option key={unidad.unidad} value={unidad.unidad}>{unidad.titulo}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pestañas */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
              <button
                onClick={() => setActiveTab("ejercicios")}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  border: "none",
                  background: activeTab === "ejercicios" ? "white" : "transparent",
                  color: activeTab === "ejercicios" ? "#92D050" : "#6b7280",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  borderRadius: "8px 8px 0 0",
                  borderBottom: activeTab === "ejercicios" ? "3px solid #92D050" : "none",
                  transition: "all 0.2s"
                }}
              >
                <i className="fa-solid fa-pencil" style={{ marginRight: 8 }}></i>
                Ejercicios
              </button>
              <button
                onClick={() => setActiveTab("trabajos")}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  border: "none",
                  background: activeTab === "trabajos" ? "white" : "transparent",
                  color: activeTab === "trabajos" ? "#92D050" : "#6b7280",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  borderRadius: "8px 8px 0 0",
                  borderBottom: activeTab === "trabajos" ? "3px solid #92D050" : "none",
                  transition: "all 0.2s"
                }}
              >
                <i className="fa-solid fa-briefcase" style={{ marginRight: 8 }}></i>
                Trabajos
              </button>
            </div>

            {/* Contenido de la pestaña activa */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <div style={{ padding: 24, background: "white", border: "1px solid #e5e7eb", borderRadius: 16, flex: 1, overflow: "auto", minHeight: 0 }}>
                {!claseSeleccionada || !asignaturaSeleccionada || !unidadSeleccionada ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 300, flexDirection: "column" }}>
                    <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                      <i className="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <p style={{ fontSize: 16, color: "#9ca3af", margin: 0, textAlign: "center" }}>
                      Selecciona una <span style={{ fontWeight: 700, color: "#92D050" }}>clase</span>, <span style={{ fontWeight: 700, color: "#92D050" }}>asignatura</span> y <span style={{ fontWeight: 700, color: "#92D050" }}>unidad</span> para visualizar los datos
                    </p>
                  </div>
                ) : datosFiltrados.length === 0 ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 300, flexDirection: "column" }}>
                    <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                      <i className="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <p style={{ fontSize: 16, color: "#9ca3af", margin: 0 }}>
                      No hay datos disponibles para los filtros seleccionados
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {datosFiltrados.map((item, index) => {
                      const total = activeTab === "ejercicios" 
                        ? (item as DashboardEjercicioItem).total_ejercicios 
                        : (item as DashboardTrabajoItem).total_trabajos;
                      const resueltos = activeTab === "ejercicios" 
                        ? (item as DashboardEjercicioItem).ejercicios_resueltos 
                        : (item as DashboardTrabajoItem).trabajos_resueltos;
                      const porcentaje = total > 0 ? Math.round((resueltos / total) * 100) : 0;
                      
                      // Determinar color de la nota
                      let colorNota = "#6b7280"; // Color por defecto (gris) para N/A
                      if (item.nota_media !== null) {
                        if (item.nota_media < 2.5) {
                          colorNota = "#dc2626"; // Rojo
                        } else if (item.nota_media < 5) {
                          colorNota = "#ea580c"; // Naranja
                        } else if (item.nota_media < 7.5) {
                          colorNota = "#84BD00"; // Verde
                        } else {
                          colorNota = "#15803d"; // Verde oscuro
                        }
                      }
                      
                      return (
                        <div 
                          key={index} 
                          style={{ 
                            padding: "16px 20px", 
                            background: "#F9FAFB", 
                            border: "1px solid #e5e7eb", 
                            borderRadius: 12,
                            transition: "all 0.2s",
                            display: "flex",
                            alignItems: "center",
                            gap: 16
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
                          {/* Avatar */}
                          <div style={{ 
                            minWidth: 56, 
                            height: 56, 
                            borderRadius: "50%",
                            overflow: "hidden",
                            border: "2px solid #92D050",
                            flexShrink: 0,
                            marginRight: -8,
                            marginLeft: -8
                          }}>
                            <img 
                              src={avatares[item.alumno_id] || "/avatar.png"} 
                              alt={`Avatar de ${item.alumno_id}`}
                              style={{ 
                                width: "100%", 
                                height: "100%", 
                                objectFit: "cover" 
                              }}
                            />
                          </div>
                          
                          {/* Nombre */}
                          <div style={{ flex: "1 1 0", minWidth: 150, fontWeight: 600, color: "#111827", fontSize: 15 }}>
                            {item.alumno_id}
                          </div>
                          
                          {/* Completados */}
                          <div style={{ flex: "2 1 0", minWidth: 250, fontSize: 14, color: "#6b7280" }}>
                            <span style={{ color: "#6b7280" }}>
                              {activeTab === "ejercicios" ? "Ejercicios completados: " : "Trabajos completados: "}
                            </span>
                            <span style={{ fontWeight: 600, color: "#111827" }}>{resueltos}</span>
                            <span style={{ color: "#6b7280" }}> de </span>
                            <span style={{ fontWeight: 600, color: "#111827" }}>{total}</span>
                          </div>
                          
                          {/* Nota Media */}
                          <div style={{ flex: "1 1 0", minWidth: 100, fontSize: 14, color: "#6b7280" }}>
                            <span style={{ color: "#6b7280" }}>Nota: </span>
                            <span style={{ fontWeight: 600, color: colorNota }}>
                              {item.nota_media !== null ? item.nota_media.toFixed(2) : "N/A"}
                            </span>
                          </div>
                          
                          {/* Botones de Comentarios y Recomendaciones */}
                          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                            {/* Botón de Comentarios */}
                            <button
                              onClick={() => abrirModalComentarios(item.alumno_id)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                border: "2px solid #92D050",
                                background: "white",
                                color: "#92D050",
                                fontSize: 14,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s",
                                flexShrink: 0
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = "#92D050";
                                e.currentTarget.style.color = "white";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = "white";
                                e.currentTarget.style.color = "#92D050";
                              }}
                              title="Ver comentarios"
                            >
                              <i className="fa-solid fa-comments"></i>
                            </button>
                            
                            {/* Botón de Recomendaciones */}
                            <button
                              onClick={() => abrirModalRecomendaciones(item.alumno_id)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                border: "2px solid #92D050",
                                background: "white",
                                color: "#92D050",
                                fontSize: 14,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s",
                                flexShrink: 0
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = "#92D050";
                                e.currentTarget.style.color = "white";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = "white";
                                e.currentTarget.style.color = "#92D050";
                              }}
                              title="Ver recomendaciones"
                            >
                              <i className="fa-solid fa-lightbulb"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
          )}
        </div>
      </div>

      {/* Modal de comentarios */}
      {modalAbierto && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20
          }}
          onClick={() => setModalAbierto(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 32,
              maxWidth: 900,
              width: "100%",
              height: "80vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Contenido del modal */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Tab de Comentarios */}
              {tabActiva === "comentarios" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Título */}
                <h2 style={{ fontSize: 24, fontWeight: 700, color: "#84BD00", marginBottom: 20, marginTop: 0 }}>
                  Comentarios:
                </h2>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {cargandoComentarios ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: "300px" }}>
                      <div style={{ textAlign: "center", color: "#6b7280" }}>
                        <div style={{ fontSize: "48px", marginBottom: 16, color: "#84BD00" }}>
                          <i className="fa-solid fa-spinner fa-spin"></i>
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando comentarios...</div>
                        <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
                      </div>
                    </div>
                  ) : comentariosModal.filter(c => c.tipo === (activeTab === "ejercicios" ? "ejercicio" : "trabajo")).length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
                      <i className="fa-solid fa-comment-slash" style={{ fontSize: 48, marginBottom: 16 }}></i>
                      <p style={{ fontSize: 16, fontWeight: 500 }}>No hay comentarios para este alumno</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {comentariosModal.filter(c => c.tipo === (activeTab === "ejercicios" ? "ejercicio" : "trabajo")).map((comentario, idx) => {
                    // Ajustar la fecha a la zona horaria de España (UTC+1)
                    const fecha = new Date(comentario.timestamp);
                    fecha.setHours(fecha.getHours() + 1);
                    const fechaFormateada = fecha.toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    });
                    const horaFormateada = fecha.toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit"
                    });

                    return (
                      <div
                        key={idx}
                        style={{
                          background: "#f9fafb",
                          borderRadius: 12,
                          padding: 20,
                          border: "1px solid #e5e7eb"
                        }}
                      >
                        {/* Header del comentario */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                          <div
                            style={{
                              background: "#84BD00",
                              color: "white",
                              padding: "4px 12px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 600
                            }}
                          >
                            {comentario.tipo === "ejercicio" ? "Ejercicio" : "Trabajo"} #{comentario.id}
                          </div>
                          <div style={{ fontSize: 13, color: "#6b7280" }}>
                            <i className="fa-regular fa-calendar" style={{ marginRight: 6 }}></i>
                            {fechaFormateada} - {horaFormateada}
                          </div>
                          <div
                            style={{
                              marginLeft: "auto",
                              background: "#84BD00",
                              color: "white",
                              padding: "4px 12px",
                              borderRadius: 8,
                              fontSize: 14,
                              fontWeight: 700
                            }}
                          >
                            Nota: {comentario.nota}
                          </div>
                        </div>

                        {/* Comentarios del profesor */}
                        <div>
                          <div style={{ fontSize: 14, color: "#111827", lineHeight: 1.6, textAlign: "justify" }}>
                            {formatearTexto(comentario.comentarios_profesor) || "Sin comentarios"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
                </div>
              </div>
            )}

            {/* Tab de Recomendaciones */}
            {tabActiva === "recomendaciones" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Título */}
                <h2 style={{ fontSize: 24, fontWeight: 700, color: "#84BD00", marginBottom: 20, marginTop: 0 }}>
                  Recomendaciones:
                </h2>
                
                {cargandoRecomendacion ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
                    <div style={{ textAlign: "center", color: "#6b7280" }}>
                      <div style={{ fontSize: "48px", marginBottom: 16, color: "#84BD00" }}>
                        <i className="fa-solid fa-spinner fa-spin"></i>
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando recomendación...</div>
                      <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
                    </div>
                  </div>
                ) : recomendacionAlumno ? (
                  <div 
                    style={{ 
                      flex: 1, 
                      background: "#f0f9e8",
                      borderRadius: 12,
                      padding: 20,
                      overflowY: "auto"
                    }}
                  >
                    <div style={{ fontSize: 15, lineHeight: 1.6, color: "#374151", whiteSpace: "pre-wrap", textAlign: "justify" }}>
                      {renderizarTextoConFormato(recomendacionAlumno)}
                    </div>
                  </div>
                ) : (
                  <div 
                    style={{ 
                      flex: 1, 
                      background: "#f0f9e8",
                      borderRadius: 12,
                      padding: 20,
                      overflowY: "auto",
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      textAlign: "center",
                      color: "#6b7280",
                      fontSize: 15
                    }}
                  >
                    <div>
                      <i className="fa-solid fa-lightbulb" style={{ fontSize: 48, marginBottom: 16, color: "#84BD00" }}></i>
                      <p>No hay recomendaciones disponibles para este alumno</p>
                    </div>
                  </div>
                )}
                
                {/* Botón para generar recomendaciones */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <button
                    onClick={() => {
                      if (!centroId || !claseSeleccionada || !asignaturaSeleccionada || !alumnoSeleccionado) {
                        alert("Faltan datos para generar recomendaciones");
                        return;
                      }
                      
                      // Mostrar modal de confirmación
                      setShowGeneratingModal(true);
                      
                      // Ejecutar la generación de recomendación
                      (async () => {
                        try {
                          setCargandoRecomendacion(true);
                          const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/generar_recomendacion_alumno`, {
                            method: "POST",
                            headers: { 
                              "Content-Type": "application/json", 
                              "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY 
                            },
                            body: JSON.stringify({
                              centro_id: centroId,
                              clase: claseSeleccionada,
                              asignatura: asignaturaSeleccionada,
                              alumno_id: alumnoSeleccionado
                            })
                          });

                          if (response.ok) {
                            const data = await response.json();
                            
                            // Recargar la recomendación después de generarla
                            const recomResponse = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/obtener_recomendacion_alumno`, {
                              method: "POST",
                              headers: { 
                                "Content-Type": "application/json", 
                                "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY 
                              },
                              body: JSON.stringify({
                                centro_id: centroId,
                                clase: claseSeleccionada,
                                asignatura: asignaturaSeleccionada,
                                alumno_id: alumnoSeleccionado
                              })
                            });
                            
                            if (recomResponse.ok) {
                              const recomData = await recomResponse.json();
                              setRecomendacionAlumno(recomData.recomendacion);
                            }
                          } else {
                            alert("Error al generar recomendación");
                          }
                        } catch (err) {
                          console.error("Error:", err);
                          alert("Error al generar recomendación");
                        } finally {
                          setCargandoRecomendacion(false);
                        }
                      })();
                    }}
                    style={{
                      padding: "12px 24px",
                      background: "#84BD00",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      width: "auto"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#6da300"}
                    onMouseLeave={e => e.currentTarget.style.background = "#84BD00"}
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    Generar Recomendación
                  </button>
                </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de generación de recomendación */}
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
            zIndex: 1001,
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
    </div>
  );
}
