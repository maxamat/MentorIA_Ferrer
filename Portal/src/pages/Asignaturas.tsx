import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

type Asignatura = {
  id: string;
  nombre: string; // "Matemáticas", "Lengua", "Inglés", etc.
  imagebase64: string; // Imagen en formato base64
  descripcion: string; // Descripción de la asignatura
};

export default function Asignaturas() {
  const nav = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [showCreateAsignatura, setShowCreateAsignatura] = useState(false);
  const [newAsignaturaNombre, setNewAsignaturaNombre] = useState("");
  const [newAsignaturaImage, setNewAsignaturaImage] = useState<string>("");
  const [newAsignaturaDescripcion, setNewAsignaturaDescripcion] = useState("");
  const [asignaturaToDelete, setAsignaturaToDelete] = useState<{id: string, nombre: string} | null>(null);
  const [asignaturaToEdit, setAsignaturaToEdit] = useState<{id: string, nombre: string, nombreAntiguo: string, imagebase64: string, descripcion: string} | null>(null);
  const [editAsignaturaNombre, setEditAsignaturaNombre] = useState("");
  const [editAsignaturaImage, setEditAsignaturaImage] = useState<string>("");
  const [editAsignaturaDescripcion, setEditAsignaturaDescripcion] = useState("");
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
        // Cargar asignaturas existentes
        return fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_asignaturas`, {
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
        throw new Error("Error al listar asignaturas");
      })
      .then(data => {
        console.log("Asignaturas cargadas:", data);
        // Convertir las asignaturas de BigQuery al formato local
        if (data.asignaturas && Array.isArray(data.asignaturas)) {
          const asignaturasFormateadas = data.asignaturas.map((a: string, index: number) => ({
            id: a,
            nombre: a,
            imagebase64: data.imagebase64 && data.imagebase64[index] ? data.imagebase64[index] : "",
            descripcion: data.descripcion && data.descripcion[index] ? data.descripcion[index] : ""
          }));
          setAsignaturas(asignaturasFormateadas);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
        if (error.message !== "Error al listar asignaturas") {
          localStorage.removeItem("jwt");
          nav("/");
        }
      });
  }, [nav]);

  async function handleCreateAsignatura(e: React.FormEvent) {
    e.preventDefault();
    if (!centroId || !newAsignaturaImage) {
      alert("Por favor, selecciona una imagen PNG para la asignatura");
      return;
    }

    // Validar si ya existe una asignatura con ese nombre
    const nombreAsignatura = newAsignaturaNombre.trim();
    const asignaturaExistente = asignaturas.find(a => a.nombre.toLowerCase() === nombreAsignatura.toLowerCase());
    if (asignaturaExistente) {
      alert(`Ya existe una asignatura con el nombre "${nombreAsignatura}". Por favor, elige un nombre diferente.`);
      return;
    }

    // Cerrar popup inmediatamente
    setShowCreateAsignatura(false);
    const imagenBase64 = newAsignaturaImage;
    const descripcionAsignatura = newAsignaturaDescripcion.trim();
    setNewAsignaturaNombre("");
    setNewAsignaturaImage("");
    setNewAsignaturaDescripcion("");

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/crear_asignatura`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          asignatura: nombreAsignatura,
          imagebase64: imagenBase64,
          descripcion: descripcionAsignatura
        })
      });

      if (!response.ok) throw new Error("Error al crear asignatura");

      const nuevaAsignatura: Asignatura = {
        id: Date.now().toString(),
        nombre: nombreAsignatura,
        imagebase64: imagenBase64,
        descripcion: descripcionAsignatura
      };
      setAsignaturas([...asignaturas, nuevaAsignatura]);
    } catch (error) {
      console.error("Error creando asignatura:", error);
      alert("Error al crear la asignatura");
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona una imagen válida');
      return;
    }

    // Validar tamaño del archivo (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Por favor, selecciona una imagen menor a 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Redimensionar la imagen a un máximo de 200x200 píxeles
        const MAX_SIZE = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        // Crear canvas para redimensionar y comprimir
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          alert('Error al procesar la imagen');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir a base64 con compresión (JPEG con calidad 0.7 para reducir tamaño)
        const base64String = canvas.toDataURL('image/jpeg', 0.7);
        
        // Validar el tamaño del base64 resultante (máximo ~100KB)
        if (base64String.length > 150000) {
          alert('La imagen procesada sigue siendo muy grande. Por favor, usa una imagen más pequeña o con menos detalles');
          return;
        }

        setNewAsignaturaImage(base64String);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleEditImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona una imagen válida');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Por favor, selecciona una imagen menor a 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_SIZE = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          alert('Error al procesar la imagen');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const base64String = canvas.toDataURL('image/jpeg', 0.7);
        
        if (base64String.length > 150000) {
          alert('La imagen procesada sigue siendo muy grande. Por favor, usa una imagen más pequeña o con menos detalles');
          return;
        }

        setEditAsignaturaImage(base64String);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function confirmDeleteAsignatura() {
    if (!asignaturaToDelete || !centroId) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/borrar_asignatura`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          asignatura: asignaturaToDelete.nombre
        })
      });

      if (!response.ok) throw new Error("Error al borrar asignatura");

      setAsignaturas(asignaturas.filter(a => a.id !== asignaturaToDelete.id));
      setAsignaturaToDelete(null);
    } catch (error) {
      console.error("Error borrando asignatura:", error);
      alert("Error al borrar la asignatura");
      setAsignaturaToDelete(null);
    }
  }

  async function handleEditAsignatura(e: React.FormEvent) {
    e.preventDefault();
    if (!asignaturaToEdit || !centroId) return;

    // Validar si ya existe otra asignatura con ese nombre
    const nombreAsignatura = editAsignaturaNombre.trim();
    const asignaturaExistente = asignaturas.find(a => 
      a.nombre.toLowerCase() === nombreAsignatura.toLowerCase() && a.id !== asignaturaToEdit.id
    );
    if (asignaturaExistente) {
      alert(`Ya existe una asignatura con el nombre "${nombreAsignatura}". Por favor, elige un nombre diferente.`);
      return;
    }

    // Cerrar popup inmediatamente
    const asignaturaEditando = asignaturaToEdit;
    const nuevaImagen = editAsignaturaImage || asignaturaToEdit.imagebase64;
    const nuevaDescripcion = editAsignaturaDescripcion.trim() || asignaturaToEdit.descripcion;
    setAsignaturaToEdit(null);
    setEditAsignaturaNombre("");
    setEditAsignaturaImage("");
    setEditAsignaturaDescripcion("");

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/actualizar_asignatura`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          asignatura: nombreAsignatura,
          asignatura_antigua: asignaturaEditando.nombreAntiguo,
          imagebase64: editAsignaturaImage || null,
          descripcion: nuevaDescripcion
        })
      });

      if (!response.ok) throw new Error("Error al actualizar asignatura");

      setAsignaturas(asignaturas.map(a => 
        a.id === asignaturaEditando.id 
          ? { ...a, nombre: nombreAsignatura, imagebase64: nuevaImagen, descripcion: nuevaDescripcion } 
          : a
      ));
    } catch (error) {
      console.error("Error actualizando asignatura:", error);
      alert("Error al actualizar la asignatura");
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
        }}>Asignaturas</h3>
        <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
          Administra el <strong style={{ color: '#92D050' }}>catálogo de asignaturas</strong> disponibles en tu centro educativo. Añade nuevas materias, modifica sus nombres o elimina aquellas que ya no se impartan. Las asignaturas creadas aquí podrán ser asignadas posteriormente a <strong style={{ color: '#92D050' }}>clases y profesores</strong> específicos.
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>Cargando asignaturas...</div>
            <div style={{ fontSize: "14px", color: "#6b7280" }}>Por favor espera un momento</div>
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
                placeholder="Nombre de la asignatura..."
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
              onClick={() => setShowCreateAsignatura(!showCreateAsignatura)}
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
              Crear Asignatura
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
            {loading ? (
              <div style={{ 
                padding: 48, 
                textAlign: "center", 
                color: "#6b7280",
                fontSize: 16
              }}>
                Cargando asignaturas...
              </div>
            ) : asignaturas.length === 0 ? (
              <div style={{ 
                padding: 48, 
                textAlign: "center", 
                color: "#9ca3af",
                background: "#f9fafb",
                borderRadius: 12,
                border: "2px dashed #e5e7eb"
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No hay asignaturas creadas</div>
                <div style={{ fontSize: 14 }}>Crea tu primera asignatura para comenzar</div>
              </div>
            ) : (
              asignaturas
                .filter(asignatura => asignatura.nombre.toLowerCase().includes(searchText.toLowerCase()))
                .map((asignatura) => (
                  <div key={asignatura.id} style={{ 
                    padding: 20, 
                    background: "#F5F5F5", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: 12,
                    transition: "box-shadow 0.2s",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16
                  }}>
                    {asignatura.imagebase64 && (
                      <img 
                        src={asignatura.imagebase64} 
                        alt={asignatura.nombre}
                        style={{
                          width: 60,
                          height: 60,
                          objectFit: "cover",
                        }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <h4 style={{ 
                        margin: "0", 
                        color: "#111827",
                        fontSize: 18,
                        fontWeight: 700
                      }}>{asignatura.nombre}</h4>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => {
                          setAsignaturaToEdit({
                            id: asignatura.id,
                            nombre: asignatura.nombre,
                            nombreAntiguo: asignatura.nombre,
                            imagebase64: asignatura.imagebase64,
                            descripcion: asignatura.descripcion
                          });
                          setEditAsignaturaNombre(asignatura.nombre);
                          setEditAsignaturaImage("");
                          setEditAsignaturaDescripcion(asignatura.descripcion);
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
                        title="Editar asignatura"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setAsignaturaToDelete({id: asignatura.id, nombre: asignatura.nombre})}
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
                        title="Eliminar asignatura"
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

      {/* Popup modal para crear asignatura */}
      {showCreateAsignatura && (
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
            zIndex: 1000
          }}
          onClick={() => setShowCreateAsignatura(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 32,
              minWidth: 400,
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreateAsignatura}>
              <label style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  Nombre de la Asignatura
                </span>
                <input
                  value={newAsignaturaNombre}
                  onChange={(e) => setNewAsignaturaNombre(e.target.value)}
                  required
                  minLength={5}
                  maxLength={50}
                  autoFocus
                  placeholder="Ej: Matemáticas, Lengua, Inglés..."
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
              <label style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  Descripción de la Asignatura
                </span>
                <textarea
                  value={newAsignaturaDescripcion}
                  onChange={(e) => setNewAsignaturaDescripcion(e.target.value)}
                  required
                  minLength={10}
                  maxLength={500}
                  rows={4}
                  placeholder="Describe brevemente la asignatura..."
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none",
                    fontFamily: "system-ui",
                    resize: "vertical"
                  }}
                />
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Mínimo 10 caracteres, máximo 500
                </span>
              </label>
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  Imagen de la Asignatura
                </span>
                <input
                  type="file"
                  accept="image/png"
                  onChange={handleImageUpload}
                  required
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none"
                  }}
                />
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  La imagen se redimensionará automáticamente a 200x200 píxeles
                </span>
                {newAsignaturaImage && (
                  <div style={{ marginTop: 8, textAlign: "center" }}>
                    <img 
                      src={newAsignaturaImage} 
                      alt="Preview" 
                      style={{ 
                        maxWidth: "100%", 
                        maxHeight: 150, 
                        borderRadius: 8,
                        border: "1px solid #d1d5db"
                      }} 
                    />
                  </div>
                )}
              </label>
              <button
                type="submit"
                style={{
                  width: "100%",
                  marginTop: 24,
                  padding: "12px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#92D050",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Crear Asignatura
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Popup modal para editar asignatura */}
      {asignaturaToEdit && (
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
            zIndex: 1000
          }}
          onClick={() => {
            setAsignaturaToEdit(null);
            setEditAsignaturaNombre("");
            setEditAsignaturaImage("");
            setEditAsignaturaDescripcion("");
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 32,
              minWidth: 400,
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleEditAsignatura}>
              <label style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  Nombre de la Asignatura
                </span>
                <input
                  value={editAsignaturaNombre}
                  onChange={(e) => setEditAsignaturaNombre(e.target.value)}
                  required
                  minLength={5}
                  maxLength={50}
                  autoFocus
                  placeholder="Ej: Matemáticas, Lengua, Inglés..."
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
              <label style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  Descripción de la Asignatura
                </span>
                <textarea
                  value={editAsignaturaDescripcion}
                  onChange={(e) => setEditAsignaturaDescripcion(e.target.value)}
                  minLength={10}
                  maxLength={500}
                  rows={4}
                  placeholder={asignaturaToEdit?.descripcion || "Describe brevemente la asignatura..."}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none",
                    fontFamily: "system-ui",
                    resize: "vertical"
                  }}
                />
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Dejar vacío para mantener la descripción actual
                </span>
              </label>
              <label style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  Imagen de la Asignatura (opcional)
                </span>
                <input
                  type="file"
                  accept="image/png"
                  onChange={handleEditImageUpload}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none"
                  }}
                />
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Dejar vacío para mantener la imagen actual
                </span>
                {/* Vista previa de la imagen actual o nueva */}
                {(editAsignaturaImage || asignaturaToEdit.imagebase64) && (
                  <div style={{ marginTop: 8, textAlign: "center" }}>
                    <img 
                      src={editAsignaturaImage || asignaturaToEdit.imagebase64} 
                      alt="Preview" 
                      style={{ 
                        maxWidth: "100%", 
                        maxHeight: 150, 
                        borderRadius: 8,
                        border: "1px solid #d1d5db"
                      }} 
                    />
                  </div>
                )}
              </label>
              <button
                type="submit"
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "12px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#3b82f6",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Actualizar Asignatura
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Popup de confirmación para eliminar asignatura */}
      {asignaturaToDelete && (
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
          onClick={() => setAsignaturaToDelete(null)}
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
                ¿Estás seguro de que deseas eliminar la asignatura <strong>{asignaturaToDelete.nombre}</strong>?
              </p>
              <p style={{ margin: "12px 0 0 0", fontSize: 14, color: "#ef4444", lineHeight: 1.6 }}>
                Esta acción no se puede deshacer.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={confirmDeleteAsignatura}
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
