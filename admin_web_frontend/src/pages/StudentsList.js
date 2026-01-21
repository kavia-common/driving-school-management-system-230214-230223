import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, Input, Select, Table, useToast } from "../components/ui";
import { createApiClient } from "../api/client";
import { makeCacheKey, useDataCache } from "../cache/DataCacheContext";
import { useCachedQuery } from "../cache/useCachedQuery";

const api = createApiClient();

const STATUS_OPTIONS = ["All", "Active", "Pending Docs", "Inactive"];

/**
 * Best-effort normalization for a students list response that may be either:
 * - array of students (older stub/network responses)
 * - { items, total, page, pageSize } (new server-style response)
 * @param {any} data
 */
function normalizeStudentsList(data) {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, pageSize: data.length || 10 };
  }
  const items = Array.isArray(data?.items) ? data.items : [];
  const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : items.length;
  const page = Number.isFinite(Number(data?.page)) ? Number(data.page) : 1;
  const pageSize = Number.isFinite(Number(data?.pageSize)) ? Number(data.pageSize) : items.length || 10;
  return { items, total, page, pageSize };
}

// PUBLIC_INTERFACE
export default function StudentsList() {
  /** This is a public page component: list students with pagination/search/filter and row actions. */
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const cache = useDataCache();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // UI controls
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  // Prevent late async results from overwriting newer ones (still useful for deletes + manual revalidate)
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

  const cacheKey = useMemo(() => makeCacheKey("students.list", queryParams), [queryParams]);

  const { data: listData, loading, error, revalidate } = useCachedQuery({
    key: cacheKey,
    fetcher: () => api.students.list(queryParams),
    select: (res) => {
      if (!res?.ok) return null;
      return normalizeStudentsList(res.data);
    },
    // List pages should stay snappy on navigation; revalidate relatively often.
    staleTimeMs: 5_000,
  });

  const students = useMemo(() => listData?.items || [], [listData]);
  const total = useMemo(() => Number(listData?.total || 0), [listData]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / (pageSize || 10))), [total, pageSize]);

  // Show “came from create/edit” message if provided.
  useEffect(() => {
    const flash = location.state?.flash;
    if (typeof flash === "string" && flash.trim()) {
      toast.success(flash.trim());
      // Clear state so it doesn't replay on back/forward.
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate, toast]);

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Student",
        render: (s) => (
          <button type="button" className="ds-link ds-link--button" onClick={() => navigate(`/students/${s.id}`)}>
            {s.firstName} {s.lastName}
          </button>
        ),
      },
      { key: "phone", header: "Phone" },
      {
        key: "status",
        header: "Status",
        render: (s) => (
          <span className={`ds-chip ${s.status === "Active" ? "ds-chip--success" : s.status === "Inactive" ? "ds-chip--warning" : "ds-chip--info"}`}>
            {s.status}
          </span>
        ),
      },
      { key: "enrolledService", header: "Service" },
      { key: "createdAt", header: "Created" },
      {
        key: "actions",
        header: "",
        render: (s) => (
          <div className="ds-row-actions" style={{ gap: 10 }}>
            <Link className="ds-link" to={`/students/${s.id}`}>
              View/Edit
            </Link>
            <button
              type="button"
              className="ds-link ds-link--button"
              onClick={async () => {
                const okConfirm = window.confirm(`Delete ${s.firstName} ${s.lastName}? This cannot be undone.`);
                if (!okConfirm) return;

                const seq = ++requestSeq.current;
                const res = await api.students.remove(s.id);
                if (seq !== requestSeq.current) return;

                if (!res.ok) {
                  toast.error(res.message || res.error || "Delete failed.");
                  return;
                }

                toast.success("Student deleted.");

                // Bust cached lists (all variants) so other pages hydrate with fresh data.
                cache.invalidate("students.list*");

                // If deleting last row on a page, go back a page where possible.
                const nextTotal = Math.max(0, total - 1);
                const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
                const nextPage = Math.min(page, nextTotalPages);

                setPage(nextPage);
                // Revalidate current list (SWR keeps UI stable while refreshing)
                await revalidate();
              }}
              style={{ color: "var(--ocean-error)" }}
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    [navigate, page, pageSize, toast, total, cache, revalidate]
  );

  const subtitle = useMemo(() => {
    if (loading) return "Loading…";
    if (error) return "Unable to load students";
    return `${total} record(s)`;
  }, [loading, error, total]);

  const emptyLabel = useMemo(() => {
    if (loading) return "Loading…";
    if (error) return "—";
    if (search.trim() || (status && status !== "All")) return "No students match your search/filters.";
    return "No students yet.";
  }, [loading, error, search, status]);

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">Students</h1>
          <p className="ds-page__subtitle">Manage student enrollments and profiles</p>
        </div>
        <div className="ds-page__actions">
          <Link to="/students/new">
            <Button>Create Student</Button>
          </Link>
        </div>
      </div>

      <Card
        title="Student Directory"
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
              placeholder="Name, phone, service…"
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

        <Table columns={columns} rows={students} emptyLabel={emptyLabel} />

        <div className="ds-mt" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div className="ds-muted" style={{ fontSize: 13 }}>
            Page {page} of {totalPages}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Button
              variant="ghost"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>

            <Button
              variant="ghost"
              size="sm"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
