import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import ThemeProvider from "./theme/ThemeProvider";
import AdminLayout from "./layout/AdminLayout";

import Dashboard from "./pages/Dashboard";
import StudentsList from "./pages/StudentsList";
import StudentForm from "./pages/StudentForm";
import Instructors from "./pages/Instructors";
import Services from "./pages/Services";
import Documents from "./pages/Documents";
import Finance from "./pages/Finance";
import NotFound from "./pages/NotFound";

// PUBLIC_INTERFACE
function App() {
  /** This is the public root component for the DSMS admin frontend. */
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/students" element={<StudentsList />} />
            <Route path="/students/new" element={<StudentForm />} />
            <Route path="/students/:id" element={<StudentForm />} />
            <Route path="/instructors" element={<Instructors />} />
            <Route path="/services" element={<Services />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/finance" element={<Finance />} />
          </Route>

          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

