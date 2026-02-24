import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { me } from "../api";

type ConfiguracionCentro = {
  pais: string;
  ccaa: string;
  provincia: string;
  municipio: string;
};

export default function Configuracion() {
  const nav = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [centroId, setCentroId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Estados para el formulario
  const [pais, setPais] = useState("");
  const [comunidadAutonoma, setComunidadAutonoma] = useState("");
  const [provincia, setProvincia] = useState("");
  const [municipio, setMunicipio] = useState("");
  
  // Estados para las opciones de los desplegables
  const [paises, setPaises] = useState<string[]>([]);
  const [comunidadesAutonomas, setComunidadesAutonomas] = useState<string[]>([]);
  const [provincias, setProvincias] = useState<string[]>([]);
  const [municipios, setMunicipios] = useState<string[]>([]);
  
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      nav("/");
      return;
    }
    
    me(jwt)
      .then(async data => {
        setUserRole(data.role);
        setCentroId(data.username);
        
        // Cargar lista de países
        const paisesResponse = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_paises`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
          },
          body: JSON.stringify({ centro_id: data.username })
        });
        
        if (paisesResponse.ok) {
          const paisesData = await paisesResponse.json();
          console.log("Respuesta listar_paises:", paisesData);
          setPaises(paisesData.paises || []);
        }
        
        // Cargar configuración existente del centro
        const configResponse = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_direcciones_centros`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
          },
          body: JSON.stringify({ centro_id: data.username })
        });
        
        if (configResponse.ok) {
          const configData = await configResponse.json();
          if (configData.direcciones && configData.direcciones.length > 0) {
            const dir = configData.direcciones[0];
            setPais(dir.pais || "");
            setComunidadAutonoma(dir.ccaa || "");
            setProvincia(dir.provincia || "");
            setMunicipio(dir.municipio || "");
            
            // Cargar las opciones en cascada si hay datos previos
            if (dir.pais) {
              await cargarComunidadesAutonomas(data.username, dir.pais);
            }
            if (dir.pais && dir.ccaa) {
              await cargarProvincias(data.username, dir.pais, dir.ccaa);
            }
            if (dir.pais && dir.ccaa && dir.provincia) {
              await cargarMunicipios(data.username, dir.pais, dir.ccaa, dir.provincia);
            }
          }
        }
        
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
      });
  }, [nav]);

  async function cargarComunidadesAutonomas(centro_id: string, paisSeleccionado: string) {
    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_ccaas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({ centro_id, pais: paisSeleccionado })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("Respuesta listar_ccaas:", data);
        if (data.ccaa && Array.isArray(data.ccaa)) {
          setComunidadesAutonomas(data.ccaa);
        } else {
          console.error("data.ccaa no es un array:", data.ccaa);
        }
      }
    } catch (error) {
      console.error("Error cargando comunidades autónomas:", error);
    }
  }

  async function cargarProvincias(centro_id: string, paisSeleccionado: string, ccaaSeleccionada: string) {
    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_provincias`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({ centro_id, pais: paisSeleccionado, ccaa: ccaaSeleccionada })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("Respuesta listar_provincias:", data);
        setProvincias(data.provincias || []);
      }
    } catch (error) {
      console.error("Error cargando provincias:", error);
    }
  }

  async function cargarMunicipios(centro_id: string, paisSeleccionado: string, ccaaSeleccionada: string, provinciaSeleccionada: string) {
    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/listar_municipios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({ centro_id, pais: paisSeleccionado, ccaa: ccaaSeleccionada, provincia: provinciaSeleccionada })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("Respuesta listar_municipios:", data);
        setMunicipios(data.municipios || []);
      }
    } catch (error) {
      console.error("Error cargando municipios:", error);
    }
  }

  function handlePaisChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nuevoPais = e.target.value;
    console.log("País seleccionado:", nuevoPais);
    setPais(nuevoPais);
    setComunidadAutonoma("");
    setProvincia("");
    setMunicipio("");
    setComunidadesAutonomas([]);
    setProvincias([]);
    setMunicipios([]);
    
    if (nuevoPais && centroId) {
      console.log("Llamando cargarComunidadesAutonomas con:", centroId, nuevoPais);
      cargarComunidadesAutonomas(centroId, nuevoPais);
    }
  }

  function handleComunidadChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nuevaCCAA = e.target.value;
    setComunidadAutonoma(nuevaCCAA);
    setProvincia("");
    setMunicipio("");
    setProvincias([]);
    setMunicipios([]);
    
    if (nuevaCCAA && pais && centroId) {
      cargarProvincias(centroId, pais, nuevaCCAA);
    }
  }

  function handleProvinciaChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nuevaProvincia = e.target.value;
    setProvincia(nuevaProvincia);
    setMunicipio("");
    setMunicipios([]);
    
    if (nuevaProvincia && pais && comunidadAutonoma && centroId) {
      cargarMunicipios(centroId, pais, comunidadAutonoma, nuevaProvincia);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    
    if (!centroId) {
      setError("No hay centro_id disponible");
      return;
    }

    if (!pais || !comunidadAutonoma || !provincia || !municipio) {
      setError("Todos los campos son obligatorios");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_BASEDATOS_BASE}/modificar_direcciones_centro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_BASEDATOS_API_KEY
        },
        body: JSON.stringify({
          centro_id: centroId,
          pais: pais,
          ccaa: comunidadAutonoma,
          provincia: provincia,
          municipio: municipio
        })
      });

      if (!response.ok) {
        throw new Error("Error al guardar la configuración");
      }
    } catch (err: any) {
      console.error("Error guardando configuración:", err);
      setError(err.message || "Error al guardar la configuración");
    } finally {
      setSaving(false);
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
            }}>Configuración</h3>
            
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
              Configure la ubicación geográfica de su centro académico. Esta información se utilizará para personalizar las salidas profesionales y contenidos educativos según su región.
            </p>

            {loading ? (
              <div style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>
                <div style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>Cargando configuración del centro...</div>
                <div style={{ fontSize: "14px" }}>Por favor espera un momento</div>
              </div>
            ) : (
              <div style={{
                background: "#ffffff",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid #e5e7eb"
              }}>
                <form onSubmit={handleSave}>
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#374151"
                    }}>
                      País *
                    </label>
                    <select
                      value={pais}
                      onChange={handlePaisChange}
                      required
                      style={{
                        width: "100%",
                        padding: "12px 40px 12px 16px",
                        fontSize: "14px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        outline: "none",
                        transition: "border-color 0.2s",
                        fontFamily: "system-ui",
                        backgroundColor: "#ffffff",
                        cursor: "pointer"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "#92D050"}
                      onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                    >
                      <option value="">Seleccione un país</option>
                      {paises.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: "24px" }}>
                    <label style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#374151"
                    }}>
                      Comunidad Autónoma *
                    </label>
                    <select
                      value={comunidadAutonoma}
                      onChange={handleComunidadChange}
                      required
                      disabled={!pais}
                      style={{
                        width: "100%",
                        padding: "12px 40px 12px 16px",
                        fontSize: "14px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        outline: "none",
                        transition: "border-color 0.2s",
                        fontFamily: "system-ui",
                        backgroundColor: pais ? "#ffffff" : "#f9fafb",
                        cursor: pais ? "pointer" : "not-allowed"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "#92D050"}
                      onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                    >
                      <option value="">Seleccione una comunidad autónoma</option>
                      {comunidadesAutonomas.map((ccaa) => (
                        <option key={ccaa} value={ccaa}>{ccaa}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: "24px" }}>
                    <label style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#374151"
                    }}>
                      Provincia *
                    </label>
                    <select
                      value={provincia}
                      onChange={handleProvinciaChange}
                      required
                      disabled={!comunidadAutonoma}
                      style={{
                        width: "100%",
                        padding: "12px 40px 12px 16px",
                        fontSize: "14px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        outline: "none",
                        transition: "border-color 0.2s",
                        fontFamily: "system-ui",
                        backgroundColor: comunidadAutonoma ? "#ffffff" : "#f9fafb",
                        cursor: comunidadAutonoma ? "pointer" : "not-allowed"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "#92D050"}
                      onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                    >
                      <option value="">Seleccione una provincia</option>
                      {provincias.map((prov) => (
                        <option key={prov} value={prov}>{prov}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: "32px" }}>
                    <label style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#374151"
                    }}>
                      Municipio *
                    </label>
                    <select
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      required
                      disabled={!provincia}
                      style={{
                        width: "100%",
                        padding: "12px 40px 12px 16px",
                        fontSize: "14px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        outline: "none",
                        transition: "border-color 0.2s",
                        fontFamily: "system-ui",
                        backgroundColor: provincia ? "#ffffff" : "#f9fafb",
                        cursor: provincia ? "pointer" : "not-allowed"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "#92D050"}
                      onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                    >
                      <option value="">Seleccione un municipio</option>
                      {municipios.map((mun) => (
                        <option key={mun} value={mun}>{mun}</option>
                      ))}
                    </select>
                  </div>

                  {error && (
                    <div style={{
                      padding: "12px 16px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "8px",
                      color: "#dc2626",
                      fontSize: "14px",
                      marginBottom: "16px"
                    }}>
                      <i className="fa-solid fa-circle-exclamation" style={{ marginRight: "8px" }}></i>
                      {error}
                    </div>
                  )}

                  {success && (
                    <div style={{
                      padding: "12px 16px",
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "8px",
                      color: "#16a34a",
                      fontSize: "14px",
                      marginBottom: "16px"
                    }}>
                      <i className="fa-solid fa-circle-check" style={{ marginRight: "8px" }}></i>
                      {success}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      width: "100%",
                      padding: "14px 24px",
                      background: saving ? "#d1d5db" : "#92D050",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: 700,
                      cursor: saving ? "not-allowed" : "pointer",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                    }}
                    onMouseEnter={(e) => {
                      if (!saving) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!saving) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                      }
                    }}
                  >
                    {saving ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: "8px" }}></i>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-save" style={{ marginRight: "8px" }}></i>
                        Guardar Configuración
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
