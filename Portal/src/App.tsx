import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Alta from "./pages/Alta";
import Portal from "./pages/Portal";
import Clases from "./pages/Clases";
import Asignaturas from "./pages/Asignaturas";
import Profesores from "./pages/Profesores";
import Alumnos from "./pages/Alumnos";
import Preferencias from "./pages/Preferencias";
import Avatar from "./pages/Avatar";
import AsignaturasAlumno from "./pages/AsignaturasAlumno";
import EjerciciosAlumno from "./pages/EjerciciosAlumno";
import MicroproyectosAlumno from "./pages/MicroproyectosAlumno";
import ContenidoAsignaturaAlumno from "./pages/ContenidoAsignaturaAlumno";
import EjerciciosAsignaturaAlumno from "./pages/EjerciciosAsignaturaAlumno";
import MicroproyectosAsignaturaAlumno from "./pages/MicroproyectosAsignaturaAlumno";
import DetalleEjercicioAlumno from "./pages/DetalleEjercicioAlumno";
import DetalleContenidoAlumno from "./pages/DetalleContenidoAlumno";
import DetalleMicroproyectoAlumno from "./pages/DetalleMicroproyectoAlumno";
import SalidasProfesionales from "./pages/SalidasProfesionales";
import Configuracion from "./pages/Configuracion";
import CurriculumsFormativos from "./pages/CurriculumsFormativos";
import Programacion from "./pages/Programacion";
import ContenidoFormativo from "./pages/ContenidoFormativo";
import Secciones from "./pages/Secciones";
import DashboardProfesor from "./pages/DashboardProfesor";
import TerminosCondiciones from "./pages/TerminosCondiciones";

function isAuthed() {
  const jwt = localStorage.getItem("jwt");
  console.log("🛡️ [APP] Verificando autenticación, JWT encontrado:", jwt ? "✅ SI (" + jwt.substring(0, 20) + "...)" : "❌ NO");
  return Boolean(jwt);
}

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const authed = isAuthed();
  console.log("🛡️ [APP] ProtectedRoute - Usuario autenticado:", authed ? "✅ SI" : "❌ NO, redirigiendo a /");
  return authed ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/alta" element={<Alta />} />
      
      <Route path="/app" element={<ProtectedRoute><Portal /></ProtectedRoute>} />
      <Route path="/clases" element={<ProtectedRoute><Clases /></ProtectedRoute>} />
      <Route path="/asignaturas" element={<ProtectedRoute><Asignaturas /></ProtectedRoute>} />
      <Route path="/profesores" element={<ProtectedRoute><Profesores /></ProtectedRoute>} />
      <Route path="/dashboard-profesor" element={<ProtectedRoute><DashboardProfesor /></ProtectedRoute>} />
      <Route path="/alumnos" element={<ProtectedRoute><Alumnos /></ProtectedRoute>} />
      <Route path="/configuracion" element={<ProtectedRoute><Configuracion /></ProtectedRoute>} />
      <Route path="/curriculums" element={<ProtectedRoute><CurriculumsFormativos /></ProtectedRoute>} />
      <Route path="/programacion" element={<ProtectedRoute><Programacion /></ProtectedRoute>} />
      <Route path="/contenido-formativo" element={<ProtectedRoute><ContenidoFormativo /></ProtectedRoute>} />
      <Route path="/secciones" element={<ProtectedRoute><Secciones /></ProtectedRoute>} />
      <Route path="/preferencias" element={<ProtectedRoute><Preferencias /></ProtectedRoute>} />
      <Route path="/avatar" element={<ProtectedRoute><Avatar /></ProtectedRoute>} />
      <Route path="/asignaturas-alumno" element={<ProtectedRoute><AsignaturasAlumno /></ProtectedRoute>} />
      <Route path="/ejercicios" element={<ProtectedRoute><EjerciciosAlumno /></ProtectedRoute>} />
      <Route path="/microproyectos" element={<ProtectedRoute><MicroproyectosAlumno /></ProtectedRoute>} />
      <Route path="/contenido-asignatura/:clase/:asignatura" element={<ProtectedRoute><ContenidoAsignaturaAlumno /></ProtectedRoute>} />
      <Route path="/ejercicios-asignatura/:clase/:asignatura" element={<ProtectedRoute><EjerciciosAsignaturaAlumno /></ProtectedRoute>} />
      <Route path="/contenido/:clase/:asignatura/:unidad" element={<ProtectedRoute><DetalleContenidoAlumno /></ProtectedRoute>} />
      <Route path="/ejercicio/:clase/:asignatura/:unidad" element={<ProtectedRoute><DetalleEjercicioAlumno /></ProtectedRoute>} />
      <Route path="/microproyectos-asignatura/:clase/:asignatura" element={<ProtectedRoute><MicroproyectosAsignaturaAlumno /></ProtectedRoute>} />
      <Route path="/microproyecto/:clase/:asignatura/:unidad" element={<ProtectedRoute><DetalleMicroproyectoAlumno /></ProtectedRoute>} />
      <Route path="/salidas-profesionales" element={<ProtectedRoute><SalidasProfesionales /></ProtectedRoute>} />
      <Route path="/terminos-condiciones" element={<ProtectedRoute><TerminosCondiciones /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
