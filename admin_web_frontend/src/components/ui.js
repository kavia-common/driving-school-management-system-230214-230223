import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

/** Utility to join class names */
function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const ToastContext = createContext(null);

/**
 * @typedef {{ id: string, type: "success"|"error"|"info", message: string }} ToastItem
 */

/** @param {ToastItem["type"]} type */
function toastBg(type) {
  if (type === "success") return "rgba(245, 158, 11, 0.12)";
  if (type === "error") return "rgba(239, 68, 68, 0.10)";
  return "rgba(37, 99, 235, 0.10)";
}

/** @param {ToastItem["type"]} type */
function toastBorder(type) {
  if (type === "success") return "rgba(245, 158, 11, 0.28)";
  if (type === "error") return "rgba(239, 68, 68, 0.25)";
  return "rgba(37, 99, 235, 0.22)";
}

// PUBLIC_INTERFACE
export function ToastProvider({ children }) {
  /** This is a public provider for lightweight toast notifications. */
  const [items, setItems] = useState([]);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type, message, ttlMs = 2600) => {
    const id = `t_${String(Math.random()).slice(2, 9)}`;
    const next = { id, type, message };
    setItems((prev) => [...prev, next]);

    window.setTimeout(() => {
      remove(id);
    }, ttlMs);

    return id;
  }, [remove]);

  const api = useMemo(
    () => ({
      success: (message, ttlMs) => push("success", message, ttlMs),
      error: (message, ttlMs) => push("error", message, ttlMs),
      info: (message, ttlMs) => push("info", message, ttlMs),
      remove,
    }),
    [push, remove]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toast viewport */}
      <div
        aria-live="polite"
        aria-relevant="additions"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 420,
        }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              background: toastBg(t.type),
              border: `1px solid ${toastBorder(t.type)}`,
              borderRadius: 14,
              padding: "10px 12px",
              backdropFilter: "blur(6px)",
              boxShadow: "var(--shadow-md)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.3 }}>{t.message}</div>
            <button
              type="button"
              className="ds-link ds-link--button"
              onClick={() => remove(t.id)}
              aria-label="Dismiss notification"
              style={{ fontWeight: 900 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// PUBLIC_INTERFACE
export function useToast() {
  /** This is a public hook returning toast helpers (success/error/info). */
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// PUBLIC_INTERFACE
export function Card({ title, subtitle, actions, children, className }) {
  /** This is a public component: a surface container with optional header. */
  return (
    <section className={cx("ds-card", className)}>
      {(title || actions) && (
        <header className="ds-card__header">
          <div>
            {title && <h2 className="ds-card__title">{title}</h2>}
            {subtitle && <p className="ds-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="ds-card__actions">{actions}</div>}
        </header>
      )}
      <div className="ds-card__body">{children}</div>
    </section>
  );
}

// PUBLIC_INTERFACE
export function Button({ variant = "primary", size = "md", className, ...props }) {
  /** This is a public component: a styled button with variants. */
  return <button className={cx("ds-btn", `ds-btn--${variant}`, `ds-btn--${size}`, className)} {...props} />;
}

// PUBLIC_INTERFACE
export function Input({ label, hint, error, className, ...props }) {
  /** This is a public component: input with label, hint and error text. */
  return (
    <label className={cx("ds-field", className)}>
      {label && <span className="ds-field__label">{label}</span>}
      <input className={cx("ds-input", error && "ds-input--error")} {...props} />
      {error ? <span className="ds-field__error">{error}</span> : hint ? <span className="ds-field__hint">{hint}</span> : null}
    </label>
  );
}

// PUBLIC_INTERFACE
export function Select({ label, hint, error, className, children, ...props }) {
  /** This is a public component: select with label. */
  return (
    <label className={cx("ds-field", className)}>
      {label && <span className="ds-field__label">{label}</span>}
      <select className={cx("ds-select", error && "ds-select--error")} {...props}>
        {children}
      </select>
      {error ? <span className="ds-field__error">{error}</span> : hint ? <span className="ds-field__hint">{hint}</span> : null}
    </label>
  );
}

// PUBLIC_INTERFACE
export function Table({ columns, rows, emptyLabel = "No records found." }) {
  /** This is a public component: a simple responsive table. */
  return (
    <div className="ds-table__wrap">
      <table className="ds-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="ds-table__empty">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr key={r.id || idx}>
                {columns.map((c) => (
                  <td key={c.key}>{typeof c.render === "function" ? c.render(r) : r[c.key]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

