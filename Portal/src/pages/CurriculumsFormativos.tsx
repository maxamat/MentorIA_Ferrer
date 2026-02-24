import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

type Curriculum = {
  nombre: string;
  fecha: string;
  descripcion: string;
  metaprompt: string;
};

export default function CurriculumsFormativos() {
  const nav = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [newCurriculumNombre, setNewCurriculumNombre] = useState("");
  const [newCurriculumDescripcion, setNewCurriculumDescripcion] = useState("");
  const [newCurriculumMetaprompt, setNewCurriculumMetaprompt] = useState("");
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [curriculumToDelete, setCurriculumToDelete] = useState<{nombre: string} | null>(null);
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
        
        // Cargar curriculums existentes
        return fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_curriculums`, {
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
        throw new Error("Error al listar curriculums");
      })
      .then(data => {
        console.log("Curriculums cargados:", data);
        if (data.curriculums && Array.isArray(data.curriculums)) {
          setCurriculums(data.curriculums);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
        if (error.message !== "Error al listar curriculums") {
          localStorage.removeItem("jwt");
          nav("/");
        }
      });
  }, [nav]);

  async function handleUploadCurriculum(e: React.FormEvent) {
    e.preventDefault();
    if (!centroId || !uploadingFile) {
      alert("Por favor, selecciona un archivo PDF");
      return;
    }

    // Validar si ya existe un curriculum con ese nombre
    const nombreCurriculum = newCurriculumNombre.trim();
    const curriculumExistente = curriculums.find(c => c.nombre.toLowerCase() === nombreCurriculum.toLowerCase());
    if (curriculumExistente) {
      alert(`Ya existe un curriculum con el nombre "${nombreCurriculum}". Por favor, elige un nombre diferente.`);
      return;
    }

    setShowUploadForm(false);

    try {
      // Convertir PDF a base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64String = event.target?.result as string;
        const base64Data = base64String.split(',')[1];

        const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/crear_curriculums`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
          },
          body: JSON.stringify({
            centro_id: centroId,
            nombre: nombreCurriculum,
            descripcion: newCurriculumDescripcion,
            metaprompt: newCurriculumMetaprompt,
            base64_pdf: base64Data
          })
        });

        if (!response.ok) throw new Error("Error al subir curriculum");

        // Recargar lista de curriculums
        const listarResponse = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_curriculums`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
          },
          body: JSON.stringify({ centro_id: centroId })
        });

        if (listarResponse.ok) {
          const data = await listarResponse.json();
          if (data.curriculums && Array.isArray(data.curriculums)) {
            setCurriculums(data.curriculums);
          }
        }

        setNewCurriculumNombre("");
        setNewCurriculumDescripcion("");
        setNewCurriculumMetaprompt("");
        setUploadingFile(null);
      };

      reader.onerror = () => {
        alert("Error al leer el archivo");
      };

      reader.readAsDataURL(uploadingFile);
    } catch (error) {
      console.error("Error subiendo curriculum:", error);
      alert("Error al subir el curriculum");
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor, selecciona un archivo PDF válido');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Por favor, selecciona un PDF menor a 10MB');
      return;
    }

    setUploadingFile(file);
    if (!newCurriculumNombre) {
      setNewCurriculumNombre(file.name.replace('.pdf', ''));
    }
  }

  async function confirmDeleteCurriculum() {
    if (!curriculumToDelete || !centroId) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/borrar_curriculums`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          nombre: curriculumToDelete.nombre
        })
      });

      if (!response.ok) throw new Error("Error al eliminar curriculum");

      setCurriculums(curriculums.filter(c => c.nombre !== curriculumToDelete.nombre));
      setCurriculumToDelete(null);
    } catch (error) {
      console.error("Error eliminando curriculum:", error);
      alert("Error al eliminar el curriculum");
    }
  }

  const filteredCurriculums = curriculums.filter(c =>
    c.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
    c.description.toLowerCase().includes(searchText.toLowerCase())
  );

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
            }}>Curriculums Formativos</h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
              Gestiona los <strong style={{ color: '#92D050' }}>documentos curriculares oficiales</strong> de tu centro educativo. Sube, consulta y elimina archivos PDF con los programas formativos y planes de estudio.
            </p>

            {loading ? (
              <div style={{ textAlign: "center", padding: 32, color: "#1f2937" }}>
                <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: 12 }}>Cargando curriculums...</div>
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
                        placeholder="Nombre o descripción..."
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
                      onClick={() => setShowUploadForm(!showUploadForm)}
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
                      Subir Curriculum
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
                      {filteredCurriculums.length === 0 ? (
                        <div style={{ 
                          padding: 48, 
                          textAlign: "center", 
                          color: "#9ca3af",
                          background: "#f9fafb",
                          borderRadius: 12,
                          border: "2px dashed #e5e7eb"
                        }}>
                          <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No hay curriculums disponibles</div>
                          <div style={{ fontSize: 14 }}>Sube tu primer curriculum para comenzar</div>
                        </div>
                      ) : (
                        filteredCurriculums.map((curriculum) => (
                          <div key={curriculum.nombre} style={{ 
                            padding: 20, 
                            background: "#F5F5F5", 
                            border: "1px solid #e5e7eb", 
                            borderRadius: 12,
                            transition: "box-shadow 0.2s",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ 
                                margin: "0 0 8px 0", 
                                color: "#111827",
                                fontSize: 18,
                                fontWeight: 700
                              }}>
                                <i className="fa-solid fa-file-pdf" style={{ marginRight: 8, color: "#92D050" }}></i>
                                {curriculum.nombre}
                              </h4>
                              <p style={{ margin: "0 0 8px 0", fontSize: 14, color: "#374151" }}>
                                <strong>Descripción:</strong> {curriculum.descripcion}
                              </p>
                              <p style={{ margin: "0 0 4px 0", fontSize: 14, color: "#374151", fontStyle: "italic" }}>
                                <strong>Metaprompt:</strong> {curriculum.metaprompt}
                              </p>
                              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                                Creado: {new Date(curriculum.fecha).toLocaleDateString('es-ES', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                onClick={() => setCurriculumToDelete({nombre: curriculum.nombre})}
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
                                title="Eliminar curriculum"
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

                {/* Popup para subir curriculum */}
                {showUploadForm && (
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
                    onClick={() => setShowUploadForm(false)}
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
                      <form onSubmit={handleUploadCurriculum}>
                        <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                          <span style={{ fontWeight: 600, color: "#374151" }}>Nombre del Curriculum</span>
                          <input
                            value={newCurriculumNombre}
                            onChange={(e) => setNewCurriculumNombre(e.target.value)}
                            required
                            minLength={3}
                            maxLength={100}
                            placeholder="Ej: Curriculum ESO 2024"
                            autoFocus
                            style={{ 
                              padding: "10px 14px", 
                              borderRadius: 8, 
                              border: "1px solid #d1d5db",
                              fontSize: 14,
                              outline: "none"
                            }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                          <span style={{ fontWeight: 600, color: "#374151" }}>Descripción</span>
                          <textarea
                            value={newCurriculumDescripcion}
                            onChange={(e) => setNewCurriculumDescripcion(e.target.value)}
                            required
                            minLength={5}
                            maxLength={500}
                            placeholder="Breve descripción del curriculum..."
                            rows={3}
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
                        </label>

                        <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                          <span style={{ fontWeight: 600, color: "#374151" }}>Metaprompt</span>
                          <textarea
                            value={newCurriculumMetaprompt}
                            onChange={(e) => setNewCurriculumMetaprompt(e.target.value)}
                            required
                            minLength={10}
                            maxLength={2000}
                            placeholder="Instrucciones para el procesamiento del curriculum..."
                            rows={4}
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
                            Define cómo debe procesarse este curriculum
                          </span>
                        </label>

                        <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                          <span style={{ fontWeight: 600, color: "#374151" }}>Archivo PDF</span>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileUpload}
                            required
                            style={{ 
                              padding: "10px 14px", 
                              borderRadius: 8, 
                              border: "1px solid #d1d5db",
                              fontSize: 14
                            }}
                          />
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            Máximo 10 MB
                          </span>
                        </label>

                        <button
                          type="submit"
                          disabled={!uploadingFile}
                          style={{
                            width: "100%",
                            marginTop: 16,
                            padding: "12px 20px",
                            borderRadius: 8,
                            border: "none",
                            background: uploadingFile ? "#92D050" : "#d1d5db",
                            color: "white",
                            fontWeight: 600,
                            cursor: uploadingFile ? "pointer" : "not-allowed"
                          }}
                        >
                          Subir Curriculum
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* Popup de confirmación para eliminar curriculum */}
                {curriculumToDelete && (
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
                    onClick={() => setCurriculumToDelete(null)}
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
                          ¿Estás seguro de que deseas eliminar el curriculum <strong>{curriculumToDelete.nombre}</strong>?
                        </p>
                        <p style={{ margin: "12px 0 0 0", fontSize: 14, color: "#ef4444", lineHeight: 1.6 }}>
                          Esta acción no se puede deshacer y se eliminará el archivo PDF del servidor.
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                        <button
                          onClick={confirmDeleteCurriculum}
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
