import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/**
 * Lightweight shared cache with "stale-while-revalidate" behavior.
 *
 * Design goals:
 * - No new dependencies (framework-light).
 * - Cache survives navigation (provider lives at App root).
 * - Keyed by "endpoint + params" (caller provides an explicit stable key).
 * - SWR semantics:
 *   - If cached value exists, return it immediately (stale) while triggering a background revalidation.
 *   - If no cached value exists, do a normal fetch.
 * - Mutation support via invalidate() so list/detail views can refresh after create/update/delete.
 *
 * Notes:
 * - Cache is in-memory only (not persisted across reloads).
 * - Entries store { data, error, updatedAt, inFlight }.
 */

const DataCacheContext = createContext(null);

/**
 * @typedef {Object} CacheEntry
 * @property {any} data
 * @property {any} error
 * @property {number} updatedAt
 * @property {Promise<any>|null} inFlight
 */

/**
 * Build a stable cache key: endpoint + params (sorted JSON).
 * This is exported mainly as a convenience; callers can also provide their own key.
 *
 * PUBLIC_INTERFACE
 * @param {string} endpoint
 * @param {any} params
 * @returns {string}
 */
export function makeCacheKey(endpoint, params) {
  /** This is a public helper to generate consistent cache keys from endpoint + params. */
  const ep = String(endpoint || "").trim();
  if (!params) return ep;

  // Stable stringify by sorting object keys recursively.
  const stable = (v) => {
    if (v == null) return v;
    if (Array.isArray(v)) return v.map(stable);
    if (typeof v === "object") {
      const out = {};
      Object.keys(v)
        .sort()
        .forEach((k) => {
          const vv = v[k];
          if (vv === undefined) return; // omit undefined to reduce accidental key churn
          out[k] = stable(vv);
        });
      return out;
    }
    return v;
  };

  const normalized = stable(params);
  return `${ep}?${JSON.stringify(normalized)}`;
}

// PUBLIC_INTERFACE
export function DataCacheProvider({ children }) {
  /** This is a public provider component supplying shared cached query state across pages. */
  const cacheRef = useRef(new Map());
  const listenersRef = useRef(new Map()); // key -> Set<fn>

  // A tiny state bump to force provider consumers to re-render when cache changes (if needed).
  const [, setRevision] = useState(0);

  const notify = useCallback((key) => {
    const set = listenersRef.current.get(key);
    if (set) {
      set.forEach((fn) => {
        try {
          fn();
        } catch {
          // ignore
        }
      });
    }
    // Also bump revision so consumers relying on context identity changes can update.
    setRevision((r) => r + 1);
  }, []);

  const getEntry = useCallback((key) => {
    return cacheRef.current.get(String(key)) || null;
  }, []);

  const setEntry = useCallback(
    (key, patch) => {
      const k = String(key);
      const prev = cacheRef.current.get(k);
      const next = {
        data: prev?.data ?? null,
        error: prev?.error ?? null,
        updatedAt: prev?.updatedAt ?? 0,
        inFlight: prev?.inFlight ?? null,
        ...patch,
      };
      cacheRef.current.set(k, next);
      notify(k);
      return next;
    },
    [notify]
  );

  const subscribe = useCallback((key, fn) => {
    const k = String(key);
    const set = listenersRef.current.get(k) || new Set();
    set.add(fn);
    listenersRef.current.set(k, set);

    return () => {
      const set2 = listenersRef.current.get(k);
      if (!set2) return;
      set2.delete(fn);
      if (set2.size === 0) listenersRef.current.delete(k);
    };
  }, []);

  const invalidate = useCallback(
    (matcher) => {
      // matcher:
      // - string: invalidate exact key
      // - string prefix ending with "*": prefix match
      // - predicate(key): boolean
      if (matcher == null) return;

      const keys = Array.from(cacheRef.current.keys());
      const shouldInvalidate = (k) => {
        if (typeof matcher === "function") return Boolean(matcher(k));
        if (typeof matcher === "string") {
          if (matcher.endsWith("*")) return k.startsWith(matcher.slice(0, -1));
          return k === matcher;
        }
        return false;
      };

      keys.forEach((k) => {
        if (!shouldInvalidate(k)) return;
        const entry = cacheRef.current.get(k);
        if (!entry) return;
        // Keep data for SWR (stale) but mark as outdated.
        cacheRef.current.set(k, { ...entry, updatedAt: 0, error: null });
        notify(k);
      });
    },
    [notify]
  );

  const clear = useCallback(() => {
    cacheRef.current.clear();
    setRevision((r) => r + 1);
  }, []);

  const value = useMemo(
    () => ({
      // PUBLIC_INTERFACE
      get: getEntry,
      // PUBLIC_INTERFACE
      set: setEntry,
      // PUBLIC_INTERFACE
      subscribe,
      // PUBLIC_INTERFACE
      invalidate,
      // PUBLIC_INTERFACE
      clear,
    }),
    [getEntry, setEntry, subscribe, invalidate, clear]
  );

  return <DataCacheContext.Provider value={value}>{children}</DataCacheContext.Provider>;
}

// PUBLIC_INTERFACE
export function useDataCache() {
  /** This is a public hook returning the DataCacheContext value. */
  const ctx = useContext(DataCacheContext);
  if (!ctx) throw new Error("useDataCache must be used within DataCacheProvider");
  return ctx;
}
