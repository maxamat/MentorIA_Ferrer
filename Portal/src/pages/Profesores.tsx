import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

type Asignacion = {
  id: string;
  clase: string;
  asignatura: string;
  profesor_id: string;
};

export default function Profesores() {
  const nav = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [showCreateAsignacion, setShowCreateAsignacion] = useState(false);
  const [asignacionToDelete, setAsignacionToDelete] = useState<Asignacion | null>(null);
  const [asignacionToEdit, setAsignacionToEdit] = useState<Asignacion | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados para los desplegables
  const [clases, setClases] = useState<string[]>([]);
  const [asignaturas, setAsignaturas] = useState<string[]>([]);
  const [profesores, setProfesores] = useState<string[]>([]);

  // Estados para crear
  const [newClase, setNewClase] = useState("");
  const [newAsignatura, setNewAsignatura] = useState("");
  const [newProfesor, setNewProfesor] = useState("");

  // Estados para editar
  const [editClase, setEditClase] = useState("");
  const [editAsignatura, setEditAsignatura] = useState("");
  const [editProfesor, setEditProfesor] = useState("");

  useEffect(() => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      nav("/");
      return;
    }
    
    me(jwt)
      .then(data => {
        setUserRole(data.role);
        setCentroId(data.username);

        // Cargar clases, asignaturas, profesores y asignaciones
        return Promise.all([
          fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_clases`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
            },
            body: JSON.stringify({ centro_id: data.username })
          }),
          fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_asignaturas`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
            },
            body: JSON.stringify({ centro_id: data.username })
          }),
          fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_profesores`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
            },
            body: JSON.stringify({ centro_id: data.username })
          }),
          fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_asignaciones`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
            },
            body: JSON.stringify({ centro_id: data.username })
          })
        ]);
      })
      .then(responses => Promise.all(responses.map(r => r.json())))
      .then(([clasesData, asignaturasData, profesoresData, asignacionesData]) => {
        setClases(clasesData.clases || []);
        setAsignaturas(asignaturasData.asignaturas || []);
        setProfesores(profesoresData.profesores || []);
        
        if (asignacionesData.asignaciones) {
          const asignacionesFormateadas = asignacionesData.asignaciones.map((a: any, index: number) => ({
            id: `${a.clase}-${a.asignatura}-${a.profesor_id}-${index}`,
            clase: a.clase,
            asignatura: a.asignatura,
            profesor_id: a.profesor_id
          }));
          setAsignaciones(asignacionesFormateadas);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
        localStorage.removeItem("jwt");
        nav("/");
      });
  }, [nav]);

  async function handleCreateAsignacion(e: React.FormEvent) {
    e.preventDefault();
    if (!centroId) {
      alert("No hay centro_id disponible");
      return;
    }

    // Validar si ya existe esa asignación
    const existe = asignaciones.find(a => 
      a.clase === newClase && 
      a.asignatura === newAsignatura && 
      a.profesor_id === newProfesor
    );
    if (existe) {
      alert("Esta asignación ya existe");
      return;
    }

    setShowCreateAsignacion(false);
    const clase = newClase;
    const asignatura = newAsignatura;
    const profesor = newProfesor;
    setNewClase("");
    setNewAsignatura("");
    setNewProfesor("");

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/crear_asignatura_profesor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          clase: clase,
          asignatura: asignatura,
          profesor_id: profesor
        })
      });

      if (!response.ok) throw new Error("Error al crear asignación");

      const nuevaAsignacion: Asignacion = {
        id: `${clase}-${asignatura}-${profesor}-${Date.now()}`,
        clase: clase,
        asignatura: asignatura,
        profesor_id: profesor
      };
      setAsignaciones([...asignaciones, nuevaAsignacion]);
    } catch (error) {
      console.error("Error creando asignación:", error);
      alert("Error al crear la asignación");
    }
  }

  async function confirmDeleteAsignacion() {
    if (!asignacionToDelete || !centroId) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/borrar_asignatura_profesor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          clase: asignacionToDelete.clase,
          asignatura: asignacionToDelete.asignatura,
          profesor_id: asignacionToDelete.profesor_id
        })
      });

      if (!response.ok) throw new Error("Error al borrar asignación");

      setAsignaciones(asignaciones.filter(a => a.id !== asignacionToDelete.id));
      setAsignacionToDelete(null);
    } catch (error) {
      console.error("Error borrando asignación:", error);
      alert("Error al borrar la asignación");
      setAsignacionToDelete(null);
    }
  }

  async function handleEditAsignacion(e: React.FormEvent) {
    e.preventDefault();
    if (!asignacionToEdit || !centroId) return;

    // Validar si ya existe otra asignación igual
    const existe = asignaciones.find(a => 
      a.clase === editClase && 
      a.asignatura === editAsignatura && 
      a.profesor_id === editProfesor &&
      a.id !== asignacionToEdit.id
    );
    if (existe) {
      alert("Ya existe una asignación con esos valores");
      return;
    }

    const asignacionEditando = asignacionToEdit;
    setAsignacionToEdit(null);
    setEditClase("");
    setEditAsignatura("");
    setEditProfesor("");

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/actualizar_asignatura_profesor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          clase: editClase,
          asignatura: editAsignatura,
          profesor_id: editProfesor,
          clase_antigua: asignacionEditando.clase,
          asignatura_antigua: asignacionEditando.asignatura,
          profesor_id_antiguo: asignacionEditando.profesor_id
        })
      });

      if (!response.ok) throw new Error("Error al actualizar asignación");

      setAsignaciones(asignaciones.map(a => 
        a.id === asignacionEditando.id 
          ? { ...a, clase: editClase, asignatura: editAsignatura, profesor_id: editProfesor } 
          : a
      ));
    } catch (error) {
      console.error("Error actualizando asignación:", error);
      alert("Error al actualizar la asignación");
    }
  }

  function logout() {
    localStorage.removeItem("jwt");
    nav("/");
  }

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
              <i className="fa-solid fa-chalkboard-user" style={{ fontSize: "16px" }}></i>
              Profesores
            </button>
            <button
              onClick={() => nav("/alumnos")}
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
          
          {/* Términos y Cerrar sesión abajo */}
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
          }}>Profesores</h3>
          <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
            Asigna <strong style={{ color: '#92D050' }}>profesores a clases y asignaturas</strong> específicas. Define qué docente imparte cada materia en cada grupo. Esta información permite personalizar el contenido educativo y <strong style={{ color: '#92D050' }}>adaptar las salidas profesionales</strong> según el profesorado de cada clase.
          </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>Cargando asignaciones de profesores...</div>
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
                placeholder="Nombre de la clase, asignatura o profesor..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
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
              onClick={() => setShowCreateAsignacion(!showCreateAsignacion)}
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
                <div style={{ fontSize: 48, marginBottom: 16 }}>👨‍🏫</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No hay asignaciones creadas</div>
                <div style={{ fontSize: 14 }}>Crea tu primera asignación para comenzar</div>
              </div>
            ) : (
              asignaciones
                .filter(asig => 
                  asig.clase.toLowerCase().includes(searchText.toLowerCase()) ||
                  asig.asignatura.toLowerCase().includes(searchText.toLowerCase()) ||
                  asig.profesor_id.toLowerCase().includes(searchText.toLowerCase())
                )
                .map((asig) => (
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
                        color: "#111827",
                        fontSize: 18,
                        fontWeight: 700
                      }}>
                        {asig.profesor_id}
                      </h4>
                      <div style={{ fontSize: 14, color: "#6b7280" }}>
                        <strong>Clase:</strong> {asig.clase} • <strong>Asignatura:</strong> {asig.asignatura}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => {
                          setAsignacionToEdit(asig);
                          setEditClase(asig.clase);
                          setEditAsignatura(asig.asignatura);
                          setEditProfesor(asig.profesor_id);
                        }}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          border: "none",
                          background: "#3b82f6",
                          color: "white",
                          fontSize: 16,
                          cursor: "pointer",
                          fontWeight: 600
                        }}
                        title="Editar asignación"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setAsignacionToDelete(asig)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          border: "none",
                          background: "#ef4444",
                          color: "white",
                          fontSize: 16,
                          cursor: "pointer",
                          fontWeight: 600
                        }}
                        title="Eliminar asignación"
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

      {/* Popup para crear asignación */}
      {showCreateAsignacion && (
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
          onClick={() => setShowCreateAsignacion(false)}
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
            <form onSubmit={handleCreateAsignacion}>
              <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>Clase</span>
                <select
                  value={newClase}
                  onChange={(e) => setNewClase(e.target.value)}
                  required
                  style={{ 
                    padding: "10px 14px", 
                    borderRadius: 8, 
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none"
                  }}
                >
                  <option value="">Selecciona una clase</option>
                  {clases.map(clase => (
                    <option key={clase} value={clase}>{clase}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>Asignatura</span>
                <select
                  value={newAsignatura}
                  onChange={(e) => setNewAsignatura(e.target.value)}
                  required
                  style={{ 
                    padding: "10px 14px", 
                    borderRadius: 8, 
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none"
                  }}
                >
                  <option value="">Selecciona una asignatura</option>
                  {asignaturas.map(asignatura => (
                    <option key={asignatura} value={asignatura}>{asignatura}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>Profesor</span>
                <select
                  value={newProfesor}
                  onChange={(e) => setNewProfesor(e.target.value)}
                  required
                  style={{ 
                    padding: "10px 14px", 
                    borderRadius: 8, 
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none"
                  }}
                >
                  <option value="">Selecciona un profesor</option>
                  {profesores.map(profesor => (
                    <option key={profesor} value={profesor}>{profesor}</option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                style={{
                  width: "100%",
                  marginTop: 16,
                  padding: "12px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#92D050",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Crear Asignación
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Popup para editar asignación */}
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
          onClick={() => {
            setAsignacionToEdit(null);
            setEditClase("");
            setEditAsignatura("");
            setEditProfesor("");
          }}
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
            <form onSubmit={handleEditAsignacion}>
              <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>Clase</span>
                <select
                  value={editClase}
                  onChange={(e) => setEditClase(e.target.value)}
                  required
                  style={{ 
                    padding: "10px 14px", 
                    borderRadius: 8, 
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none"
                  }}
                >
                  <option value="">Selecciona una clase</option>
                  {clases.map(clase => (
                    <option key={clase} value={clase}>{clase}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>Asignatura</span>
                <select
                  value={editAsignatura}
                  onChange={(e) => setEditAsignatura(e.target.value)}
                  required
                  style={{ 
                    padding: "10px 14px", 
                    borderRadius: 8, 
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none"
                  }}
                >
                  <option value="">Selecciona una asignatura</option>
                  {asignaturas.map(asignatura => (
                    <option key={asignatura} value={asignatura}>{asignatura}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>Profesor</span>
                <select
                  value={editProfesor}
                  onChange={(e) => setEditProfesor(e.target.value)}
                  required
                  style={{ 
                    padding: "10px 14px", 
                    borderRadius: 8, 
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none"
                  }}
                >
                  <option value="">Selecciona un profesor</option>
                  {profesores.map(profesor => (
                    <option key={profesor} value={profesor}>{profesor}</option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                style={{
                  width: "100%",
                  marginTop: 16,
                  padding: "12px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#3b82f6",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Actualizar Asignación
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Popup de confirmación para borrar */}
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
                ¿Estás seguro de que deseas eliminar la asignación de <strong>{asignacionToDelete.profesor_id}</strong> 
                {" "}para <strong>{asignacionToDelete.asignatura}</strong> en <strong>{asignacionToDelete.clase}</strong>?
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
