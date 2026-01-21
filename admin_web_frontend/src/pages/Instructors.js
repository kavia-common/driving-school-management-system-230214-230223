import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, Input, Select, Table, useToast } from "../components/ui";
import { createApiClient } from "../api/client";
import { makeCacheKey, useDataCache } from "../cache/DataCacheContext";
import { useCachedQuery } from "../cache/useCachedQuery";

const api = createApiClient();

const STATUS_OPTIONS = ["All", "Available", "Assigned", "Inactive"];

/**
 * Best-effort normalization for an instructors list response that may be either:
 * - array of instructors (older stub/network responses)
 * - { items, total, page, pageSize } (server-style response)
 * @param {any} data
 */
function normalizeInstructorsList(data) {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, pageSize: data.length || 10 };
  }
  const items = Array.isArray(data?.items) ? data.items : [];
  const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : items.length;
  const page = Number.isFinite(Number(data?.page)) ? Number(data.page) : 1;
  const pageSize = Number.isFinite(Number(data?.pageSize)) ? Number(data.pageSize) : items.length || 10;
  return { items, total, page, pageSize };
}

/** @param {any} i */
function instructorName(i) {
  const first = String(i?.firstName || "").trim();
  const last = String(i?.lastName || "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  // Backward compatibility with older shapes
  if (i?.name) return String(i.name);
  return "—";
}

// PUBLIC_INTERFACE
export default function Instructors() {
  /** This is a public page component: manage instructors, CRUD operations, and student assignments. */
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const cache = useDataCache();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  // Assignment panel
  const [selectedInstructorId, setSelectedInstructorId] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");

  // Prevent late async results from overwriting newer ones
  const requestSeq = useRef(0);

  const instructorsParams = useMemo(
    () => ({
      page,
      pageSize,
      search,
      status,
    }),
    [page, pageSize, search, status]
  );

  const instructorsKey = useMemo(() => makeCacheKey("instructors.list", instructorsParams), [instructorsParams]);

  const {
    data: instructorsData,
    loading,
    error,
    revalidate: revalidateInstructors,
  } = useCachedQuery({
    key: instructorsKey,
    fetcher: () => api.instructors.list(instructorsParams),
    select: (res) => (res?.ok ? normalizeInstructorsList(res.data) : null),
    staleTimeMs: 5_000,
  });

  const instructors = useMemo(() => instructorsData?.items || [], [instructorsData]);
  const total = useMemo(() => Number(instructorsData?.total || 0), [instructorsData]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / (pageSize || 10))), [total, pageSize]);

  const studentsKey = useMemo(() => makeCacheKey("students.list", { page: 1, pageSize: 200 }), []);
  const {
    data: studentsData,
    loading: studentsLoading,
    revalidate: revalidateStudents,
  } = useCachedQuery({
    key: studentsKey,
    fetcher: () => api.students.list({ page: 1, pageSize: 200 }),
    select: (res) => {
      if (!res?.ok) return [];
      return Array.isArray(res.data) ? res.data : Array.isArray(res.data?.items) ? res.data.items : [];
    },
    staleTimeMs: 10_000,
  });
  const students = useMemo(() => (Array.isArray(studentsData) ? studentsData : []), [studentsData]);

  const assignmentsKey = useMemo(
    () => (selectedInstructorId ? makeCacheKey("instructors.listAssignedStudents", { instructorId: selectedInstructorId }) : ""),
    [selectedInstructorId]
  );
  const {
    data: assignedStudentsData,
    loading: assignmentLoading,
    revalidate: revalidateAssignments,
  } = useCachedQuery({
    key: assignmentsKey,
    enabled: Boolean(selectedInstructorId),
    fetcher: () => api.instructors.listAssignedStudents(selectedInstructorId),
    select: (res) => (res?.ok && Array.isArray(res.data) ? res.data : []),
    staleTimeMs: 5_000,
  });
  const assignedStudents = useMemo(() => (Array.isArray(assignedStudentsData) ? assignedStudentsData : []), [assignedStudentsData]);

  // Flash toast (from create/edit)
  useEffect(() => {
    const flash = location.state?.flash;
    if (typeof flash === "string" && flash.trim()) {
      toast.success(flash.trim());
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate, toast]);

  const selectedInstructor = useMemo(
    () => instructors.find((i) => String(i.id) === String(selectedInstructorId)) || null,
    [instructors, selectedInstructorId]
  );

  const availableStudentOptions = useMemo(() => {
    const assignedIds = new Set(assignedStudents.map((s) => String(s.id)));
    return students.filter((s) => !assignedIds.has(String(s.id)));
  }, [students, assignedStudents]);

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Instructor",
        render: (i) => (
          <button type="button" className="ds-link ds-link--button" onClick={() => navigate(`/instructors/${i.id}`)}>
            {instructorName(i)}
          </button>
        ),
      },
      { key: "phone", header: "Phone" },
      {
        key: "status",
        header: "Status",
        render: (i) => (
          <span
            className={`ds-chip ${
              i.status === "Available" ? "ds-chip--success" : i.status === "Inactive" ? "ds-chip--warning" : "ds-chip--info"
            }`}
          >
            {i.status || "—"}
          </span>
        ),
      },
      { key: "createdAt", header: "Created" },
      {
        key: "actions",
        header: "",
        render: (i) => (
          <div className="ds-row-actions" style={{ gap: 10 }}>
            <Link className="ds-link" to={`/instructors/${i.id}`}>
              View/Edit
            </Link>
            <button
              type="button"
              className="ds-link ds-link--button"
              onClick={() => {
                setSelectedInstructorId(String(i.id));
                setAssignStudentId("");
              }}
            >
              Assign
            </button>
            <button
              type="button"
              className="ds-link ds-link--button"
              onClick={async () => {
                const okConfirm = window.confirm(`Delete ${instructorName(i)}? This cannot be undone.`);
                if (!okConfirm) return;

                const seq = ++requestSeq.current;
                const res = await api.instructors.remove(i.id);
                if (seq !== requestSeq.current) return;

                if (!res.ok) {
                  toast.error(res.message || res.error || "Delete failed.");
                  return;
                }

                toast.success("Instructor deleted.");

                // Bust list + assignment caches so other views refresh.
                cache.invalidate("instructors.list*");
                cache.invalidate("instructors.listAssignedStudents*");

                // If deleting currently selected instructor, close panel
                if (String(selectedInstructorId) === String(i.id)) {
                  setSelectedInstructorId("");
                  setAssignStudentId("");
                }

                // If deleting last row on a page, go back a page where possible.
                const nextTotal = Math.max(0, total - 1);
                const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
                const nextPage = Math.min(page, nextTotalPages);

                setPage(nextPage);
                await revalidateInstructors();
              }}
              style={{ color: "var(--ocean-error)" }}
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    [navigate, page, pageSize, toast, total, selectedInstructorId, cache, revalidateInstructors, requestSeq]
  );

  const subtitle = useMemo(() => {
    if (loading) return "Loading…";
    if (error) return "Unable to load instructors";
    return `${total} record(s)`;
  }, [loading, error, total]);

  const emptyLabel = useMemo(() => {
    if (loading) return "Loading…";
    if (error) return "—";
    if (search.trim() || (status && status !== "All")) return "No instructors match your search/filters.";
    return "No instructors yet.";
  }, [loading, error, search, status]);

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">Instructors</h1>
          <p className="ds-page__subtitle">Manage instructor roster, availability, and student assignments</p>
        </div>
        <div className="ds-page__actions">
          <Link to="/instructors/new">
            <Button>Create Instructor</Button>
          </Link>
        </div>
      </div>

      <div className="ds-grid ds-grid--two">
        <Card
          title="Instructor Directory"
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
                placeholder="Name or phone…"
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

          <Table columns={columns} rows={instructors} emptyLabel={emptyLabel} />

          <div className="ds-mt" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div className="ds-muted" style={{ fontSize: 13 }}>
              Page {page} of {totalPages}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Button variant="ghost" size="sm" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
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

        <Card
          title="Student Assignments"
          subtitle={selectedInstructor ? `Manage students for ${instructorName(selectedInstructor)}` : "Select an instructor to attach/detach students"}
        >
          <Select
            label="Instructor"
            value={selectedInstructorId}
            onChange={(e) => {
              setSelectedInstructorId(e.target.value);
              setAssignStudentId("");
            }}
            disabled={loading}
          >
            <option value="">Select…</option>
            {instructors.map((i) => (
              <option key={i.id} value={String(i.id)}>
                {instructorName(i)} ({i.status || "—"})
              </option>
            ))}
          </Select>

          {!selectedInstructorId ? (
            <div className="ds-muted">Choose an instructor from the dropdown to view and manage assigned students.</div>
          ) : (
            <>
              <div className="ds-mt">
                <div className="ds-muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  Assigned students
                </div>

                {assignmentLoading ? (
                  <div className="ds-muted">Loading assignments…</div>
                ) : assignedStudents.length === 0 ? (
                  <div className="ds-muted">No students assigned yet.</div>
                ) : (
                  <ul className="ds-list">
                    {assignedStudents.map((s) => (
                      <li key={s.id} className="ds-list__item">
                        <div>
                          <div className="ds-list__title">
                            {s.firstName} {s.lastName}
                          </div>
                          <div className="ds-list__meta">
                            <span>{s.status || "—"}</span>
                            <span className="ds-dot" aria-hidden="true">
                              •
                            </span>
                            <span>{s.phone || "No phone"}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="ds-link ds-link--button"
                          style={{ color: "var(--ocean-error)", fontWeight: 900 }}
                          onClick={async () => {
                            const okConfirm = window.confirm(`Detach ${s.firstName} ${s.lastName} from ${instructorName(selectedInstructor)}?`);
                            if (!okConfirm) return;

                            const res = await api.instructors.unassignStudent({
                              instructorId: selectedInstructorId,
                              studentId: s.id,
                            });

                            if (!res.ok) {
                              toast.error(res.message || res.error || "Detach failed.");
                              return;
                            }

                            toast.success("Student detached.");

                            cache.invalidate("instructors.listAssignedStudents*");
                            cache.invalidate("instructors.list*");
                            await revalidateAssignments();
                            await revalidateInstructors();
                          }}
                        >
                          Detach
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="ds-mt" style={{ borderTop: "1px solid var(--ocean-border)", paddingTop: 12 }}>
                <div className="ds-muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  Attach a student
                </div>

                <Select
                  label="Student"
                  value={assignStudentId}
                  onChange={(e) => setAssignStudentId(e.target.value)}
                  disabled={studentsLoading || assignmentLoading}
                  hint={studentsLoading ? "Loading students…" : ""}
                >
                  <option value="">Select…</option>
                  {availableStudentOptions.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.firstName} {s.lastName} ({s.status || "—"})
                    </option>
                  ))}
                </Select>

                <div className="ds-form__actions">
                  <Button
                    type="button"
                    disabled={!assignStudentId || assignmentLoading}
                    onClick={async () => {
                      if (!assignStudentId) return;

                      // Prefer new endpoint; fallback to old endpoint if backend only supports it
                      let res = await api.instructors.assignStudent({
                        instructorId: selectedInstructorId,
                        studentId: assignStudentId,
                      });

                      if (!res.ok) {
                        res = await api.instructors.assign({
                          instructorId: selectedInstructorId,
                          studentId: assignStudentId,
                        });
                      }

                      if (!res.ok) {
                        toast.error(res.message || res.error || "Attach failed.");
                        return;
                      }

                      toast.success("Student attached.");
                      setAssignStudentId("");

                      cache.invalidate("instructors.listAssignedStudents*");
                      cache.invalidate("instructors.list*");
                      await revalidateAssignments();
                      await revalidateInstructors();
                      await revalidateStudents(); // keeps dropdown up-to-date in stub mode if needed
                    }}
                  >
                    {assignmentLoading ? "Working…" : "Attach"}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    disabled={assignmentLoading}
                    onClick={() => {
                      setSelectedInstructorId("");
                      setAssignStudentId("");
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
