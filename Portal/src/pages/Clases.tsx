import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

type Clase = {
  id: string;
  nombre: string; // "1 ESO", "2 ESO", "3 ESO", etc.
};

export default function Clases() {
  const nav = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [clases, setClases] = useState<Clase[]>([]);
  const [showCreateClase, setShowCreateClase] = useState(false);
  const [newClaseNombre, setNewClaseNombre] = useState("");
  const [claseToDelete, setClaseToDelete] = useState<{id: string, nombre: string} | null>(null);
  const [claseToEdit, setClaseToEdit] = useState<{id: string, nombre: string, nombreAntiguo: string} | null>(null);
  const [editClaseNombre, setEditClaseNombre] = useState("");
  const [loading, setLoading] = useState(true);

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
        // Cargar clases existentes
        return fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_clases`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
          },
          body: JSON.stringify({ centro_id: data.username })
        });
      })
      .then(response => {
        if (response && response.ok) {
          return response.json();
        }
        throw new Error("Error al listar clases");
      })
      .then(data => {
        console.log("Clases cargadas:", data);
        // Convertir las clases de BigQuery al formato local
        if (data.clases && Array.isArray(data.clases)) {
          const clasesFormateadas = data.clases.map((c: string) => ({
            id: c,
            nombre: c
          }));
          setClases(clasesFormateadas);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
        if (error.message !== "Error al listar clases") {
          localStorage.removeItem("jwt");
          nav("/");
        }
      });
  }, [nav]);

  async function handleCreateClase(e: React.FormEvent) {
    e.preventDefault();
    if (!centroId) {
      alert("No hay centro_id disponible");
      return;
    }

    // Validar si ya existe una clase con ese nombre
    const nombreClase = newClaseNombre.trim();
    const claseExistente = clases.find(c => c.nombre.toLowerCase() === nombreClase.toLowerCase());
    if (claseExistente) {
      alert(`Ya existe una clase con el nombre "${nombreClase}". Por favor, elige un nombre diferente.`);
      return;
    }

    // Cerrar popup inmediatamente para evitar doble click
    setShowCreateClase(false);
    setNewClaseNombre("");

    console.log("Creando clase:", { centro_id: centroId, clase: nombreClase });

    try {
      // Llamar a BaseDatos API
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/crear_clase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          clase: nombreClase
        })
      });


      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Error al crear clase: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Response data:", data);

      const nuevaClase: Clase = {
        id: Date.now().toString(),
        nombre: nombreClase
      };
      setClases([...clases, nuevaClase]);
    } catch (error) {
      console.error("Error completo:", error);
      alert(`Error al crear la clase: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function confirmDeleteClase() {
    if (!claseToDelete || !centroId) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/borrar_clase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          clase: claseToDelete.nombre
        })
      });

      if (!response.ok) throw new Error("Error al borrar clase");

      setClases(clases.filter(c => c.id !== claseToDelete.id));
      setClaseToDelete(null);
    } catch (error) {
      console.error("Error borrando clase:", error);
      alert("Error al borrar la clase");
      setClaseToDelete(null);
    }
  }

  async function handleEditClase(e: React.FormEvent) {
    e.preventDefault();
    if (!claseToEdit || !centroId) return;

    // Validar si ya existe otra clase con ese nombre
    const nombreClase = editClaseNombre.trim();
    const claseExistente = clases.find(c => 
      c.nombre.toLowerCase() === nombreClase.toLowerCase() && c.id !== claseToEdit.id
    );
    if (claseExistente) {
      alert(`Ya existe una clase con el nombre "${nombreClase}". Por favor, elige un nombre diferente.`);
      return;
    }

    // Cerrar popup inmediatamente
    const claseEditando = claseToEdit;
    setClaseToEdit(null);
    setEditClaseNombre("");

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/actualizar_clase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          clase: nombreClase,
          clase_antigua: claseEditando.nombreAntiguo
        })
      });

      if (!response.ok) throw new Error("Error al actualizar clase");

      setClases(clases.map(c => 
        c.id === claseEditando.id ? { ...c, nombre: nombreClase } : c
      ));
    } catch (error) {
      console.error("Error actualizando clase:", error);
      alert("Error al actualizar la clase");
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
        }}>Clases</h3>
        <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
          Organiza y gestiona las <strong style={{ color: '#92D050' }}>clases o grupos</strong> de tu centro. Crea nuevas clases, edita la información existente y elimina aquellas que ya no sean necesarias. Una buena <strong style={{ color: '#92D050' }}>organización de clases</strong> facilita la asignación posterior de profesores y alumnos.
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>Cargando clases...</div>
            <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
          </div>
        ) : (
          <>
        {/* Panel de búsqueda independiente */}
        <div style={{ 
          padding: 16, 
          background: "white", 
          border: "1px solid #e5e7eb", 
          borderRadius: 16, 
          marginBottom: 16 
        }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Buscar:</div>
              <input
                type="text"
                placeholder="Nombre de la clase..."
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
              onClick={() => setShowCreateClase(!showCreateClase)}
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
              Crear Clase
            </button>
          </div>
        </div>

        {/* Panel de listado independiente */}
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
            {clases.length === 0 ? (
              <div style={{ 
                padding: 48, 
                textAlign: "center", 
                color: "#9ca3af",
                background: "#f9fafb",
                borderRadius: 12,
                border: "2px dashed #e5e7eb"
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No hay clases creadas</div>
                <div style={{ fontSize: 14 }}>Crea tu primera clase para comenzar</div>
              </div>
            ) : (
              clases
                .filter(clase => clase.nombre.toLowerCase().includes(searchText.toLowerCase()))
                .map((clase) => (
                  <div key={clase.id} style={{ 
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
                        margin: "0", 
                        color: "#111827",
                        fontSize: 18,
                        fontWeight: 700
                      }}>{clase.nombre}</h4>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => {
                          setClaseToEdit({
                            id: clase.id,
                            nombre: clase.nombre,
                            nombreAntiguo: clase.nombre
                          });
                          setEditClaseNombre(clase.nombre);
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
                        title="Editar clase"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setClaseToDelete({id: clase.id, nombre: clase.nombre})}
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
                        title="Eliminar clase"
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

      {/* Popup para crear clase */}
      {showCreateClase && (
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
          onClick={() => setShowCreateClase(false)}
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
            <form onSubmit={handleCreateClase}>
              <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>Nombre de la Clase</span>
                <input
                  value={newClaseNombre}
                  onChange={(e) => setNewClaseNombre(e.target.value)}
                  required
                  minLength={5}
                  maxLength={50}
                  placeholder="Ej: 1º ESO A, 2º ESO B, 3º ESO C, ..."
                  autoFocus
                  style={{ 
                    padding: "10px 14px", 
                    borderRadius: 8, 
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none"
                  }}
                />
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Mínimo 5 caracteres
                </span>
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
                Crear Clase
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Popup para editar clase */}
      {claseToEdit && (
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
            setClaseToEdit(null);
            setEditClaseNombre("");
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
            <form onSubmit={handleEditClase}>
              <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>Nombre de la Clase</span>
                <input
                  value={editClaseNombre}
                  onChange={(e) => setEditClaseNombre(e.target.value)}
                  required
                  minLength={5}
                  maxLength={50}
                  placeholder="Ej: 1º ESO A, 2º ESO B, 3º ESO C, ..."
                  autoFocus
                  style={{ 
                    padding: "10px 14px", 
                    borderRadius: 8, 
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none"
                  }}
                />
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Mínimo 5 caracteres
                </span>
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
                Actualizar Clase
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Popup de confirmación para eliminar clase */}
      {claseToDelete && (
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
          onClick={() => setClaseToDelete(null)}
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
                ¿Estás seguro de que deseas eliminar la clase <strong>{claseToDelete.nombre}</strong>?
              </p>
              <p style={{ margin: "12px 0 0 0", fontSize: 14, color: "#ef4444", lineHeight: 1.6 }}>
                Esta acción no se puede deshacer y se eliminarán todas las asignaturas asociadas a esta clase.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={confirmDeleteClase}
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
