import React from "react";

/** Utility to join class names */
function cx(...parts) {
  return parts.filter(Boolean).join(" ");
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

