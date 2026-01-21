import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Input, Select } from "../components/ui";
import { createApiClient } from "../api/client";

const api = createApiClient();

const emptyStudent = {
  firstName: "",
  lastName: "",
  phone: "",
  status: "Active",
  enrolledService: "Standard Package",
};

// PUBLIC_INTERFACE
export default function StudentForm() {
  /** This is a public page component: create or edit a student. */
  const { id } = useParams();
  const isNew = id === "new" || id == null;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState(emptyStudent);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    if (isNew) {
      setStudent(emptyStudent);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      const res = await api.students.getById(id);
      if (!mounted) return;
      if (res.ok) setStudent(res.data);
      else setError(res.error || "Unable to load student");
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  const title = useMemo(() => (isNew ? "Create Student" : "Edit Student"), [isNew]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const payload = {
      firstName: student.firstName.trim(),
      lastName: student.lastName.trim(),
      phone: student.phone.trim(),
      status: student.status,
      enrolledService: student.enrolledService,
    };

    if (!payload.firstName || !payload.lastName) {
      setSaving(false);
      setError("First name and last name are required.");
      return;
    }

    const res = isNew ? await api.students.create(payload) : await api.students.update(id, payload);

    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Save failed");
      return;
    }

    navigate("/students");
  }

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">{title}</h1>
          <p className="ds-page__subtitle">Responsive form with modern inputs</p>
        </div>
        <div className="ds-page__actions">
          <Link to="/students">
            <Button variant="ghost">Back</Button>
          </Link>
        </div>
      </div>

      <Card title="Student Details" subtitle={loading ? "Loading…" : "Update profile info and enrollment"}>
        {error && <div className="ds-alert ds-alert--error">{error}</div>}

        <form className="ds-form" onSubmit={onSubmit}>
          <div className="ds-form__grid">
            <Input
              label="First Name"
              value={student.firstName}
              onChange={(e) => setStudent((s) => ({ ...s, firstName: e.target.value }))}
              placeholder="e.g. Amina"
              disabled={loading || saving}
            />
            <Input
              label="Last Name"
              value={student.lastName}
              onChange={(e) => setStudent((s) => ({ ...s, lastName: e.target.value }))}
              placeholder="e.g. Khan"
              disabled={loading || saving}
            />
            <Input
              label="Phone"
              value={student.phone}
              onChange={(e) => setStudent((s) => ({ ...s, phone: e.target.value }))}
              placeholder="+1 (555) 010-0000"
              disabled={loading || saving}
            />
            <Select
              label="Status"
              value={student.status}
              onChange={(e) => setStudent((s) => ({ ...s, status: e.target.value }))}
              disabled={loading || saving}
            >
              <option value="Active">Active</option>
              <option value="Pending Docs">Pending Docs</option>
              <option value="Inactive">Inactive</option>
            </Select>
            <Select
              label="Enrolled Service"
              value={student.enrolledService}
              onChange={(e) => setStudent((s) => ({ ...s, enrolledService: e.target.value }))}
              disabled={loading || saving}
            >
              <option value="Standard Package">Standard Package</option>
              <option value="Express Package">Express Package</option>
              <option value="Custom">Custom</option>
            </Select>
          </div>

          <div className="ds-form__actions">
            <Button type="submit" disabled={loading || saving}>
              {saving ? "Saving…" : isNew ? "Create Student" : "Save Changes"}
            </Button>
            <Link to="/students" className="ds-link-muted">
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

