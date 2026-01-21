import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Table } from "../components/ui";
import { createApiClient } from "../api/client";

const api = createApiClient();

// PUBLIC_INTERFACE
export default function StudentsList() {
  /** This is a public page component: list students and entry points for CRUD. */
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const res = await api.students.list();
      if (!mounted) return;
      if (res.ok) setStudents(res.data || []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const columns = useMemo(
    () => [
      { key: "name", header: "Student", render: (s) => `${s.firstName} ${s.lastName}` },
      { key: "phone", header: "Phone" },
      { key: "status", header: "Status", render: (s) => <span className={`ds-chip ${s.status === "Active" ? "ds-chip--success" : "ds-chip--warning"}`}>{s.status}</span> },
      { key: "enrolledService", header: "Service" },
      { key: "createdAt", header: "Created" },
      {
        key: "actions",
        header: "",
        render: (s) => (
          <div className="ds-row-actions">
            <Link className="ds-link" to={`/students/${s.id}`}>Edit</Link>
          </div>
        ),
      },
    ],
    []
  );

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

      <Card title="Student Directory" subtitle={loading ? "Loading…" : `${students.length} record(s)`}>
        <Table columns={columns} rows={students} emptyLabel={loading ? "Loading…" : "No students yet."} />
      </Card>
    </div>
  );
}

