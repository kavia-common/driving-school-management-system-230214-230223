import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * @param {string[]} requiredRoles
 * @param {string[]} roles
 */
function hasAnyRole(requiredRoles, roles) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  return requiredRoles.some((r) => roles.includes(r));
}

// PUBLIC_INTERFACE
export default function ProtectedRoute({ requiredRoles = [] }) {
  /** This is a public component guarding nested routes by auth and roles. */
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) {
    return (
      <div className="ds-page">
        <div className="ds-card">
          <div className="ds-card__body">
            <div className="ds-muted">Checking session…</div>
          </div>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!hasAnyRole(requiredRoles, auth.roles)) {
    return <Navigate to="/" replace state={{ denied: true }} />;
  }

  return <Outlet />;
}
