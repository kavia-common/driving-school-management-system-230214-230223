import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, Input, Select, Table, useToast } from "../components/ui";
import { createApiClient } from "../api/client";
import { makeCacheKey, useDataCache } from "../cache/DataCacheContext";
import { useCachedQuery } from "../cache/useCachedQuery";

const api = createApiClient();

const STATUS_OPTIONS = ["All", "Active", "Disabled"];

/**
 * Best-effort normalization for a services list response that may be either:
 * - array of services (older stub/network responses)
 * - { items, total, page, pageSize } (server-style response)
 * @param {any} data
 */
function normalizeServicesList(data) {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, pageSize: data.length || 10 };
  }
  const items = Array.isArray(data?.items) ? data.items : [];
  const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : items.length;
  const page = Number.isFinite(Number(data?.page)) ? Number(data.page) : 1;
  const pageSize = Number.isFinite(Number(data?.pageSize)) ? Number(data.pageSize) : items.length || 10;
  return { items, total, page, pageSize };
}

/** @param {any} s */
function dollars(s) {
  const n = Number(s?.price);
  if (!Number.isFinite(n)) return "—";
  return `$${n}`;
}

// PUBLIC_INTERFACE
export default function Services() {
  /** This is a public page component: list services with pagination/search/filter and row actions. */
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const cache = useDataCache();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // UI controls
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  // Prevent late async results from overwriting newer ones
  const requestSeq = useRef(0);

  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      search,
      status,
    }),
    [page, pageSize, search, status]
  );

  const cacheKey = useMemo(() => makeCacheKey("services.list", queryParams), [queryParams]);

  const { data: listData, loading, error, revalidate } = useCachedQuery({
    key: cacheKey,
    fetcher: () => api.services.list(queryParams),
    select: (res) => (res?.ok ? normalizeServicesList(res.data) : null),
    staleTimeMs: 5_000,
  });

  const services = useMemo(() => listData?.items || [], [listData]);
  const total = useMemo(() => Number(listData?.total || 0), [listData]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / (pageSize || 10))), [total, pageSize]);

  // Flash toast (from create/edit)
  useEffect(() => {
    const flash = location.state?.flash;
    if (typeof flash === "string" && flash.trim()) {
      toast.success(flash.trim());
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate, toast]);

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Service",
        render: (s) => (
          <button type="button" className="ds-link ds-link--button" onClick={() => navigate(`/services/${s.id}`)}>
            {s.name || "—"}
          </button>
        ),
      },
      { key: "lessons", header: "Lessons", render: (s) => (s.lessons == null ? "—" : String(s.lessons)) },
      { key: "price", header: "Price", render: (s) => dollars(s) },
      {
        key: "active",
        header: "Status",
        render: (s) => (
          <span className={`ds-chip ${s.active ? "ds-chip--success" : "ds-chip--warning"}`}>{s.active ? "Active" : "Disabled"}</span>
        ),
      },
      {
        key: "actions",
        header: "",
        render: (s) => (
          <div className="ds-row-actions" style={{ gap: 10 }}>
            <Link className="ds-link" to={`/services/${s.id}`}>
              Edit
            </Link>

            <button
              type="button"
              className="ds-link ds-link--button"
              onClick={async () => {
                const seq = ++requestSeq.current;
                const res = await api.services.update(s.id, { active: !Boolean(s.active) });
                if (seq !== requestSeq.current) return;

                if (!res.ok) {
                  toast.error(res.message || res.error || "Update failed.");
                  return;
                }
                toast.success(Boolean(s.active) ? "Service disabled." : "Service enabled.");

                cache.invalidate("services.list*");
                await revalidate();
              }}
            >
              {s.active ? "Disable" : "Enable"}
            </button>

            <button
              type="button"
              className="ds-link ds-link--button"
              style={{ color: "var(--ocean-error)" }}
              onClick={async () => {
                const okConfirm = window.confirm(`Delete "${s.name || "this service"}"? This cannot be undone.`);
                if (!okConfirm) return;

                const seq = ++requestSeq.current;
                const res = await api.services.remove(s.id);
                if (seq !== requestSeq.current) return;

                if (!res.ok) {
                  toast.error(res.message || res.error || "Delete failed.");
                  return;
                }

                toast.success("Service deleted.");

                cache.invalidate("services.list*");

                const nextTotal = Math.max(0, total - 1);
                const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
                const nextPage = Math.min(page, nextTotalPages);

                setPage(nextPage);
                await revalidate();
              }}
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    [navigate, page, pageSize, toast, total, cache, revalidate, requestSeq]
  );

  const subtitle = useMemo(() => {
    if (loading) return "Loading…";
    if (error) return "Unable to load services";
    return `${total} record(s)`;
  }, [loading, error, total]);

  const emptyLabel = useMemo(() => {
    if (loading) return "Loading…";
    if (error) return "—";
    if (search.trim() || (status && status !== "All")) return "No services match your search/filters.";
    return "No services yet.";
  }, [loading, error, search, status]);

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">Services</h1>
          <p className="ds-page__subtitle">Manage offerings, pricing, and availability</p>
        </div>
        <div className="ds-page__actions">
          <Link to="/services/new">
            <Button>Create Service</Button>
          </Link>
        </div>
      </div>

      <Card
        title="Service Catalog"
        subtitle={subtitle}
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Input
              label="Search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Service name…"
            />

            <Select
              label="Status"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>

            <Select
              label="Page size"
              value={String(pageSize)}
              onChange={(e) => {
                const next = Number(e.target.value) || 10;
                setPage(1);
                setPageSize(next);
              }}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={String(n)}>
                  {n}/page
                </option>
              ))}
            </Select>

            <Button
              variant="ghost"
              onClick={() => {
                setPage(1);
                setSearch("");
                setStatus("All");
              }}
              disabled={loading}
            >
              Reset
            </Button>
          </div>
        }
      >
        {error && <div className="ds-alert ds-alert--error">{error}</div>}

        <Table columns={columns} rows={services} emptyLabel={emptyLabel} />

        <div className="ds-mt" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div className="ds-muted" style={{ fontSize: 13 }}>
            Page {page} of {totalPages}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Button variant="ghost" size="sm" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </Button>

            <Button variant="ghost" size="sm" disabled={loading || page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
