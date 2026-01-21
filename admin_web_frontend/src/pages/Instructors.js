import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select, Table } from "../components/ui";
import { createApiClient } from "../api/client";

const api = createApiClient();

// PUBLIC_INTERFACE
export default function Instructors() {
  /** This is a public page component: list instructors and stub assignment flow. */
  const [loading, setLoading] = useState(true);
  const [instructors, setInstructors] = useState([]);
  const [students, setStudents] = useState([]);

  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignInstructorId, setAssignInstructorId] = useState("");
  const [assignResult, setAssignResult] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [insRes, stuRes] = await Promise.all([api.instructors.list(), api.students.list()]);
      if (!mounted) return;
      if (insRes.ok) setInstructors(insRes.data || []);
      if (stuRes.ok) setStudents(stuRes.data || []);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const columns = useMemo(
    () => [
      { key: "name", header: "Instructor" },
      { key: "phone", header: "Phone" },
      {
        key: "status",
        header: "Status",
        render: (i) => (
          <span className={`ds-chip ${i.status === "Available" ? "ds-chip--success" : "ds-chip--info"}`}>
            {i.status}
          </span>
        ),
      },
    ],
    []
  );

  async function onAssign(e) {
    e.preventDefault();
    setAssignResult("");

    if (!assignInstructorId || !assignStudentId) {
      setAssignResult("Select both instructor and student.");
      return;
    }

    const res = await api.instructors.assign({
      instructorId: assignInstructorId,
      studentId: assignStudentId,
    });

    if (!res.ok) {
      setAssignResult(res.error || "Assignment failed");
      return;
    }

    // Refresh instructor statuses
    const refreshed = await api.instructors.list();
    if (refreshed.ok) setInstructors(refreshed.data || []);
    setAssignResult("Assigned successfully (stub).");
  }

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">Instructors</h1>
          <p className="ds-page__subtitle">Manage instructor availability and assignments</p>
        </div>
      </div>

      <div className="ds-grid ds-grid--two">
        <Card title="Instructor List" subtitle={loading ? "Loading…" : `${instructors.length} instructor(s)`}>
          <Table columns={columns} rows={instructors} emptyLabel={loading ? "Loading…" : "No instructors yet."} />
        </Card>

        <Card title="Assign Instructor" subtitle="Stub workflow; will switch to backend later">
          <form className="ds-form" onSubmit={onAssign}>
            <Select value={assignInstructorId} onChange={(e) => setAssignInstructorId(e.target.value)} label="Instructor">
              <option value="">Select…</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.status})
                </option>
              ))}
            </Select>

            <Select value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)} label="Student">
              <option value="">Select…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.status})
                </option>
              ))}
            </Select>

            <Input label="Notes (optional)" placeholder="e.g. Preferred morning sessions" />

            <div className="ds-form__actions">
              <Button type="submit">Assign</Button>
              {assignResult && <span className="ds-muted">{assignResult}</span>}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

