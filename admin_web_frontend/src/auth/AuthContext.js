import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createApiClient } from "../api/client";

const api = createApiClient();
const AuthContext = createContext(null);

const TOKEN_STORAGE_KEY = "dsms_access_token";

/**
 * @typedef {{id: string, email: string, name?: string, roles?: string[]}} AuthUser
 */

/**
 * Read the persisted access token.
 * @returns {string|null}
 */
function readToken() {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist/clear the access token.
 * @param {string|null} token
 */
function writeToken(token) {
  try {
    if (!token) window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    else window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage errors (e.g., privacy mode).
  }
}

// PUBLIC_INTERFACE
export function useAuth() {
  /** This is a public hook returning the current AuthContext value. */
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// PUBLIC_INTERFACE
export function AuthProvider({ children }) {
  /** This is a public provider component supplying auth state + helpers. */
  const [token, setToken] = useState(() => readToken());
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(Boolean(readToken()));
  const [authError, setAuthError] = useState("");

  const roles = useMemo(() => (Array.isArray(user?.roles) ? user.roles : []), [user]);

  const logout = useCallback(() => {
    writeToken(null);
    setToken(null);
    setUser(null);
    setAuthError("");
    setBootstrapping(false);
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setAuthError("");
    const res = await api.auth.login({ email, password });

    if (!res.ok) {
      setAuthError(res.error || "Login failed");
      return { ok: false, error: res.error || "Login failed" };
    }

    const accessToken = res.data?.accessToken;
    const nextUser = res.data?.user;

    if (!accessToken) {
      setAuthError("Login succeeded but no access token was returned.");
      return { ok: false, error: "No access token returned" };
    }

    writeToken(accessToken);
    setToken(accessToken);
    setUser(nextUser || null);
    return { ok: true };
  }, []);

  const hasRole = useCallback(
    (required) => {
      const requiredList = Array.isArray(required) ? required : [required];
      if (requiredList.length === 0) return true;
      return requiredList.some((r) => roles.includes(r));
    },
    [roles]
  );

  // Bootstrap session across reloads if a token exists.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) {
        if (mounted) {
          setBootstrapping(false);
          setUser(null);
        }
        return;
      }

      setBootstrapping(true);
      const res = await api.auth.me(token);
      if (!mounted) return;

      if (res.ok) {
        setUser(res.data || null);
        setAuthError("");
      } else {
        // If token is invalid/unusable, clear it to avoid loops.
        logout();
        setAuthError(res.error || "Session expired. Please login again.");
      }

      setBootstrapping(false);
    })();

    return () => {
      mounted = false;
    };
  }, [token, logout]);

  const value = useMemo(
    () => ({
      user,
      roles,
      token,
      isAuthenticated: Boolean(token),
      isLoading: bootstrapping,
      error: authError,
      // PUBLIC_INTERFACE
      login,
      // PUBLIC_INTERFACE
      logout,
      // PUBLIC_INTERFACE
      hasRole,
    }),
    [user, roles, token, bootstrapping, authError, login, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
