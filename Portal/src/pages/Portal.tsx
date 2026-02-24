import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { me, createInvitation, listInvitations, deleteUser } from "../api";

type Me = { username: string; role: "centro" | "profesor" | "alumno"; centro_id?: string | null };

type Invitation = {
  username: string;
  role: string;
  created_at: string;
  password: string;
};

export default function Portal() {
  const nav = useNavigate();
  const [data, setData] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<"profesor" | "alumno">("profesor");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<"all" | "profesor" | "alumno">("all");
  const [searchText, setSearchText] = useState("");
  const [selectedInvite, setSelectedInvite] = useState<{username: string, password: string} | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🏛️ [PORTAL] Componente montado, leyendo JWT de localStorage...");
    const jwt = localStorage.getItem("jwt");
    
    if (!jwt) {
      console.log("🏛️ [PORTAL] ❌ JWT NO encontrado, redirigiendo a /");
      nav("/");
      return;
    }
    
    console.log("🏛️ [PORTAL] ✅ JWT encontrado:", jwt.substring(0, 20) + "...");
    console.log("🏛️ [PORTAL] Llamando a /me para verificar usuario...");
    
    me(jwt)
      .then(async (userData) => {
        console.log("🏛️ [PORTAL] ✅ Datos de usuario recibidos:", userData);
        setData(userData);
        
        // Redirigir profesores a /programacion
        if (userData.role === "profesor") {
          console.log("🏛️ [PORTAL] 👨‍🏫 Usuario es profesor, redirigiendo a /programacion");
          nav("/programacion");
          return;
        }
        
        // Si es centro, cargar invitaciones
        if (userData.role === "centro") {
          console.log("🏛️ [PORTAL] 🏢 Usuario es centro, cargando invitaciones...");
          const invites = await listInvitations(jwt);
          console.log("🏛️ [PORTAL] ✅ Invitaciones cargadas:", invites.length);
          setInvitations(invites);
        }
        
        setLoading(false);
        console.log("🏛️ [PORTAL] ✅ Portal cargado completamente");
      })
      .catch((e: any) => {
        console.error("🏛️ [PORTAL] ❌ ERROR al llamar a /me:", e);
        setError(e.message ?? String(e));
        setLoading(false);
      });
  }, [nav]);

  function logout() {
    localStorage.removeItem("jwt");
    nav("/");
  }

  async function handleCreateInvitation(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);

    // Cerrar popup inmediatamente
    setShowCreateForm(false);
    const username = newUsername;
    const role = newRole;
    setNewUsername("");
    setCreatingInvite(true);

    try {
      const jwt = localStorage.getItem("jwt") || "";
      await createInvitation(jwt, role, username);
      
      // Recargar invitaciones
      const invites = await listInvitations(jwt);
      setInvitations(invites);
    } catch (err: any) {
      setInviteError(err.message ?? String(err));
    } finally {
      setCreatingInvite(false);
    }
  }

  async function confirmDeleteUser() {
    if (!userToDelete) return;
    
    try {
      const jwt = localStorage.getItem("jwt") || "";
      await deleteUser(jwt, userToDelete);
      setUserToDelete(null);
      
      // Recargar invitaciones
      const invites = await listInvitations(jwt);
      setInvitations(invites);
    } catch (err: any) {
      console.error('Error al eliminar usuario:', err);
      setUserToDelete(null);
    }
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
        {/* Panel lateral de navegación - solo se muestra cuando data está disponible */}
        {!loading && data && (
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
            {data.role === "profesor" ? (
              <>
                {/* Menú para profesores */}
                <button
                  onClick={() => nav("/programacion")}
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
                  <i className="fa-solid fa-calendar-days" style={{ fontSize: "16px" }}></i>
                  Programación
                </button>
                <button
                  onClick={() => nav("/dashboard-profesor")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#374151",
                    borderRadius: "8px",
                    transition: "background 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f5f5f5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <i className="fa-solid fa-chart-line" style={{ fontSize: "16px" }}></i>
                  Dashboard
                </button>
              </>
            ) : data.role === "alumno" ? (
              <>
                {/* Menú para alumnos */}
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
                    fontWeight: 600,
                    color: "#374151",
                    borderRadius: "8px",
                    transition: "background 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f5f5f5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <i className="fa-solid fa-user" style={{ fontSize: "16px" }}></i>
                  Mi avatar
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
                  Salidas Profesionales
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
              </>
            ) : (
              <>
                {/* Menú para centros */}
                <button
                  onClick={() => nav("/app")}
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
              </>
            )}
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
        )}

        {/* Contenido principal */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#F5F5F5", overflow: "auto" }}>
      <div style={{ flex: 1, padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        {error && <div style={{ color: "crimson", padding: 16, background: "#fee2e2", borderRadius: 12, marginBottom: 16 }}>{error}</div>}
        {loading && <div style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>Cargando...</div>}

        {!loading && data && data.role === "alumno" && (
          <div>
            <h3 style={{ 
              margin: "0 0 12px 0", 
              background: "linear-gradient(135deg, #84BD00 0%, #009CA6 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 700,
              fontSize: "32px"
            }}>Mi avatar</h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
              Personaliza tu perfil y avatar digital. Aquí podrás configurar tu imagen, nombre y descripción personal para que tus compañeros y profesores te conozcan mejor. Crea una identidad única que refleje tus intereses y personalidad.
            </p>

            {/* Panel de información del alumno */}
            <div style={{ padding: 24, background: "white", border: "1px solid #e5e7eb", borderRadius: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Usuario:</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1f2937" }}>{data.username}</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Rol:</div>
                  <div style={{ fontSize: 16, color: "#1f2937" }}>Alumno</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Centro:</div>
                  <div style={{ fontSize: 16, color: "#1f2937" }}>{data.centro_id || "No asignado"}</div>
                </div>
              </div>
            </div>

            {/* Información adicional */}
            <div style={{ padding: 24, background: "white", border: "1px solid #e5e7eb", borderRadius: 16 }}>
              <h4 style={{ margin: "0 0 16px 0", fontSize: 20, fontWeight: 700, color: "#1f2937" }}>Panel de control</h4>
              <p style={{ margin: 0, fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
                Utiliza el menú de navegación lateral para acceder a tus preferencias, ver tus salidas profesionales, 
                explorar asignaturas, completar ejercicios y trabajar en microproyectos. Cada sección está diseñada 
                para ayudarte en tu proceso de aprendizaje y desarrollo profesional.
              </p>
            </div>
          </div>
        )}

        {!loading && data && data.role === "centro" && (
          <div>
            <h3 style={{ 
              margin: "0 0 12px 0", 
              background: "linear-gradient(135deg, #84BD00 0%, #009CA6 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 700,
              fontSize: "32px"
            }}>Usuarios</h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
              Gestiona los <strong style={{ color: '#92D050' }}>profesores y alumnos</strong> de tu centro educativo. Crea nuevos usuarios, visualiza sus credenciales de acceso y administra permisos. Cada usuario tendrá acceso personalizado según su <strong style={{ color: '#92D050' }}>rol asignado</strong> en la plataforma.
            </p>

            {loading ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>Cargando usuarios...</div>
                <div style={{ fontSize: "14px", color: "#6b7280" }}>Por favor espera un momento</div>
              </div>
            ) : (
              <>
            {/* Panel de filtros independiente */}
            <div style={{ padding: 16, background: "white", border: "1px solid #e5e7eb", borderRadius: 16, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr auto", gap: 20, alignItems: "end" }}>
                {/* Campo de búsqueda */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Buscar:</div>
                  <input
                    type="text"
                    placeholder="Nombre de usuario..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      fontSize: 14
                    }}
                  />
                </div>
                
                {/* Filtros por rol */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Tipo de usuario:</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      onClick={() => setFilterRole("all")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: filterRole === "all" ? "#92D050" : "white",
                        color: filterRole === "all" ? "white" : "#374151",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer"
                      }}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setFilterRole("profesor")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: filterRole === "profesor" ? "#92D050" : "white",
                        color: filterRole === "profesor" ? "white" : "#374151",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer"
                      }}
                    >
                      Profesores
                    </button>
                    <button
                      onClick={() => setFilterRole("alumno")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: filterRole === "alumno" ? "#92D050" : "white",
                        color: filterRole === "alumno" ? "white" : "#374151",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer"
                      }}
                    >
                      Alumnos
                    </button>
                  </div>
                </div>

                {/* Botón crear usuario */}
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: "#92D050",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  Crear Usuario
                </button>
              </div>
            </div>

            {/* Contenedor con scroll solo para listado de usuarios */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, maxHeight: "550px", overflow: "hidden", background: "white" }}>
              <div style={{ padding: 16, maxHeight: "550px", overflowY: "auto" }}>
              {invitations.filter(inv => 
                  (filterRole === "all" || inv.role === filterRole) &&
                  (searchText === "" || inv.username.toLowerCase().includes(searchText.toLowerCase()))
                ).length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>
                    No se encontraron usuarios con los filtros aplicados
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {invitations.filter(inv => 
                      (filterRole === "all" || inv.role === filterRole) &&
                      (searchText === "" || inv.username.toLowerCase().includes(searchText.toLowerCase()))
                    ).map((inv, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 20,
                          background: "#F5F5F5",
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          justifyContent: "space-between"
                        }}
                      >
                        <div style={{ display: "flex", gap: 16, alignItems: "center", flex: 1 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{inv.username}</div>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>{inv.role}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => setSelectedInvite({ username: inv.username, password: inv.password })}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 6,
                              border: "none",
                              background: "#92D050",
                              color: "white",
                              fontSize: 16,
                              cursor: "pointer",
                              fontWeight: 600
                            }}
                            title="Ver contraseña"
                          >
                            🔑
                          </button>
                          <button
                            onClick={() => setUserToDelete(inv.username)}
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
                            title="Eliminar usuario"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

        {/* Popup para mostrar URL y QR */}
          {selectedInvite && (
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
              onClick={() => setSelectedInvite(null)}
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
                <h3 style={{ marginTop: 0, marginBottom: 24, textAlign: "center" }}>
                  Credenciales de acceso
                </h3>
                
                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontWeight: 600, fontSize: 14, color: "#374151", display: "block", marginBottom: 8 }}>
                    Usuario:
                  </label>
                  <div style={{
                    padding: 12,
                    background: "#f3f4f6",
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 600,
                    border: "1px solid #e5e7eb"
                  }}>
                    {selectedInvite.username}
                  </div>
                </div>

                <div>
                  <label style={{ fontWeight: 600, fontSize: 14, color: "#374151", display: "block", marginBottom: 8 }}>
                    Contraseña:
                  </label>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{
                      flex: 1,
                      padding: 12,
                      background: "#fef3c7",
                      borderRadius: 8,
                      wordBreak: "break-all",
                      fontSize: 14,
                      fontFamily: "monospace",
                      border: "2px solid #f59e0b"
                    }}>
                      {selectedInvite.password}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedInvite.password);
                        setSelectedInvite(null);
                      }}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: "#92D050",
                        color: "white",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 16,
                        whiteSpace: "nowrap"
                      }}
                      title="Copiar contraseña"
                    >
                      📋
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Popup de confirmación para eliminar usuario */}
          {userToDelete && (
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
              onClick={() => setUserToDelete(null)}
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
                    ¿Estás seguro de que deseas eliminar el usuario <strong>{userToDelete}</strong>?
                  </p>
                  <p style={{ margin: "12px 0 0 0", fontSize: 14, color: "#ef4444", lineHeight: 1.6 }}>
                    Esta acción no se puede deshacer y se perderán todos los datos asociados a este usuario.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button
                    onClick={() => setUserToDelete(null)}
                    style={{
                      padding: "10px 24px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "white",
                      color: "#374151",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: 14
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDeleteUser}
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

          {/* Modal Crear Usuario */}
          {showCreateForm && (
            <div
              onClick={() => setShowCreateForm(false)}
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
                zIndex: 2000
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "white",
                  borderRadius: 16,
                  padding: 24,
                  width: "90%",
                  maxWidth: 500,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
                }}
              >
                <form onSubmit={handleCreateInvitation} style={{ display: "grid", gap: 16 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Rol</span>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as "profesor" | "alumno")}
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}
                    >
                      <option value="profesor">Profesor</option>
                      <option value="alumno">Alumno</option>
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Usuario</span>
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      required
                      minLength={5}
                      pattern="^[a-zA-Z0-9_]+$"
                      placeholder="Ej: r_armero, m_amat, j_ingles, ..."
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      Mínimo 5 caracteres. Solo letras, números y guion bajo (_)
                    </span>
                  </label>

                  {inviteError && (
                    <div style={{ color: "#ef4444", background: "#fee2e2", padding: 12, borderRadius: 8 }}>
                      {inviteError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={creatingInvite}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "#92D050",
                      color: "white",
                      fontWeight: 600,
                      cursor: creatingInvite ? "not-allowed" : "pointer",
                      opacity: creatingInvite ? 0.7 : 1
                    }}
                  >
                    {creatingInvite ? "Creando..." : "Crear Usuario"}
                  </button>
                </form>
              </div>
            </div>
          )}
          </>
          )}
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ padding: 16, border: "1px solid #e5e5e5", borderRadius: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "#444" }}>{desc}</div>
    </div>
  );
}
