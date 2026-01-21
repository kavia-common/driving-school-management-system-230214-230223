import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Card, Input } from "../components/ui";
import { useAuth } from "../auth/AuthContext";

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

// PUBLIC_INTERFACE
export default function Login() {
  /** This is a public page component: email/password login. */
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = useMemo(() => {
    const from = location.state?.from;
    return typeof from === "string" && from.startsWith("/") ? from : "/";
  }, [location.state]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const emailError = useMemo(() => {
    if (!touched.email) return "";
    if (!email.trim()) return "Email is required.";
    if (!validateEmail(email)) return "Enter a valid email address.";
    return "";
  }, [email, touched.email]);

  const passwordError = useMemo(() => {
    if (!touched.password) return "";
    if (!password) return "Password is required.";
    if (password.length < 4) return "Password must be at least 4 characters.";
    return "";
  }, [password, touched.password]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");
    setTouched({ email: true, password: true });

    if (emailError || passwordError) return;

    setSubmitting(true);
    const res = await auth.login({ email: email.trim(), password });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(res.error || "Login failed.");
      return;
    }

    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="ds-page" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">Login</h1>
          <p className="ds-page__subtitle">Sign in to access the DSMS Admin Console</p>
        </div>
      </div>

      <Card title="Welcome back" subtitle="Use your admin credentials to continue">
        {(formError || auth.error) && <div className="ds-alert ds-alert--error">{formError || auth.error}</div>}

        <form className="ds-form" onSubmit={onSubmit}>
          <Input
            label="Email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            error={emailError}
            disabled={submitting}
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            error={passwordError}
            disabled={submitting}
            autoComplete="current-password"
          />

          <div className="ds-form__actions">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
            <span className="ds-muted">
              {auth.isLoading ? "Checking session…" : "Stub mode supported if backend is unavailable."}
            </span>
          </div>
        </form>
      </Card>
    </div>
  );
}
