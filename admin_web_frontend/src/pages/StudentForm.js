import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Input, Select, useToast } from "../components/ui";
import { createApiClient } from "../api/client";

const api = createApiClient();

const emptyStudent = {
  firstName: "",
  lastName: "",
  phone: "",
  status: "Active",
  enrolledService: "Standard Package",
};

function validatePhone(phone) {
  const p = String(phone || "").trim();
  if (!p) return ""; // optional
  // Very light validation: allow digits, spaces, (), +, -, .
  const ok = /^[0-9\s()+\-\.]{7,}$/.test(p);
  return ok ? "" : "Enter a valid phone number (or leave blank).";
}

// PUBLIC_INTERFACE
export default function StudentForm() {
  /** This is a public page component: create or edit a student with validation and UI states. */
  const toast = useToast();
  const { id } = useParams();
  const isNew = id == null;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState(emptyStudent);

  const [touched, setTouched] = useState({ firstName: false, lastName: false, phone: false });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let mounted = true;

    if (isNew) {
      setStudent(emptyStudent);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      setLoading(true);
      setFormError("");
      const res = await api.students.get(id);
      if (!mounted) return;

      if (res.ok) setStudent(res.data || emptyStudent);
      else setFormError(res.message || res.error || "Unable to load student.");

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  const title = useMemo(() => (isNew ? "Create Student" : "Edit Student"), [isNew]);

  const firstNameError = useMemo(() => {
    if (!touched.firstName) return "";
    if (!student.firstName.trim()) return "First name is required.";
    if (student.firstName.trim().length < 2) return "First name is too short.";
    return "";
  }, [student.firstName, touched.firstName]);

  const lastNameError = useMemo(() => {
    if (!touched.lastName) return "";
    if (!student.lastName.trim()) return "Last name is required.";
    if (student.lastName.trim().length < 2) return "Last name is too short.";
    return "";
  }, [student.lastName, touched.lastName]);

  const phoneError = useMemo(() => {
    if (!touched.phone) return "";
    return validatePhone(student.phone);
  }, [student.phone, touched.phone]);

  const canSubmit = useMemo(() => {
    // validate all required fields regardless of touched when submitting
    const reqOk = student.firstName.trim() && student.lastName.trim();
    const phoneOk = !validatePhone(student.phone);
    return Boolean(reqOk && phoneOk);
  }, [student.firstName, student.lastName, student.phone]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");
    setTouched({ firstName: true, lastName: true, phone: true });

    const phErr = validatePhone(student.phone);
    if (!student.firstName.trim() || !student.lastName.trim() || phErr) {
      if (phErr) setFormError(phErr);
      else setFormError("Please correct the highlighted fields.");
      return;
    }

    setSaving(true);

    const payload = {
      firstName: student.firstName.trim(),
      lastName: student.lastName.trim(),
      phone: student.phone.trim(),
      status: student.status,
      enrolledService: student.enrolledService,
    };

    const res = isNew ? await api.students.create(payload) : await api.students.update(id, payload);

    setSaving(false);

    if (!res.ok) {
      setFormError(res.message || res.error || "Save failed.");
      toast.error(res.message || res.error || "Save failed.");
      return;
    }

    toast.success(isNew ? "Student created." : "Student updated.");

    // Navigate back and tell list to show a one-time flash toast.
    navigate("/students", { replace: true, state: { flash: isNew ? "Student created." : "Student updated." } });
  }

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">{title}</h1>
          <p className="ds-page__subtitle">{isNew ? "Add a new profile and enrollment" : "Update profile info and enrollment"}</p>
        </div>
        <div className="ds-page__actions">
          <Link to="/students">
            <Button variant="ghost">Back</Button>
          </Link>
        </div>
      </div>

      <Card title="Student Details" subtitle={loading ? "Loading…" : "Complete the details below"}>
        {formError && <div className="ds-alert ds-alert--error">{formError}</div>}

        <form className="ds-form" onSubmit={onSubmit}>
          <div className="ds-form__grid">
            <Input
              label="First Name"
              value={student.firstName}
              onChange={(e) => setStudent((s) => ({ ...s, firstName: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
              placeholder="e.g. Amina"
              disabled={loading || saving}
              error={firstNameError}
              autoComplete="given-name"
            />

            <Input
              label="Last Name"
              value={student.lastName}
              onChange={(e) => setStudent((s) => ({ ...s, lastName: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, lastName: true }))}
              placeholder="e.g. Khan"
              disabled={loading || saving}
              error={lastNameError}
              autoComplete="family-name"
            />

            <Input
              label="Phone (optional)"
              value={student.phone}
              onChange={(e) => setStudent((s) => ({ ...s, phone: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              placeholder="+1 (555) 010-0000"
              disabled={loading || saving}
              error={phoneError}
              inputMode="tel"
              autoComplete="tel"
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
            <Button type="submit" disabled={loading || saving || !canSubmit}>
              {saving ? "Saving…" : isNew ? "Create Student" : "Save Changes"}
            </Button>
            <Link to="/students" className="ds-link-muted" aria-disabled={saving ? "true" : "false"}>
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
