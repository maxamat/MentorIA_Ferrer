import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

type Asignacion = {
  id: string;
  clase: string;
  alumno_id: string;
};

export default function Alumnos() {
  const nav = useNavigate();
  const [clases, setClases] = useState<string[]>([]);
  const [alumnos, setAlumnos] = useState<string[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [asignacionToEdit, setAsignacionToEdit] = useState<Asignacion | null>(null);
  const [asignacionToDelete, setAsignacionToDelete] = useState<Asignacion | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);

  // Estados para crear
  const [createClase, setCreateClase] = useState("");
  const [createAlumnoId, setCreateAlumnoId] = useState("");

  // Estados para editar
  const [editClase, setEditClase] = useState("");
  const [editAlumnoId, setEditAlumnoId] = useState("");

  useEffect(() => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      nav("/");
      return;
    }

    me(jwt)
      .then(data => {
        setCentroId(data.username);

        // Cargar datos en paralelo
        return Promise.all([
          fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_clases`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
            body: JSON.stringify({ centro_id: data.username })
          }).then(r => r.json()),
          fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_alumnos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
            body: JSON.stringify({ centro_id: data.username })
          }).then(r => r.json()),
          fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_asignaciones_alumnos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
            body: JSON.stringify({ centro_id: data.username })
          }).then(r => r.json())
        ]);
      })
      .then(([clasesData, alumnosData, asignacionesData]) => {
        if (clasesData.success) setClases(clasesData.clases || []);
        if (alumnosData.success) setAlumnos(alumnosData.alumnos || []);
        if (asignacionesData.success) {
          const asignacionesConId = (asignacionesData.asignaciones || []).map((a: any, idx: number) => ({
            id: `${a.clase}-${a.alumno_id}-${idx}`,
            clase: a.clase,
            alumno_id: a.alumno_id
          }));
          setAsignaciones(asignacionesConId);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading data:", err);
        setLoading(false);
      });
  }, [nav]);

  const logout = () => {
    localStorage.removeItem("jwt");
    nav("/");
  };

  const handleCreateAsignacion = async () => {
    if (!createClase || !createAlumnoId) {
      alert("Por favor completa todos los campos");
      return;
    }

    if (!centroId) {
      alert("No se encontró el centro_id");
      return;
    }

    // Validar que el alumno no esté ya asignado a ninguna clase
    const alumnoYaAsignado = asignaciones.some(
      a => a.alumno_id.toLowerCase() === createAlumnoId.toLowerCase()
    );
    if (alumnoYaAsignado) {
      alert("Este alumno ya está asignado a una clase");
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/crear_alumno_clase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
        body: JSON.stringify({
          centro_id: centroId,
          clase: createClase,
          alumno_id: createAlumnoId
        })
      });
      const data = await res.json();
      if (data.success) {
        const nuevaAsignacion: Asignacion = {
          id: `${createClase}-${createAlumnoId}-${Date.now()}`,
          clase: createClase,
          alumno_id: createAlumnoId
        };
        setAsignaciones([...asignaciones, nuevaAsignacion]);
        setCreateModalOpen(false);
        setCreateClase("");
        setCreateAlumnoId("");
      }
    } catch (err) {
      console.error("Error creating asignacion:", err);
      alert("Error al crear la asignación");
    }
  };

  const handleEditAsignacion = async () => {
    if (!asignacionToEdit || !editClase || !editAlumnoId) {
      alert("Por favor completa todos los campos");
      return;
    }

    if (!centroId) {
      alert("No se encontró el centro_id");
      return;
    }

    // Validar duplicados (excluyendo la asignación actual)
    const existe = asignaciones.some(
      a => a.id !== asignacionToEdit.id &&
           a.clase.toLowerCase() === editClase.toLowerCase() && 
           a.alumno_id.toLowerCase() === editAlumnoId.toLowerCase()
    );
    if (existe) {
      alert("Esta asignación ya existe");
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/actualizar_alumno_clase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
        body: JSON.stringify({
          centro_id: centroId,
          clase: editClase,
          alumno_id: editAlumnoId,
          clase_antigua: asignacionToEdit.clase,
          alumno_id_antiguo: asignacionToEdit.alumno_id
        })
      });
      const data = await res.json();
      if (data.success) {
        setAsignaciones(asignaciones.map(a => 
          a.id === asignacionToEdit.id
            ? { ...a, clase: editClase, alumno_id: editAlumnoId }
            : a
        ));
        setAsignacionToEdit(null);
        setEditClase("");
        setEditAlumnoId("");
      }
    } catch (err) {
      console.error("Error updating asignacion:", err);
      alert("Error al actualizar la asignación");
    }
  };

  const confirmDeleteAsignacion = async () => {
    if (!asignacionToDelete) return;

    if (!centroId) {
      alert("No se encontró el centro_id");
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/borrar_alumno_clase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY },
        body: JSON.stringify({
          centro_id: centroId,
          clase: asignacionToDelete.clase,
          alumno_id: asignacionToDelete.alumno_id
        })
      });
      const data = await res.json();
      if (data.success) {
        setAsignaciones(asignaciones.filter(a => a.id !== asignacionToDelete.id));
        setAsignacionToDelete(null);
      }
    } catch (err) {
      console.error("Error deleting asignacion:", err);
      setAsignacionToDelete(null);
    }
  };

  const filteredAsignaciones = asignaciones.filter(a =>
    a.clase.toLowerCase().includes(search.toLowerCase()) ||
    a.alumno_id.toLowerCase().includes(search.toLowerCase())
  );

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
              onClick={() => nav("/app")}
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
              <i className="fa-solid fa-users" style={{ fontSize: "16px" }}></i>
              Usuarios
            </button>
            <button
              onClick={() => nav("/clases")}
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
              <i className="fa-solid fa-school" style={{ fontSize: "16px" }}></i>
              Clases
            </button>
            <button
              onClick={() => nav("/asignaturas")}
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
              <i className="fa-solid fa-book" style={{ fontSize: "16px" }}></i>
              Asignaturas
            </button>
            <button
              onClick={() => nav("/profesores")}
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
              <i className="fa-solid fa-chalkboard-user" style={{ fontSize: "16px" }}></i>
              Profesores
            </button>
            <button
              onClick={() => nav("/alumnos")}
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
              }}
            >
              <i className="fa-solid fa-user-graduate" style={{ fontSize: "16px" }}></i>
              Alumnos
            </button>
            <button
              onClick={() => nav("/curriculums")}
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
              <i className="fa-solid fa-file-pdf" style={{ fontSize: "16px" }}></i>
              Curriculums
            </button>
            <button
              onClick={() => nav("/configuracion")}
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
              <i className="fa-solid fa-gear" style={{ fontSize: "16px" }}></i>
              Configuración
            </button>
          </div>
          <div style={{ padding: "0 16px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
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
                gap: "12px",
                marginTop: "8px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <i className="fa-solid fa-right-from-bracket" style={{ fontSize: "16px" }}></i>
              Cerrar sesión
            </button>
          </div>
        </nav>

        {/* Área de contenido */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#F5F5F5", overflow: "auto" }}>
      <div style={{ flex: 1, padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        <h3 style={{ 
          margin: "0 0 12px 0", 
          background: "linear-gradient(135deg, #84BD00 0%, #009CA6 100%)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontWeight: 700,
          fontSize: "32px"
        }}>Alumnos</h3>
        <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
          Gestiona la <strong style={{ color: '#92D050' }}>asignación de alumnos a clases</strong>. Vincula cada estudiante con su grupo correspondiente para que puedan acceder al contenido educativo personalizado. Los alumnos asignados podrán visualizar las <strong style={{ color: '#92D050' }}>salidas profesionales y recursos</strong> específicos de su clase.
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>Cargando asignaciones de alumnos...</div>
            <div style={{ fontSize: "14px", color: "#6b7280" }}>Por favor espera un momento</div>
          </div>
        ) : (
          <>
        {/* Panel de búsqueda */}
        <div style={{ 
          padding: 16, 
          background: "white", 
          border: "1px solid #e5e7eb", 
          borderRadius: 16, 
          marginBottom: 16 
        }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Buscar:</div>
              <input
                type="text"
                placeholder="Nombre de la clase o alumno..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                  outline: "none"
                }}
              />
            </div>
            <button
              onClick={() => setCreateModalOpen(true)}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                background: "#92D050",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                marginTop: 18
              }}
            >
              Crear Asignación
            </button>
          </div>
        </div>

        {/* Panel de listado */}
        <div style={{ 
          border: "1px solid #e5e5e5", 
          borderRadius: 16,
          maxHeight: "550px",
          overflow: "hidden",
          background: "white"
        }}>
          <div style={{ 
            padding: 16, 
            maxHeight: "550px", 
            overflowY: "auto" 
          }}>
          <div style={{ display: "grid", gap: 16 }}>
            {asignaciones.length === 0 ? (
              <div style={{ 
                padding: 48, 
                textAlign: "center", 
                color: "#9ca3af",
                background: "#f9fafb",
                borderRadius: 12,
                border: "2px dashed #e5e7eb"
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>👨‍🎓</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No hay asignaciones creadas</div>
                <div style={{ fontSize: 14 }}>Crea tu primera asignación para comenzar</div>
              </div>
            ) : (
              filteredAsignaciones.map((asig) => (
                <div key={asig.id} style={{ 
                  padding: 20,
                  background: "#F5F5F5",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  transition: "box-shadow 0.2s",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <h4 style={{ 
                      margin: "0 0 8px 0", 
                      fontSize: 17,
                      fontWeight: 600,
                      color: "#111827"
                    }}>
                      {asig.alumno_id}
                    </h4>
                    <div style={{ fontSize: 14, color: "#6b7280" }}>
                      <strong>Clase:</strong> {asig.clase}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        setAsignacionToEdit(asig);
                        setEditClase(asig.clase);
                        setEditAlumnoId(asig.alumno_id);
                      }}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: "#3b82f6",
                        color: "white",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setAsignacionToDelete(asig)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: "#ef4444",
                        color: "white",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          </div>
        </div>

      {/* Modal crear */}
      {createModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000
          }}
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 32,
              maxWidth: 500,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500, color: "#374151" }}>
                Clase
              </label>
              <select
                value={createClase}
                onChange={(e) => setCreateClase(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 15
                }}
              >
                <option value="">Selecciona una clase</option>
                {clases.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500, color: "#374151" }}>
                Alumno
              </label>
              <select
                value={createAlumnoId}
                onChange={(e) => setCreateAlumnoId(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 15
                }}
              >
                <option value="">Selecciona un alumno</option>
                {alumnos.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCreateAsignacion}
              style={{
                width: "100%",
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: "#92D050",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14
              }}
            >
              Crear Asignación
            </button>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {asignacionToEdit && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000
          }}
          onClick={() => setAsignacionToEdit(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 32,
              maxWidth: 500,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500, color: "#374151" }}>
                Clase
              </label>
              <select
                value={editClase}
                onChange={(e) => setEditClase(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 15
                }}
              >
                <option value="">Selecciona una clase</option>
                {clases.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500, color: "#374151" }}>
                Alumno
              </label>
              <select
                value={editAlumnoId}
                onChange={(e) => setEditAlumnoId(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 15
                }}
              >
                <option value="">Selecciona un alumno</option>
                {alumnos.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleEditAsignacion}
              style={{
                width: "100%",
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: "#3b82f6",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14
              }}
            >
              Actualizar Asignación
            </button>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {asignacionToDelete && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000
          }}
          onClick={() => setAsignacionToDelete(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 32,
              maxWidth: 500,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 24, textAlign: "center", color: "#ef4444" }}>
              Confirmar eliminación
            </h3>
            
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: 0, fontSize: 16, color: "#374151", lineHeight: 1.6 }}>
                ¿Estás seguro de que deseas eliminar la asignación del alumno <strong>{asignacionToDelete.alumno_id}</strong> 
                {" "}en la clase <strong>{asignacionToDelete.clase}</strong>?
              </p>
              <p style={{ margin: "12px 0 0 0", fontSize: 14, color: "#ef4444", lineHeight: 1.6 }}>
                Esta acción no se puede deshacer.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={confirmDeleteAsignacion}
                style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "#ef4444",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
        </>
        )}
        </div>
        </div>
      </div>
    </div>
  );
}
