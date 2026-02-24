import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

export default function Programacion() {
  const nav = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [profesorId, setProfesorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Paneles desplegables
  const [selectedClase, setSelectedClase] = useState("");
  const [selectedAsignatura, setSelectedAsignatura] = useState("");
  const [selectedUnidad, setSelectedUnidad] = useState("");
  const [consideraciones, setConsideraciones] = useState("");

  // Datos para los desplegables (unificados para todas las pestañas)
  const [clases, setClases] = useState<string[]>([]);
  const [asignaturas, setAsignaturas] = useState<string[]>([]);

  // Curriculums
  const [curriculums, setCurriculums] = useState<any[]>([]);
  const [showCurriculumPopup, setShowCurriculumPopup] = useState(false);
  const [selectedCurriculums, setSelectedCurriculums] = useState<string[]>([]);

  // Pestañas
  const [activeTab, setActiveTab] = useState<"generar" | "editar" | "validar">("generar");

  // Datos de las pestañas
  const [editarUnidades, setEditarUnidades] = useState<any[]>([]);
  const [validarProgramaciones, setValidarProgramaciones] = useState<any[]>([]);

  // Para la edición de unidades
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
  const [editingUnit, setEditingUnit] = useState<any | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editContenido, setEditContenido] = useState("");


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

      // Cargar clases (listar_clases_profesores) para todas las pestañas
      fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_clases_profesores`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
        body: JSON.stringify({ centro_id: data.centro_id, profesor_id: data.username })
      })
        .then(r => r.json())
        .then(res => setClases(res.clases || []))
        .catch(() => setClases([]));

      // Cargar curriculums
      fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_curriculums`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
        body: JSON.stringify({ centro_id: data.centro_id })
      })
        .then(r => r.json())
        .then(res => setCurriculums(res.curriculums || []))
        .catch(() => setCurriculums([]));

      setLoading(false);
    });
  }, [nav]);

  // Opciones de unidades didácticas (1-20)
  const opcionesUnidades = Array.from({ length: 20 }, (_, i) => (i + 1).toString());

  // Cuando se selecciona una clase, cargar asignaturas y resetear selección de asignatura
  useEffect(() => {
    setSelectedAsignatura(""); // Reset asignatura al cambiar clase
    if (!selectedClase || !centroId || !profesorId) {
      setAsignaturas([]);
      return;
    }
    fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_asignaturas_profesores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
      body: JSON.stringify({ centro_id: centroId, profesor_id: profesorId, clase: selectedClase })
    })
      .then(r => r.json())
      .then(res => setAsignaturas(res.asignaturas || []))
      .catch(() => setAsignaturas([]));
  }, [selectedClase, centroId, profesorId]);

  // Cargar unidades para Editar cuando se seleccionan clase y asignatura
  useEffect(() => {
    if (activeTab !== "editar" || !selectedClase || !selectedAsignatura || !centroId || !profesorId) {
      setEditarUnidades([]);
      return;
    }
    fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_unidades_programaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
      body: JSON.stringify({ centro_id: centroId, profesor_id: profesorId, clase: selectedClase, asignatura: selectedAsignatura })
    })
      .then(r => r.json())
      .then(res => setEditarUnidades(res.unidades || []))
      .catch(() => setEditarUnidades([]));
  }, [activeTab, selectedClase, selectedAsignatura, centroId, profesorId]);

  // Cargar programaciones para Validar cuando se seleccionan clase y asignatura
  useEffect(() => {
    if (activeTab !== "validar" || !selectedClase || !selectedAsignatura || !centroId || !profesorId) {
      setValidarProgramaciones([]);
      return;
    }
    fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_programaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
      body: JSON.stringify({ centro_id: centroId, profesor_id: profesorId })
    })
      .then(r => r.json())
      .then(res => {
        // Filtrar por clase y asignatura
        const filtered = (res.programaciones || []).filter((p: any) => 
          p.clase === selectedClase && p.asignatura === selectedAsignatura
        );
        setValidarProgramaciones(filtered);
      })
      .catch(() => setValidarProgramaciones([]));
  }, [activeTab, selectedClase, selectedAsignatura, centroId, profesorId]);

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
            <button onClick={() => nav("/programacion")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "rgba(146, 208, 80, 0.1)", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }}><i className="fa-solid fa-calendar-days" style={{ fontSize: "16px" }}></i>Programación</button>
            <button onClick={() => nav("/secciones")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-list-check" style={{ fontSize: "16px" }}></i>Secciones</button>
            <button onClick={() => nav("/contenido-formativo")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-book-open" style={{ fontSize: "16px" }}></i>Contenido Formativo</button>
            <button onClick={() => nav("/dashboard-profesor")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(146, 208, 80, 0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><i className="fa-solid fa-chart-line" style={{ fontSize: "16px" }}></i>Dashboard</button>
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
                <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando programación...</div>
                <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
              </div>
            </div>
          ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%", overflow: "hidden" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#84BD00", fontWeight: 700, fontSize: "32px" }}>Programación</h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
              Gestiona las programaciones didácticas de tus asignaturas. Puedes <span style={{ fontWeight: 700, color: "#92D050" }}>generar nuevas programaciones</span> con IA en base a los currículums oficiales, <span style={{ fontWeight: 700, color: "#92D050" }}>editar unidades existentes</span> para personalizarlas según tus necesidades, y <span style={{ fontWeight: 700, color: "#92D050" }}>validar su coherencia</span> con los objetivos formativos establecidos.
            </p>

            {/* Filtros comunes para todas las pestañas */}
            <div style={{ display: "flex", gap: 16, marginBottom: 24, padding: 20, background: "white", border: "1px solid #e5e7eb", borderRadius: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Clase:</div>
                <select 
                  value={selectedClase} 
                  onChange={e => setSelectedClase(e.target.value)} 
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
                  value={selectedAsignatura} 
                  onChange={e => setSelectedAsignatura(e.target.value)} 
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}
                  disabled={!selectedClase}
                >
                  <option value="">Selecciona una asignatura</option>
                  {asignaturas.map(asignatura => (
                    <option key={asignatura} value={asignatura}>{asignatura}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pestañas */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
              <button
                onClick={() => setActiveTab("generar")}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  border: "none",
                  background: activeTab === "generar" ? "white" : "transparent",
                  color: activeTab === "generar" ? "#92D050" : "#6b7280",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  borderRadius: "8px 8px 0 0",
                  borderBottom: activeTab === "generar" ? "3px solid #92D050" : "none",
                  transition: "all 0.2s"
                }}
              >
                <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 8 }}></i>
                Generar Programación
              </button>
              <button
                onClick={() => setActiveTab("editar")}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  border: "none",
                  background: activeTab === "editar" ? "white" : "transparent",
                  color: activeTab === "editar" ? "#92D050" : "#6b7280",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  borderRadius: "8px 8px 0 0",
                  borderBottom: activeTab === "editar" ? "3px solid #92D050" : "none",
                  transition: "all 0.2s"
                }}
              >
                <i className="fa-solid fa-pen-to-square" style={{ marginRight: 8 }}></i>
                Editar Programación
              </button>
            </div>

            {/* Contenido de la pestaña activa */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            {activeTab === "generar" ? (
              <>
                {/* Panel de generación */}
                <div style={{ padding: 24, background: "white", border: "1px solid #e5e7eb", borderRadius: 16, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Num. Unidades:</div>
                      <select value={selectedUnidad} onChange={e => setSelectedUnidad(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}>
                        <option value="">Num. Unidades</option>
                        {opcionesUnidades.map(unidad => (
                          <option key={unidad} value={unidad}>{unidad}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      style={{ 
                        padding: "12px 24px", 
                        borderRadius: 10, 
                        border: "2px solid #92D050", 
                        background: "white", 
                        color: "#92D050", 
                        fontWeight: 600, 
                        cursor: "pointer", 
                        whiteSpace: "nowrap", 
                        transition: "all 0.2s",
                        fontSize: 14,
                        marginTop: 18
                      }}
                      onClick={() => setShowCurriculumPopup(true)}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "#92D050";
                        e.currentTarget.style.color = "white";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "white";
                        e.currentTarget.style.color = "#92D050";
                      }}
                    >
                      <i className="fa-solid fa-file-pdf" style={{ marginRight: 8 }}></i>
                      Seleccionar Curriculums ({selectedCurriculums.length})
                    </button>
                  </div>
              
                  {/* Campo de texto para consideraciones adicionales */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Consideraciones adicionales:</div>
                    <textarea 
                      value={consideraciones} 
                      onChange={e => setConsideraciones(e.target.value)}
                      placeholder="Añade aquí cualquier consideración adicional para la generación de la programación..."
                      style={{ 
                        width: "100%", 
                        padding: "12px", 
                        borderRadius: 8, 
                        border: "1px solid #e5e7eb", 
                        fontSize: 14, 
                        outline: "none",
                        resize: "none",
                        fontFamily: "system-ui",
                        flex: 1,
                        minHeight: 0
                      }}
                    />
                  </div>

                  {/* Botón Generar en la parte inferior derecha */}
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                    <button
                      style={{ 
                        padding: "12px 24px", 
                        borderRadius: 10, 
                        border: "none", 
                        background: selectedClase && selectedAsignatura && selectedUnidad && selectedCurriculums.length > 0 ? "#92D050" : "#d1d5db", 
                        color: "white", 
                        fontWeight: 600, 
                        cursor: selectedClase && selectedAsignatura && selectedUnidad && selectedCurriculums.length > 0 ? "pointer" : "not-allowed", 
                        fontSize: 14,
                        transition: "all 0.2s",
                        whiteSpace: "nowrap"
                      }}
                      disabled={!selectedClase || !selectedAsignatura || !selectedUnidad || selectedCurriculums.length === 0}
                      onClick={async () => {
                        if (!selectedClase || !selectedAsignatura || !selectedUnidad || !centroId || !profesorId) {
                          alert("Por favor selecciona clase, asignatura y número de unidades");
                          return;
                        }
                        
                        if (selectedCurriculums.length === 0) {
                          alert("Por favor selecciona al menos un curriculum formativo");
                          return;
                        }
                        
                        try {
                          const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/generar_programacion`, {
                            method: "POST",
                            headers: { 
                              "Content-Type": "application/json", 
                              "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY 
                            },
                            body: JSON.stringify({ 
                              centro_id: centroId,
                              clase: selectedClase,
                              asignatura: selectedAsignatura,
                              num_unidades: parseInt(selectedUnidad),
                              curriculums: selectedCurriculums,
                              consideraciones_adicionales: consideraciones
                            })
                          });
                          
                          if (response.ok) {
                            // Mostrar diálogo modal informativo
                            const dialog = document.createElement('div');
                            dialog.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:system-ui;cursor:pointer';
                            dialog.onclick = (e) => {
                              if (e.target === dialog) dialog.remove();
                            };
                            dialog.innerHTML = `
                              <div style="background:white;padding:32px;border-radius:12px;max-width:500px;box-shadow:0 4px 20px rgba(0,0,0,0.15);cursor:default" onclick="event.stopPropagation()">
                                <h3 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#92D050;font-family:system-ui">Generando Programación</h3>
                                <p style="margin:0;color:#6b7280;line-height:1.6;font-size:14px;font-family:system-ui">
                                  El tiempo estimado para la generación de la programación solicitada puede oscilar entre <strong style="color:#92D050">1-10 minutos</strong> dependiendo del número de unidades.
                                </p>
                              </div>
                            `;
                            document.body.appendChild(dialog);
                          } else {
                            alert("Error al generar la programación. Por favor, inténtalo de nuevo.");
                          }
                        } catch (error) {
                          console.error("Error:", error);
                          alert("Error al conectar con el servidor.");
                        }
                      }}
                    >
                      <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 8 }}></i>
                      Generar Programación
                    </button>
                  </div>
                </div>
              </>
            ) : activeTab === "editar" ? (
              <>
                {/* Panel de listado de unidades para Editar */}
                <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, background: "white", padding: 32, flex: 1, overflow: "auto", minHeight: 0 }}>
                  {!selectedClase || !selectedAsignatura ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 300, flexDirection: "column" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                        <i className="fa-solid fa-triangle-exclamation"></i>
                      </div>
                      <p style={{ fontSize: 16, color: "#9ca3af", margin: 0, textAlign: "center" }}>
                        Selecciona una <span style={{ fontWeight: 700, color: "#92D050" }}>clase</span> y <span style={{ fontWeight: 700, color: "#92D050" }}>asignatura</span> para editar la programación
                      </p>
                    </div>
                  ) : editarUnidades.length === 0 ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 300, flexDirection: "column" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                        <i className="fa-solid fa-triangle-exclamation"></i>
                      </div>
                      <p style={{ fontSize: 16, color: "#9ca3af", margin: 0 }}>No hay unidades disponibles</p>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 16 }}>
                      {editarUnidades.map((unidad, index) => {
                        return (
                        <div 
                          key={index} 
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
                          <div 
                            style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, marginRight: 20 }}
                            onClick={() => {
                              // Abrir popup de edición
                              setEditingUnit(unidad);
                              setEditTitulo(unidad.titulo);
                              setEditContenido(unidad.contenido);
                            }}
                          >
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
                                {unidad.titulo}
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
                          
                          {/* Checkbox para validar */}
                          {!unidad.status && (
                            <div 
                              onClick={async (e) => {
                                e.stopPropagation();
                                const jwt = localStorage.getItem("jwt");
                                try {
                                  const response = await fetch("https://odiseia-gw-basedatos-baej0f92.ew.gateway.dev/validar_unidad_programacion", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
                                    body: JSON.stringify({
                                      centro_id: centroId,
                                      profesor_id: profesorId,
                                      clase: selectedClase,
                                      asignatura: selectedAsignatura,
                                      unidad: unidad.unidad
                                    })
                                  });
                                  if (response.ok) {
                                    // Actualizar localmente
                                    setEditarUnidades(prev => prev.map(u => 
                                      u.unidad === unidad.unidad
                                        ? { ...u, status: true }
                                        : u
                                    ));
                                  }
                                } catch (error) {
                                  console.error("Error al validar:", error);
                                }
                              }}
                              style={{ 
                                minWidth: 27,
                                height: 27,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                border: "2px solid #92D050",
                                borderRadius: 8,
                                transition: "all 0.2s",
                                backgroundColor: "white"
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.backgroundColor = "#92D050";
                                const icon = e.currentTarget.querySelector("i");
                                if (icon) icon.style.color = "white";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = "white";
                                const icon = e.currentTarget.querySelector("i");
                                if (icon) icon.style.color = "#92D050";
                              }}
                            >
                              <i className="fa-solid fa-check" style={{ fontSize: 14, color: "#92D050", transition: "color 0.2s" }}></i>
                            </div>
                          )}
                          
                          {/* Mostrar check verde si ya está validado */}
                          {unidad.status && (
                            <div style={{ 
                              minWidth: 27,
                              height: 27,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "#92D050",
                              borderRadius: 8
                            }}>
                              <i className="fa-solid fa-check" style={{ fontSize: 14, color: "white" }}></i>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Panel de listado de programaciones para Validar */}
                <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, background: "white", padding: 32, minHeight: 500 }}>
                  {!selectedClase || !selectedAsignatura ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 300, flexDirection: "column" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                        <i className="fa-solid fa-triangle-exclamation"></i>
                      </div>
                      <p style={{ fontSize: 16, color: "#9ca3af", margin: 0, textAlign: "center" }}>
                        Selecciona una <span style={{ fontWeight: 700, color: "#92D050" }}>clase</span> y <span style={{ fontWeight: 700, color: "#92D050" }}>asignatura</span> para validar las programaciones
                      </p>
                    </div>
                  ) : validarProgramaciones.length === 0 ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 400, flexDirection: "column" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                        <i className="fa-solid fa-triangle-exclamation"></i>
                      </div>
                      <p style={{ fontSize: 16, color: "#9ca3af", margin: 0 }}>No hay programaciones disponibles</p>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 16, maxHeight: "600px", overflowY: "auto" }}>
                      <h4 style={{ margin: "0 0 16px 0", color: "#111827", fontSize: 20, fontWeight: 700, borderBottom: "2px solid #92D050", paddingBottom: 12 }}>
                        Programaciones Generadas
                      </h4>
                      {validarProgramaciones.map((prog, index) => (
                        <div 
                          key={index} 
                          style={{ 
                            padding: 20, 
                            background: "#F9FAFB", 
                            border: "1px solid #e5e7eb", 
                            borderRadius: 12,
                            transition: "all 0.2s"
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
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                            <div style={{ flex: 1 }}>
                              <h5 style={{ margin: "0 0 8px 0", color: "#111827", fontSize: 18, fontWeight: 700 }}>
                                {prog.clase} - {prog.asignatura}
                              </h5>
                              <div style={{ display: "flex", gap: 16, fontSize: 14, color: "#6b7280", marginTop: 8 }}>
                                <div>
                                  <i className="fa-solid fa-book" style={{ marginRight: 6 }}></i>
                                  {prog.unidades} {prog.unidades === 1 ? 'unidad' : 'unidades'}
                                </div>
                                <div>
                                  <i className="fa-solid fa-file-pdf" style={{ marginRight: 6 }}></i>
                                  {prog.curriculums}
                                </div>
                              </div>
                            </div>
                            <button
                              style={{
                                padding: "8px 16px",
                                borderRadius: 8,
                                border: "2px solid #92D050",
                                background: "white",
                                color: "#92D050",
                                fontWeight: 600,
                                cursor: "pointer",
                                fontSize: 14,
                                transition: "all 0.2s"
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = "#92D050";
                                e.currentTarget.style.color = "white";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = "white";
                                e.currentTarget.style.color = "#92D050";
                              }}
                            >
                              <i className="fa-solid fa-check-circle" style={{ marginRight: 6 }}></i>
                              Validar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            </div>

            {/* Popup selección curriculums */}
            {showCurriculumPopup && (
              <div
                style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
                onClick={() => setShowCurriculumPopup(false)}
              >
                <div
                  style={{ background: "white", borderRadius: 16, padding: 32, maxWidth: 600, width: "90%", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ display: "grid", gap: 16, overflowY: "auto", maxHeight: "calc(80vh - 64px)" }}>
                    {curriculums.length === 0 ? (
                      <div style={{ padding: 48, textAlign: "center", color: "#9ca3af", background: "#f9fafb", borderRadius: 12, border: "2px dashed #e5e7eb" }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No hay curriculums disponibles</div>
                        <div style={{ fontSize: 14 }}>Sube tu primer curriculum para comenzar</div>
                      </div>
                    ) : (
                      curriculums.map(curriculum => (
                        <div key={curriculum.nombre} style={{ padding: 20, background: "#F5F5F5", border: "1px solid #e5e7eb", borderRadius: 12, transition: "box-shadow 0.2s", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: "0 0 8px 0", color: "#111827", fontSize: 18, fontWeight: 700 }}>
                              <i className="fa-solid fa-file-pdf" style={{ marginRight: 8, color: "#92D050" }}></i>
                              {curriculum.nombre}
                            </h4>
                            <p style={{ margin: "0 0 8px 0", fontSize: 14, color: "#374151" }}>
                              <strong>Descripción:</strong> {curriculum.descripcion}
                            </p>
                            <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                              Creado: {new Date(curriculum.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <input
                              type="checkbox"
                              checked={selectedCurriculums.includes(curriculum.nombre)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedCurriculums([...selectedCurriculums, curriculum.nombre]);
                                } else {
                                  setSelectedCurriculums(selectedCurriculums.filter(n => n !== curriculum.nombre));
                                }
                              }}
                              style={{ width: 24, height: 24 }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Modal de edición de unidad */}
      {editingUnit && (
        <div 
          style={{ 
            position: "fixed", 
            top: 0, 
            left: 0, 
            width: "100%", 
            height: "100%", 
            background: "rgba(0,0,0,0.5)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            zIndex: 9999,
            fontFamily: "system-ui"
          }}
          onClick={() => {
            setEditingUnit(null);
            setEditTitulo("");
            setEditContenido("");
          }}
        >
          <div 
            style={{ 
              background: "white", 
              padding: 32, 
              borderRadius: 12, 
              maxWidth: 700, 
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)" 
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 24px 0", fontSize: 24, fontWeight: 700, color: "#92D050", fontFamily: "system-ui" }}>
              Editar Unidad
            </h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                Título de la Unidad
              </label>
              <input
                type="text"
                value={editTitulo}
                onChange={e => setEditTitulo(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  fontSize: 16,
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  outline: "none",
                  transition: "border-color 0.2s",
                  fontFamily: "system-ui"
                }}
                onFocus={e => e.target.style.borderColor = "#92D050"}
                onBlur={e => e.target.style.borderColor = "#e5e7eb"}
                placeholder="Título de la unidad"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                Contenido de la Unidad
              </label>
              <textarea
                value={editContenido}
                onChange={e => setEditContenido(e.target.value)}
                rows={12}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  fontSize: 14,
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  outline: "none",
                  lineHeight: 1.6,
                  resize: "vertical",
                  fontFamily: "system-ui",
                  transition: "border-color 0.2s"
                }}
                onFocus={e => e.target.style.borderColor = "#92D050"}
                onBlur={e => e.target.style.borderColor = "#e5e7eb"}
                placeholder="Contenido detallado de la unidad"
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={async () => {
                  const jwt = localStorage.getItem("jwt");
                  try {
                    const response = await fetch("https://odiseia-gw-basedatos-baej0f92.ew.gateway.dev/modificar_unidad_programacion", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` },
                      body: JSON.stringify({
                        centro_id: centroId,
                        profesor_id: profesorId,
                        clase: selectedClase,
                        asignatura: selectedAsignatura,
                        unidad: editingUnit.unidad,
                        titulo: editTitulo,
                        contenido: editContenido
                      })
                    });
                    if (response.ok) {
                      // Actualizar localmente
                      setEditarUnidades(prev => prev.map(u => 
                        u.unidad === editingUnit.unidad
                          ? { ...u, titulo: editTitulo, contenido: editContenido }
                          : u
                      ));
                      setEditingUnit(null);
                      setEditTitulo("");
                      setEditContenido("");
                    }
                  } catch (error) {
                    console.error("Error al guardar:", error);
                  }
                }}
                style={{
                  padding: "12px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "#92D050",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                  fontFamily: "system-ui",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#7ab83f"}
                onMouseLeave={e => e.currentTarget.style.background = "#92D050"}
              >
                <i className="fa-solid fa-check" style={{ marginRight: 6 }}></i>
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
