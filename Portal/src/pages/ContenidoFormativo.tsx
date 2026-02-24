import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

export default function ContenidoFormativo() {
  const nav = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [profesorId, setProfesorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Paneles desplegables
  const [selectedClase, setSelectedClase] = useState("");
  const [selectedAsignatura, setSelectedAsignatura] = useState("");

  // Datos para los desplegables
  const [clases, setClases] = useState<string[]>([]);
  const [asignaturas, setAsignaturas] = useState<string[]>([]);

  // Datos de unidades
  const [unidades, setUnidades] = useState<any[]>([]);

  // Para la edición de unidades
  const [editingUnit, setEditingUnit] = useState<any | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editContenido, setEditContenido] = useState("");

  // Para visualizar contenido formativo
  const [showContentModal, setShowContentModal] = useState(false);
  const [contentSections, setContentSections] = useState<any[]>([]);
  const [selectedContent, setSelectedContent] = useState<{unidad: number, titulo: string} | null>(null);
  const [viewingHtml, setViewingHtml] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

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

      // Cargar clases (listar_clases_profesores)
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

  // Cargar unidades cuando se seleccionan clase y asignatura
  useEffect(() => {
    if (!selectedClase || !selectedAsignatura || !centroId || !profesorId) {
      setUnidades([]);
      return;
    }
    fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_unidades_contenido_formativo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
      body: JSON.stringify({ centro_id: centroId, profesor_id: profesorId, clase: selectedClase, asignatura: selectedAsignatura })
    })
      .then(r => r.json())
      .then(res => setUnidades(res.unidades || []))
      .catch(() => setUnidades([]));
  }, [selectedClase, selectedAsignatura, centroId, profesorId]);

  // Función para ver contenido formativo
  const handleVerContenido = async (unidad: any) => {
    if (!unidad.flag_created) return;
    
    setLoadingContent(true);
    setSelectedContent({ unidad: unidad.unidad, titulo: unidad.titulo });
    setShowContentModal(true);
    setViewingHtml(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_contenidos_unidad`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
        body: JSON.stringify({
          centro_id: centroId,
          clase: selectedClase,
          asignatura: selectedAsignatura,
          unidad: unidad.unidad
        })
      });
      
      const data = await response.json();
      setContentSections(data.contenidos || []);
    } catch (error) {
      console.error("Error cargando contenidos:", error);
      setContentSections([]);
    } finally {
      setLoadingContent(false);
    }
  };

  // Función para abrir URL del contenido en nueva pestaña
  const handleOpenContent = (url: string) => {
    window.open(url, '_blank');
  };

  // Función para validar contenido formativo
  const handleValidarContenido = async (seccion: string) => {
    if (!centroId || !selectedClase || !selectedAsignatura || !selectedContent) {
      alert("Faltan datos necesarios para validar el contenido");
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/validar_contenido`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY 
        },
        body: JSON.stringify({ 
          centro_id: centroId,
          clase: selectedClase,
          asignatura: selectedAsignatura,
          unidad: selectedContent.unidad,
          seccion: seccion
        })
      });
      
      if (response.ok) {
        // Mostrar diálogo de éxito
        const dialog = document.createElement('div');
        dialog.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:system-ui;cursor:pointer';
        dialog.onclick = (e) => {
          if (e.target === dialog) dialog.remove();
        };
        dialog.innerHTML = `
          <div style="background:white;padding:32px;border-radius:12px;max-width:500px;box-shadow:0 4px 20px rgba(0,0,0,0.15);cursor:default" onclick="event.stopPropagation()">
            <h3 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#84BD00;font-family:system-ui">
              <i class="fa-solid fa-check-circle" style="margin-right:12px"></i>Contenido Validado
            </h3>
            <p style="margin:0;color:#6b7280;line-height:1.6;font-size:14px;font-family:system-ui">
              El contenido de la <strong style="color:#84BD00">Sección ${seccion}</strong> ha sido validado correctamente.
            </p>
          </div>
        `;
        document.body.appendChild(dialog);
      } else {
        const errorData = await response.json();
        alert(`Error al validar: ${errorData.detail || "Error desconocido"}`);
      }
    } catch (error) {
      console.error("Error validando contenido:", error);
      alert("Error al conectar con el servidor");
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
            <button onClick={() => nav("/contenido-formativo")} style={{ width: "100%", padding: "12px 16px", border: "none", background: "rgba(146, 208, 80, 0.1)", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#92D050", borderRadius: "8px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "12px" }}><i className="fa-solid fa-book-open" style={{ fontSize: "16px" }}></i>Contenido Formativo</button>
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
                <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando contenido formativo...</div>
                <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
              </div>
            </div>
          ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%", overflow: "hidden" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#84BD00", fontWeight: 700, fontSize: "32px" }}>Contenido Formativo</h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
              Revisa y edita el contenido formativo de las unidades didácticas de tus asignaturas. Aquí puedes <span style={{ fontWeight: 700, color: "#92D050" }}>personalizar el material educativo</span> de cada unidad, ajustar los contenidos según las necesidades de tu clase y <span style={{ fontWeight: 700, color: "#92D050" }}>validar las unidades</span> cuando estén listas para su implementación.
            </p>

            {/* Filtros comunes */}
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

            {/* Contenido principal */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              {/* Panel de listado de unidades */}
              <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, background: "white", padding: 32, flex: 1, overflow: "auto", minHeight: 0 }}>
                {!selectedClase || !selectedAsignatura ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 300, flexDirection: "column" }}>
                    <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                      <i className="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <p style={{ fontSize: 16, color: "#9ca3af", margin: 0, textAlign: "center" }}>
                      Selecciona una <span style={{ fontWeight: 700, color: "#92D050" }}>clase</span> y <span style={{ fontWeight: 700, color: "#92D050" }}>asignatura</span> para ver el contenido formativo
                    </p>
                  </div>
                ) : unidades.length === 0 ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 300, flexDirection: "column" }}>
                    <div style={{ fontSize: 48, marginBottom: 16, color: "#d1d5db" }}>
                      <i className="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <p style={{ fontSize: 16, color: "#9ca3af", margin: 0 }}>No hay unidades disponibles</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 16 }}>
                    {unidades.map((unidad, index) => {
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
                        
                        {/* Botones de acción */}
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {/* Botón Generar */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              
                              if (!centroId || !profesorId || !selectedClase || !selectedAsignatura) {
                                alert("Faltan datos necesarios para generar el contenido");
                                return;
                              }

                              try {
                                const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/generar_contenido`, {
                                  method: "POST",
                                  headers: { 
                                    "Content-Type": "application/json", 
                                    "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY 
                                  },
                                  body: JSON.stringify({ 
                                    centro_id: centroId,
                                    clase: selectedClase,
                                    asignatura: selectedAsignatura,
                                    unidad: unidad.unidad
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
                                      <h3 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#84BD00;font-family:system-ui">Generando Contenido Formativo</h3>
                                      <p style="margin:0;color:#6b7280;line-height:1.6;font-size:14px;font-family:system-ui">
                                        Se está generando el contenido formativo para la <strong style="color:#84BD00">Unidad ${unidad.unidad}</strong>. Este proceso puede tardar algunos minutos.
                                      </p>
                                    </div>
                                  `;
                                  document.body.appendChild(dialog);
                                } else {
                                  alert("Error al generar el contenido. Por favor, inténtalo de nuevo.");
                                }
                              } catch (error) {
                                console.error("Error:", error);
                                alert("Error al conectar con el servidor.");
                              }
                            }}
                            style={{
                              padding: "8px 16px",
                              border: "2px solid #84BD00",
                              borderRadius: 8,
                              background: "white",
                              color: "#84BD00",
                              fontWeight: 600,
                              cursor: "pointer",
                              fontSize: 13,
                              transition: "all 0.2s",
                              whiteSpace: "nowrap"
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = "#84BD00";
                              e.currentTarget.style.color = "white";
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = "white";
                              e.currentTarget.style.color = "#84BD00";
                            }}
                          >
                            <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 6 }}></i>
                            Generar
                          </button>

                          {/* Botón Ver */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVerContenido(unidad);
                            }}
                            disabled={!unidad.flag_created}
                            style={{
                              padding: "8px 16px",
                              border: `2px solid ${!unidad.flag_created ? "#d1d5db" : "#84BD00"}`,
                              borderRadius: 8,
                              background: "white",
                              color: !unidad.flag_created ? "#9ca3af" : "#84BD00",
                              fontWeight: 600,
                              cursor: !unidad.flag_created ? "not-allowed" : "pointer",
                              fontSize: 13,
                              transition: "all 0.2s",
                              whiteSpace: "nowrap",
                              opacity: !unidad.flag_created ? 0.5 : 1
                            }}
                            onMouseEnter={e => {
                              if (unidad.flag_created) {
                                e.currentTarget.style.background = "#84BD00";
                                e.currentTarget.style.color = "white";
                              }
                            }}
                            onMouseLeave={e => {
                              if (unidad.flag_created) {
                                e.currentTarget.style.background = "white";
                                e.currentTarget.style.color = "#84BD00";
                              }
                            }}
                          >
                            <i className="fa-solid fa-eye" style={{ marginRight: 6 }}></i>
                            Ver
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
              Editar Contenido Formativo
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
                      setUnidades(prev => prev.map(u => 
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

      {/* Modal de visualización de contenido formativo */}
      {showContentModal && (
        <div 
          onClick={() => setShowContentModal(false)}
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
              padding: 32,
              maxWidth: 900,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
            }}>
            {/* Header del modal */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: 0, color: "#1f2937", fontSize: 24, fontWeight: 700 }}>
                <i className="fa-solid fa-file-lines" style={{ marginRight: 12, color: "#84BD00" }}></i>
                Contenido Formativo
              </h2>
              {selectedContent && (
                <p style={{ margin: "8px 0 0 0", color: "#6b7280", fontSize: 14 }}>
                  Unidad {selectedContent.unidad}: {selectedContent.titulo}
                </p>
              )}
            </div>

            {/* Loading spinner */}
            {loadingContent && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: "48px", marginBottom: 16, color: "#84BD00" }}>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                </div>
                <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12, color: "#6b7280" }}>Cargando contenidos...</div>
                <div style={{ fontSize: "14px", color: "#6b7280" }}>Por favor espera un momento</div>
              </div>
            )}

            {/* Lista de secciones */}
            {!loadingContent && contentSections.length > 0 && (
              <div>
                <p style={{ marginBottom: 16, color: "#6b7280", fontSize: 14 }}>
                  <i className="fa-solid fa-info-circle" style={{ marginRight: 8 }}></i>
                  Selecciona una sección para visualizar su contenido formativo:
                </p>
                <div style={{ display: "grid", gap: 12 }}>
                  {contentSections.map((section, index) => (
                    <div
                      key={index}
                      style={{
                        border: "2px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "all 0.2s",
                        cursor: "pointer"
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "#84BD00";
                        e.currentTarget.style.background = "#f9fafb";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "#e5e7eb";
                        e.currentTarget.style.background = "white";
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, color: "#1f2937", fontSize: 16, fontWeight: 600 }}>
                          <i className="fa-solid fa-book" style={{ marginRight: 8, color: "#84BD00" }}></i>
                          {section.titulo}
                        </h4>
                        <p style={{ margin: "8px 0 0 0", color: "#6b7280", fontSize: 14 }}>
                          Sección: {section.seccion}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <button
                          onClick={() => handleOpenContent(section.url_contenido)}
                          style={{
                            padding: "10px 20px",
                            border: "2px solid #84BD00",
                            borderRadius: 8,
                            background: "white",
                            color: "#84BD00",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: 14,
                            transition: "all 0.2s",
                            whiteSpace: "nowrap"
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = "#84BD00";
                            e.currentTarget.style.color = "white";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = "white";
                            e.currentTarget.style.color = "#84BD00";
                          }}
                        >
                          <i className="fa-solid fa-external-link-alt" style={{ marginRight: 8 }}></i>
                          Abrir
                        </button>
                        <button
                          onClick={() => window.open(section.url_audio, '_blank')}
                          style={{
                            padding: "10px 20px",
                            border: "2px solid #84BD00",
                            borderRadius: 8,
                            background: "white",
                            color: "#84BD00",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: 14,
                            transition: "all 0.2s",
                            whiteSpace: "nowrap"
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = "#84BD00";
                            e.currentTarget.style.color = "white";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = "white";
                            e.currentTarget.style.color = "#84BD00";
                          }}
                        >
                          <i className="fa-solid fa-headphones" style={{ marginRight: 8 }}></i>
                          Escuchar
                        </button>
                        <button
                          onClick={() => handleValidarContenido(section.seccion)}
                          style={{
                            padding: "10px 20px",
                            border: "2px solid #84BD00",
                            borderRadius: 8,
                            background: "white",
                            color: "#84BD00",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: 14,
                            transition: "all 0.2s",
                            whiteSpace: "nowrap"
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = "#84BD00";
                            e.currentTarget.style.color = "white";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = "white";
                            e.currentTarget.style.color = "#84BD00";
                          }}
                        >
                          <i className="fa-solid fa-check-circle" style={{ marginRight: 8 }}></i>
                          Validar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sin contenido disponible */}
            {!loadingContent && contentSections.length === 0 && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <i className="fa-solid fa-folder-open" style={{ fontSize: 48, color: "#d1d5db" }}></i>
                <p style={{ marginTop: 16, color: "#6b7280" }}>
                  No hay contenidos generados para esta unidad
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
