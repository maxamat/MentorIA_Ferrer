import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

export default function Secciones() {
  const nav = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [profesorId, setProfesorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Pestañas
  const [activeTab, setActiveTab] = useState<"generar" | "editar">("generar");

  // Paneles desplegables
  const [selectedClase, setSelectedClase] = useState("");
  const [selectedAsignatura, setSelectedAsignatura] = useState("");
  const [selectedUnidad, setSelectedUnidad] = useState("");
  const [selectedNumSecciones, setSelectedNumSecciones] = useState("");
  const [consideraciones, setConsideraciones] = useState("");

  // Datos para los desplegables
  const [clases, setClases] = useState<string[]>([]);
  const [asignaturas, setAsignaturas] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);

  // Datos de secciones
  const [secciones, setSecciones] = useState<any[]>([]);

  // Para la edición de secciones
  const [editingSeccion, setEditingSeccion] = useState<any | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editContenido, setEditContenido] = useState("");

  // Opciones para número de secciones
  const opcionesSecciones = Array.from({ length: 20 }, (_, i) => (i + 1).toString());

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
    setSelectedAsignatura("");
    setSelectedUnidad("");
    if (!selectedClase || !centroId || !profesorId) {
      setAsignaturas([]);
      setUnidades([]);
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

  // Cuando se selecciona una asignatura, cargar unidades con status=true
  useEffect(() => {
    setSelectedUnidad("");
    if (!selectedClase || !selectedAsignatura || !centroId || !profesorId) {
      setUnidades([]);
      return;
    }
    fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_unidades_programaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
      body: JSON.stringify({ centro_id: centroId, profesor_id: profesorId, clase: selectedClase, asignatura: selectedAsignatura })
    })
      .then(r => r.json())
      .then(res => {
        // Filtrar solo unidades con status=true
        const unidadesValidadas = (res.unidades || []).filter((u: any) => u.status === true);
        setUnidades(unidadesValidadas);
      })
      .catch(() => setUnidades([]));
  }, [selectedClase, selectedAsignatura, centroId, profesorId]);

  // Cuando se selecciona una unidad, cargar secciones
  useEffect(() => {
    if (!selectedClase || !selectedAsignatura || !selectedUnidad || !centroId || !profesorId) {
      setSecciones([]);
      return;
    }
    fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_secciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
      body: JSON.stringify({ 
        centro_id: centroId, 
        profesor_id: profesorId, 
        clase: selectedClase, 
        asignatura: selectedAsignatura,
        unidad: parseInt(selectedUnidad)
      })
    })
      .then(r => r.json())
      .then(res => {
        setSecciones(res.secciones || []);
      })
      .catch(() => setSecciones([]));
  }, [selectedClase, selectedAsignatura, selectedUnidad, centroId, profesorId]);

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
            <button onClick={() => nav("/secciones")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "rgba(146, 208, 80, 0.1)", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }}><i className="fa-solid fa-list-check" style={{ fontSize: "16px" }}></i>Secciones</button>
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
                <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando secciones...</div>
                <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
              </div>
            </div>
          ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%", overflow: "hidden" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#84BD00", fontWeight: 700, fontSize: "32px" }}>Secciones</h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
              Gestiona las secciones de las unidades didácticas validadas. Selecciona una <span style={{ fontWeight: 700, color: "#92D050" }}>clase</span>, <span style={{ fontWeight: 700, color: "#92D050" }}>asignatura</span> y <span style={{ fontWeight: 700, color: "#92D050" }}>unidad</span> para visualizar y trabajar con sus secciones.
            </p>

            {/* Filtros */}
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
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Unidad:</div>
                <select 
                  value={selectedUnidad} 
                  onChange={e => setSelectedUnidad(e.target.value)} 
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}
                  disabled={!selectedAsignatura}
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
                Generar Secciones
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
                Editar Secciones
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
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Num. Secciones:</div>
                      <select value={selectedNumSecciones} onChange={e => setSelectedNumSecciones(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}>
                        <option value="">Num. Secciones</option>
                        {opcionesSecciones.map(seccion => (
                          <option key={seccion} value={seccion}>{seccion}</option>
                        ))}
                      </select>
                    </div>
                  </div>
              
                  {/* Campo de texto para consideraciones adicionales */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Consideraciones adicionales:</div>
                    <textarea 
                      value={consideraciones} 
                      onChange={e => setConsideraciones(e.target.value)}
                      placeholder="Añade aquí cualquier consideración adicional para la generación de las secciones..."
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
                        background: selectedClase && selectedAsignatura && selectedUnidad && selectedNumSecciones ? "#92D050" : "#d1d5db", 
                        color: "white", 
                        fontWeight: 600, 
                        cursor: selectedClase && selectedAsignatura && selectedUnidad && selectedNumSecciones ? "pointer" : "not-allowed", 
                        fontSize: 14,
                        transition: "all 0.2s",
                        whiteSpace: "nowrap"
                      }}
                      disabled={!selectedClase || !selectedAsignatura || !selectedUnidad || !selectedNumSecciones}
                      onClick={async () => {
                        if (!selectedClase || !selectedAsignatura || !selectedUnidad || !selectedNumSecciones || !centroId || !profesorId) {
                          alert("Por favor completa todos los campos");
                          return;
                        }
                        
                        try {
                          const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/generar_secciones`, {
                            method: "POST",
                            headers: { 
                              "Content-Type": "application/json", 
                              "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY 
                            },
                            body: JSON.stringify({ 
                              centro_id: centroId,
                              clase: selectedClase,
                              asignatura: selectedAsignatura,
                              unidad: parseInt(selectedUnidad),
                              num_secciones: parseInt(selectedNumSecciones),
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
                                <h3 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#92D050;font-family:system-ui">Generando Secciones</h3>
                                <p style="margin:0;color:#6b7280;line-height:1.6;font-size:14px;font-family:system-ui">
                                  El tiempo estimado para la generación de las secciones solicitadas puede oscilar entre <strong style="color:#92D050">1-5 minutos</strong> dependiendo del número de secciones.
                                </p>
                              </div>
                            `;
                            document.body.appendChild(dialog);
                          } else {
                            alert("Error al generar las secciones. Por favor, inténtalo de nuevo.");
                          }
                        } catch (error) {
                          console.error("Error:", error);
                          alert("Error al conectar con el servidor.");
                        }
                      }}
                      onMouseEnter={e => {
                        if (selectedClase && selectedAsignatura && selectedUnidad && selectedNumSecciones) {
                          e.currentTarget.style.background = "#7ab83f";
                        }
                      }}
                      onMouseLeave={e => {
                        if (selectedClase && selectedAsignatura && selectedUnidad && selectedNumSecciones) {
                          e.currentTarget.style.background = "#92D050";
                        }
                      }}
                    >
                      <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 8 }}></i>
                      Generar Secciones
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Panel de edición */}
                <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, background: "white", padding: 32, flex: 1, overflow: "auto", minHeight: 0 }}>
                  {!selectedClase || !selectedAsignatura || !selectedUnidad ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 300, flexDirection: "column" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                        <i className="fa-solid fa-triangle-exclamation"></i>
                      </div>
                      <p style={{ fontSize: 16, color: "#9ca3af", margin: 0, textAlign: "center" }}>
                        Selecciona una <span style={{ fontWeight: 700, color: "#92D050" }}>clase</span>, <span style={{ fontWeight: 700, color: "#92D050" }}>asignatura</span> y <span style={{ fontWeight: 700, color: "#92D050" }}>unidad</span> para editar secciones
                      </p>
                    </div>
                  ) : secciones.length === 0 ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 300, flexDirection: "column" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                        <i className="fa-solid fa-triangle-exclamation"></i>
                      </div>
                      <p style={{ fontSize: 16, color: "#9ca3af", margin: 0 }}>No hay secciones disponibles</p>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 16 }}>
                      {secciones.map((seccion, index) => {
                        return (
                        <div 
                          key={index} 
                          style={{ 
                            padding: 20, 
                            background: "#F9FAFB", 
                            border: "1px solid #e5e7eb", 
                            borderRadius: 12,
                            transition: "all 0.2s",
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
                            style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, marginRight: 20, cursor: "pointer" }}
                            onClick={() => {
                              // Abrir popup de edición de sección
                              setEditingSeccion(seccion);
                              setEditTitulo(seccion.titulo);
                              setEditContenido(seccion.contenido);
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
                              <i className="fa-solid fa-list-check"></i>
                            </div>
                            <div style={{ flex: 1 }}>
                              <h5 style={{ margin: "0 0 12px 0", color: "#111827", fontSize: 18, fontWeight: 700 }}>
                                Sección {seccion.seccion}: {seccion.titulo}
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
                                {seccion.contenido}
                              </p>
                            </div>
                          </div>

                          {/* Checkbox para validar */}
                          {!seccion.status && (
                            <div 
                              onClick={async (e) => {
                                e.stopPropagation();
                                const jwt = localStorage.getItem("jwt");
                                try {
                                  const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/validar_seccion_programacion`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
                                    body: JSON.stringify({
                                      centro_id: centroId,
                                      profesor_id: profesorId,
                                      clase: selectedClase,
                                      asignatura: selectedAsignatura,
                                      unidad: parseInt(selectedUnidad),
                                      seccion: seccion.seccion
                                    })
                                  });
                                  if (response.ok) {
                                    // Actualizar localmente
                                    setSecciones(prev => prev.map(s => 
                                      s.seccion === seccion.seccion
                                        ? { ...s, status: true }
                                        : s
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
                                if (icon) (icon as HTMLElement).style.color = "white";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = "white";
                                const icon = e.currentTarget.querySelector("i");
                                if (icon) (icon as HTMLElement).style.color = "#92D050";
                              }}
                            >
                              <i className="fa-solid fa-check" style={{ fontSize: 14, color: "#92D050", transition: "color 0.2s" }}></i>
                            </div>
                          )}
                          
                          {/* Mostrar check verde si ya está validado */}
                          {seccion.status && (
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
            )}
            </div>

          </div>
          )}
        </div>
      </div>

      {/* Modal de edición de sección */}
      {editingSeccion && (
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
            setEditingSeccion(null);
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
              Editar Sección
            </h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                Título de la Sección
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
                placeholder="Título de la sección"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                Contenido de la Sección
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
                placeholder="Contenido detallado de la sección"
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={async () => {
                  const jwt = localStorage.getItem("jwt");
                  try {
                    const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/modificar_seccion_programacion`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
                      body: JSON.stringify({
                        centro_id: centroId,
                        profesor_id: profesorId,
                        clase: selectedClase,
                        asignatura: selectedAsignatura,
                        unidad: parseInt(selectedUnidad),
                        seccion: editingSeccion.seccion,
                        titulo: editTitulo,
                        contenido: editContenido
                      })
                    });
                    if (response.ok) {
                      // Actualizar localmente
                      setSecciones(prev => prev.map(s => 
                        s.seccion === editingSeccion.seccion
                          ? { ...s, titulo: editTitulo, contenido: editContenido }
                          : s
                      ));
                      setEditingSeccion(null);
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
