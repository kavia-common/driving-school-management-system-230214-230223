import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, Select, Table, useToast } from "../components/ui";
import { createApiClient } from "../api/client";
import { getRuntimeConfig } from "../config/env";

const api = createApiClient();

const STATUS_OPTIONS = ["All", "Missing", "Received", "Rejected", "Pending Review"];
const TYPE_OPTIONS = ["All", "ID Proof", "Medical", "Address Proof", "Photo", "Consent Form", "Other"];

/**
 * Best-effort normalization for a documents list response that may be either:
 * - array of documents (older stub/network responses)
 * - { items, total, page, pageSize } (server-style response)
 * @param {any} data
 */
function normalizeDocumentsList(data) {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, pageSize: data.length || 10 };
  }
  const items = Array.isArray(data?.items) ? data.items : [];
  const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : items.length;
  const page = Number.isFinite(Number(data?.page)) ? Number(data.page) : 1;
  const pageSize = Number.isFinite(Number(data?.pageSize)) ? Number(data.pageSize) : items.length || 10;
  return { items, total, page, pageSize };
}

/** @param {any} d */
function docStatusChipClass(d) {
  const s = String(d?.status || "");
  if (s === "Received") return "ds-chip--success";
  if (s === "Missing" || s === "Rejected") return "ds-chip--warning";
  return "ds-chip--info";
}

// PUBLIC_INTERFACE
export default function Documents() {
  /** This is a public page component: track student documents with list, filters, and status/upload actions. */
  const toast = useToast();
  const cfg = getRuntimeConfig();
  const networkEnabled = Boolean(cfg.useNetwork);

  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);

  // list controls
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filters
  const [studentId, setStudentId] = useState("");
  const [status, setStatus] = useState("All");
  const [type, setType] = useState("All");
  const [search, setSearch] = useState("");

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form (lightweight)
  const [createOpen, setCreateOpen] = useState(false);
  const [newStudentId, setNewStudentId] = useState("");
  const [newType, setNewType] = useState("ID Proof");
  const [newStatus, setNewStatus] = useState("Received");
  const [newName, setNewName] = useState("");
  const [newFile, setNewFile] = useState(null);

  const requestSeq = useRef(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / (pageSize || 10))), [total, pageSize]);

  const fetchDocs = useCallback(
    async (opts = {}) => {
      const nextPage = Number(opts.page ?? page) || 1;
      const nextPageSize = Number(opts.pageSize ?? pageSize) || 10;

      const nextStudentId = String(opts.studentId ?? studentId).trim();
      const nextStatus = String(opts.status ?? status).trim();
      const nextType = String(opts.type ?? type).trim();
      const nextSearch = String(opts.search ?? search);

      const seq = ++requestSeq.current;
      setLoading(true);
      setError("");

      const res = await api.documents.list({
        page: nextPage,
        pageSize: nextPageSize,
        studentId: nextStudentId,
        status: nextStatus,
        type: nextType,
        search: nextSearch,
      });

      if (seq !== requestSeq.current) return;

      if (!res.ok) {
        setDocs([]);
        setTotal(0);
        setError(res.message || res.error || "Unable to load documents.");
        setLoading(false);
        return;
      }

      const normalized = normalizeDocumentsList(res.data);
      setDocs(normalized.items);
      setTotal(normalized.total);
      setLoading(false);
    },
    [page, pageSize, studentId, status, type, search]
  );

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const subtitle = useMemo(() => {
    if (loading) return "Loading…";
    if (error) return "Unable to load documents";
    return `${total} record(s)`;
  }, [loading, error, total]);

  const emptyLabel = useMemo(() => {
    if (loading) return "Loading…";
    if (error) return "—";
    if (studentId.trim() || (status && status !== "All") || (type && type !== "All") || search.trim()) return "No documents match your filters.";
    return "No documents tracked yet.";
  }, [loading, error, studentId, status, type, search]);

  const canCreate = useMemo(() => {
    if (!newStudentId.trim()) return false;
    if (!String(newType || "").trim()) return false;

    // In stub mode, we accept name OR file (derive from file.name).
    // In network mode, we encourage file uploads, but still allow JSON-only create.
    if (networkEnabled) return Boolean(newFile) || Boolean(newName.trim());
    return Boolean(newFile) || Boolean(newName.trim());
  }, [newStudentId, newType, newFile, newName, networkEnabled]);

  const resetCreate = () => {
    setNewStudentId("");
    setNewType("ID Proof");
    setNewStatus("Received");
    setNewName("");
    setNewFile(null);
  };

  const onCreate = async () => {
    if (!canCreate) return;

    const payload = {
      studentId: newStudentId.trim(),
      type: newType,
      status: newStatus,
      name: newName.trim() || undefined,
      file: newFile || undefined,
      fileName: newFile?.name || undefined,
    };

    const res = await api.documents.create(payload);
    if (!res.ok) {
      toast.error(res.message || res.error || "Create failed.");
      return;
    }

    toast.success("Document added.");
    resetCreate();
    setCreateOpen(false);
    setPage(1);
    await fetchDocs({ page: 1 });
  };

  const columns = useMemo(
    () => [
      { key: "studentId", header: "Student ID" },
      { key: "type", header: "Type" },
      {
        key: "name",
        header: "Name",
        render: (d) => d?.name || d?.fileName || "—",
      },
      {
        key: "status",
        header: "Status",
        render: (d) => <span className={`ds-chip ${docStatusChipClass(d)}`}>{d?.status || "—"}</span>,
      },
      { key: "updatedAt", header: "Updated" },
      {
        key: "actions",
        header: "",
        render: (d) => (
          <div className="ds-row-actions" style={{ gap: 10 }}>
            <button
              type="button"
              className="ds-link ds-link--button"
              onClick={async () => {
                // Lightweight "view": best-effort via get(id), fallback to showing existing row data.
                const res = await api.documents.get(d.id);
                const doc = res.ok ? res.data : d;
                const details = [
                  `ID: ${doc?.id || "—"}`,
                  `Student: ${doc?.studentId || "—"}`,
                  `Type: ${doc?.type || "—"}`,
                  `Name: ${doc?.name || doc?.fileName || "—"}`,
                  `Status: ${doc?.status || "—"}`,
                  `Updated: ${doc?.updatedAt || "—"}`,
                ].join("\n");
                window.alert(details);
              }}
            >
              View
            </button>

            <Select
              aria-label="Change status"
              value={String(d.status || "")}
              onChange={async (e) => {
                const next = e.target.value;
                const res = await api.documents.updateStatus(d.id, next);
                if (!res.ok) {
                  toast.error(res.message || res.error || "Status update failed.");
                  return;
                }
                toast.success("Status updated.");
                await fetchDocs();
              }}
            >
              {["Missing", "Received", "Rejected", "Pending Review"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>

            <button
              type="button"
              className="ds-link ds-link--button"
              style={{ color: "var(--ocean-error)" }}
              onClick={async () => {
                const okConfirm = window.confirm(`Delete this document (${d.type || "document"}) for ${d.studentId || "student"}? This cannot be undone.`);
                if (!okConfirm) return;

                const res = await api.documents.remove(d.id);
                if (!res.ok) {
                  toast.error(res.message || res.error || "Delete failed.");
                  return;
                }

                toast.success("Document deleted.");

                const nextTotal = Math.max(0, total - 1);
                const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
                const nextPage = Math.min(page, nextTotalPages);

                setPage(nextPage);
                await fetchDocs({ page: nextPage });
              }}
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    [fetchDocs, page, pageSize, toast, total]
  );

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">Documents</h1>
          <p className="ds-page__subtitle">Track required paperwork for compliance</p>
        </div>
        <div className="ds-page__actions">
          <Button
            onClick={() => {
              setCreateOpen((v) => !v);
            }}
          >
            {createOpen ? "Close" : "Add Document"}
          </Button>
        </div>
      </div>

      <Card
        title="Document Tracker"
        subtitle={subtitle}
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Input
              label="Student ID"
              value={studentId}
              onChange={(e) => {
                setPage(1);
                setStudentId(e.target.value);
              }}
              placeholder="stu_001…"
            />

            <Input
              label="Search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Type, status, name…"
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
              label="Type"
              value={type}
              onChange={(e) => {
                setPage(1);
                setType(e.target.value);
              }}
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
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
                setStudentId("");
                setSearch("");
                setStatus("All");
                setType("All");
              }}
              disabled={loading}
            >
              Reset
            </Button>
          </div>
        }
      >
        {error && <div className="ds-alert ds-alert--error">{error}</div>}

        {createOpen && (
          <div className="ds-card" style={{ marginBottom: 14 }}>
            <div className="ds-card__body">
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <Input label="Student ID" value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)} placeholder="stu_002…" />

                <Select label="Type" value={newType} onChange={(e) => setNewType(e.target.value)}>
                  {TYPE_OPTIONS.filter((t) => t !== "All").map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>

                <Select label="Initial status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  {["Received", "Missing", "Pending Review"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>

                <Input
                  label={networkEnabled ? "Name (optional if uploading)" : "Name"}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Passport scan"
                />

                <label className="ds-field" style={{ minWidth: 220 }}>
                  <span className="ds-field__label">{networkEnabled ? "File (multipart)" : "File (stub)"}</span>
                  <input
                    className="ds-input"
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                      setNewFile(f);
                      if (f && !newName.trim()) setNewName(f.name);
                    }}
                  />
                  <span className="ds-field__hint">
                    {networkEnabled ? "If backend supports uploads, we'll send multipart/form-data." : "Stored as a stub record only (no real upload)."}
                  </span>
                </label>

                <div style={{ display: "flex", gap: 10 }}>
                  <Button onClick={onCreate} disabled={!canCreate}>
                    Add
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      resetCreate();
                      setCreateOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>

              <div className="ds-muted" style={{ marginTop: 10 }}>
                Mode: <strong>{networkEnabled ? "Network" : "Stubbed"}</strong>
              </div>
            </div>
          </div>
        )}

        <Table columns={columns} rows={docs} emptyLabel={emptyLabel} />

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
