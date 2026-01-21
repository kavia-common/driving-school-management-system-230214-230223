import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import ThemeProvider from "./theme/ThemeProvider";
import AdminLayout from "./layout/AdminLayout";

import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";

import Dashboard from "./pages/Dashboard";
import StudentsList from "./pages/StudentsList";
import StudentForm from "./pages/StudentForm";
import Instructors from "./pages/Instructors";
import Services from "./pages/Services";
import Documents from "./pages/Documents";
import Finance from "./pages/Finance";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// PUBLIC_INTERFACE
function App() {
  /** This is the public root component for the DSMS admin frontend. */
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Authenticated area */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/students" element={<StudentsList />} />
                <Route path="/students/new" element={<StudentForm />} />
                <Route path="/students/:id" element={<StudentForm />} />

                {/* manager OR admin */}
                <Route element={<ProtectedRoute requiredRoles={["manager", "admin"]} />}>
                  <Route path="/instructors" element={<Instructors />} />
                  <Route path="/services" element={<Services />} />
                </Route>

                {/* admin only */}
                <Route element={<ProtectedRoute requiredRoles={["admin"]} />}>
                  <Route path="/documents" element={<Documents />} />
                  <Route path="/finance" element={<Finance />} />
                </Route>
              </Route>
            </Route>

            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

