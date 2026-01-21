/**
 * Centralized environment access for the admin frontend.
 * CRA exposes env vars via process.env.REACT_APP_*
 */

/** @type {string[]} */
const TRUE_STRINGS = ["1", "true", "yes", "on"];

/**
 * Safely parse a boolean env var.
 * @param {string | undefined} raw
 * @param {boolean} fallback
 * @returns {boolean}
 */
function parseBool(raw, fallback) {
  if (raw == null) return fallback;
  return TRUE_STRINGS.includes(String(raw).trim().toLowerCase());
}

/**
 * Safely parse a JSON env var.
 * @param {string | undefined} raw
 * @param {any} fallback
 * @returns {any}
 */
function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// PUBLIC_INTERFACE
export function getRuntimeConfig() {
  /** This is a public function returning normalized runtime configuration. */
  const apiBase =
    process.env.REACT_APP_API_BASE ||
    process.env.REACT_APP_BACKEND_URL ||
    "http://localhost:8080";

  return {
    apiBase,
    backendUrl: process.env.REACT_APP_BACKEND_URL || apiBase,
    frontendUrl: process.env.REACT_APP_FRONTEND_URL || window.location.origin,
    wsUrl:
      process.env.REACT_APP_WS_URL ||
      apiBase.replace(/^http/, "ws").replace(/\/$/, ""),
    nodeEnv: process.env.REACT_APP_NODE_ENV || process.env.NODE_ENV || "development",
    logLevel: process.env.REACT_APP_LOG_LEVEL || "info",
    healthcheckPath: process.env.REACT_APP_HEALTHCHECK_PATH || "/health",
    featureFlags: parseJson(process.env.REACT_APP_FEATURE_FLAGS, {}),
    experimentsEnabled: parseBool(process.env.REACT_APP_EXPERIMENTS_ENABLED, false),
    enableSourceMaps: parseBool(process.env.REACT_APP_ENABLE_SOURCE_MAPS, true),
    trustProxy: parseBool(process.env.REACT_APP_TRUST_PROXY, false),
    telemetryDisabled: parseBool(process.env.REACT_APP_NEXT_TELEMETRY_DISABLED, true),
    port: process.env.REACT_APP_PORT || "3000",

    // When true, the app uses stubbed auth regardless of backend availability.
    // This keeps the template usable without a backend.
    useStubs: parseBool(process.env.REACT_APP_USE_STUBS, false),
  };
}

