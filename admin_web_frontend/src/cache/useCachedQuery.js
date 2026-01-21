import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDataCache } from "./DataCacheContext";

/**
 * useCachedQuery: a tiny SWR-like hook for DSMS pages.
 *
 * How to use:
 *   const { data, loading, error, revalidate } = useCachedQuery({
 *     key: makeCacheKey("students.list", params),
 *     fetcher: () => api.students.list(params),
 *     select: (apiResult) => apiResult.ok ? apiResult.data : null,
 *   });
 *
 * Stale-while-revalidate semantics:
 * - If cached data exists, it is returned immediately (hydration across navigation).
 * - A background revalidation runs to refresh the cached value (unless disabled).
 * - If no cached data exists, it fetches normally and sets loading=true.
 *
 * Notes:
 * - We keep behavior "framework-light" and preserve the existing stub/network behavior:
 *   fetcher is expected to return the existing ApiResult from api/client.js.
 */

/**
 * @typedef {Object} UseCachedQueryOptions
 * @property {string} key Cache key, ideally endpoint+params (stable).
 * @property {() => Promise<any>} fetcher Async function returning ApiResult.
 * @property {(result: any) => any=} select Optional mapping from ApiResult -> data used by UI.
 * @property {boolean=} enabled If false, no fetching happens.
 * @property {number=} staleTimeMs If entry updatedAt is within staleTime, do not auto revalidate.
 * @property {boolean=} revalidateOnMount If true (default), revalidate on mount when cache exists.
 */

/**
 * @typedef {Object} UseCachedQueryResult
 * @property {any} data
 * @property {boolean} loading
 * @property {string} error
 * @property {() => Promise<void>} revalidate
 */

/**
 * PUBLIC_INTERFACE
 * @param {UseCachedQueryOptions} options
 * @returns {UseCachedQueryResult}
 */
export function useCachedQuery(options) {
  /** This is a public hook providing cached fetch + SWR semantics for list/detail endpoints. */
  const cache = useDataCache();
  const {
    key,
    fetcher,
    select,
    enabled = true,
    staleTimeMs = 10_000,
    revalidateOnMount = true,
  } = options || {};

  const cacheKey = String(key || "");
  const selectFn = typeof select === "function" ? select : (r) => (r?.ok ? r.data : null);

  const [state, setState] = useState(() => {
    const entry = cacheKey ? cache.get(cacheKey) : null;
    return {
      data: entry?.data ?? null,
      loading: Boolean(enabled && cacheKey && !entry?.data),
      error: entry?.error ? String(entry.error) : "",
      updatedAt: entry?.updatedAt ?? 0,
    };
  });

  const requestSeq = useRef(0);

  const syncFromCache = useCallback(() => {
    if (!cacheKey) return;
    const entry = cache.get(cacheKey);
    setState((s) => ({
      ...s,
      data: entry?.data ?? null,
      error: entry?.error ? String(entry.error) : "",
      updatedAt: entry?.updatedAt ?? 0,
      // Keep current loading flag; fetching logic controls it.
    }));
  }, [cache, cacheKey]);

  // Subscribe to cache updates for this key.
  useEffect(() => {
    if (!cacheKey) return;
    return cache.subscribe(cacheKey, syncFromCache);
  }, [cache, cacheKey, syncFromCache]);

  const doFetch = useCallback(
    async ({ background = false } = {}) => {
      if (!enabled || !cacheKey) return;
      if (typeof fetcher !== "function") return;

      const seq = ++requestSeq.current;

      // If background, don't flip to loading unless no cached data exists.
      const existing = cache.get(cacheKey);
      if (!background || !existing?.data) {
        setState((s) => ({ ...s, loading: true, error: "" }));
      }

      // De-dupe concurrent fetches per key.
      if (existing?.inFlight) {
        try {
          await existing.inFlight;
        } catch {
          // ignore; cache will carry error if any
        }
        return;
      }

      const p = (async () => {
        const res = await fetcher();
        const nextData = selectFn(res);
        const nextError = res?.ok ? "" : String(res?.message || res?.error || "Request failed");

        cache.set(cacheKey, {
          data: res?.ok ? nextData : existing?.data ?? null,
          error: nextError ? nextError : null,
          updatedAt: Date.now(),
          inFlight: null,
        });
      })();

      cache.set(cacheKey, { inFlight: p });

      try {
        await p;
      } catch (e) {
        cache.set(cacheKey, {
          error: e instanceof Error ? e.message : "Request failed",
          updatedAt: Date.now(),
          inFlight: null,
        });
      } finally {
        // Ignore stale responses
        if (seq !== requestSeq.current) return;

        const latest = cache.get(cacheKey);
        setState((s) => ({
          ...s,
          data: latest?.data ?? null,
          error: latest?.error ? String(latest.error) : "",
          updatedAt: latest?.updatedAt ?? 0,
          loading: false,
        }));
      }
    },
    [enabled, cacheKey, fetcher, selectFn, cache]
  );

  // Mount behavior:
  // - Hydrate from cache immediately (already handled in init + subscription).
  // - Revalidate based on staleness.
  useEffect(() => {
    if (!enabled || !cacheKey) return;

    const entry = cache.get(cacheKey);
    const hasData = Boolean(entry?.data);
    const isFresh = entry?.updatedAt && Date.now() - entry.updatedAt < staleTimeMs;

    if (!hasData) {
      doFetch({ background: false });
      return;
    }

    // With cached data: SWR revalidation
    if (revalidateOnMount && !isFresh) {
      doFetch({ background: true });
    }
  }, [enabled, cacheKey, cache, staleTimeMs, revalidateOnMount, doFetch]);

  const revalidate = useCallback(async () => {
    await doFetch({ background: Boolean(cache.get(cacheKey)?.data) });
  }, [doFetch, cache, cacheKey]);

  return useMemo(
    () => ({
      data: state.data,
      loading: state.loading,
      error: state.error,
      revalidate,
    }),
    [state.data, state.loading, state.error, revalidate]
  );
}
