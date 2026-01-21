import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../auth/AuthContext";

function NavIcon({ name }) {
  // Simple inline “icon” using initials; avoids adding icon deps.
  return <span className="ds-nav__icon" aria-hidden="true">{name}</span>;
}

const navItems = [
  { to: "/", label: "Dashboard", icon: "D" },
  { to: "/students", label: "Students", icon: "S" },
  { to: "/instructors", label: "Instructors", icon: "I" },
  { to: "/services", label: "Services", icon: "SV" },
  { to: "/documents", label: "Documents", icon: "DC" },
  { to: "/finance", label: "Finance", icon: "F" },
];

// PUBLIC_INTERFACE
export default function AdminLayout() {
  /** This is a public component providing the app shell (sidebar/topbar). */
  const { mode, toggle } = useTheme();
  const auth = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  const today = useMemo(() => new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }), []);

  return (
    <div className="ds-shell">
      <aside className={`ds-sidebar ${mobileOpen ? "ds-sidebar--open" : ""}`}>
        <div className="ds-sidebar__brand">
          <div className="ds-brandmark" aria-hidden="true">DS</div>
          <div>
            <div className="ds-brand__title">DSMS Admin</div>
            <div className="ds-brand__subtitle">Driving School</div>
          </div>
          <button className="ds-sidebar__close" onClick={closeMobile} aria-label="Close navigation">
            ×
          </button>
        </div>

        <nav className="ds-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `ds-nav__item ${isActive ? "is-active" : ""}`}
              onClick={closeMobile}
            >
              <NavIcon name={item.icon} />
              <span className="ds-nav__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ds-sidebar__footer">
          <div className="ds-muted">v1.0</div>
        </div>
      </aside>

      <div className="ds-main">
        <header className="ds-topbar">
          <button className="ds-topbar__menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            ☰
          </button>

          <div className="ds-topbar__meta">
            <div className="ds-topbar__title">Admin Console</div>
            <div className="ds-topbar__subtitle">{today}</div>
          </div>

          <div className="ds-topbar__actions">
            <div className="ds-muted" style={{ fontSize: 12, textAlign: "right" }}>
              <div style={{ fontWeight: 800 }}>{auth.user?.name || auth.user?.email || "User"}</div>
              <div>{auth.roles?.length ? auth.roles.join(", ") : "—"}</div>
            </div>

            <Button variant="ghost" onClick={toggle} aria-label="Toggle theme">
              {mode === "light" ? "Dark" : "Light"} mode
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                auth.logout();
                navigate("/login", { replace: true });
              }}
              aria-label="Logout"
            >
              Logout
            </Button>

            <div className="ds-avatar" title={auth.user?.email || "Admin"}>
              {(auth.user?.email || "A").slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="ds-content" role="main">
          <Outlet />
        </main>
      </div>

      {mobileOpen && <div className="ds-backdrop" onClick={closeMobile} aria-hidden="true" />}
    </div>
  );
}

