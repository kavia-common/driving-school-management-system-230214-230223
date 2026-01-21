import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Input, Select, useToast } from "../components/ui";
import { createApiClient } from "../api/client";
import { makeCacheKey, useDataCache } from "../cache/DataCacheContext";
import { useCachedQuery } from "../cache/useCachedQuery";

const api = createApiClient();

const emptyInstructor = {
  firstName: "",
  lastName: "",
  phone: "",
  status: "Available",
};

function validatePhone(phone) {
  const p = String(phone || "").trim();
  if (!p) return ""; // optional
  const ok = /^[0-9\s()+\-.]{7,}$/.test(p);
  return ok ? "" : "Enter a valid phone number (or leave blank).";
}

// PUBLIC_INTERFACE
export default function InstructorForm() {
  /** This is a public page component: create or edit an instructor with validation and UI states. */
  const toast = useToast();
  const { id } = useParams();
  const isNew = id == null;
  const navigate = useNavigate();

  const cache = useDataCache();

  const [saving, setSaving] = useState(false);
  const [instructor, setInstructor] = useState(emptyInstructor);

  const [touched, setTouched] = useState({ firstName: false, lastName: false, phone: false });
  const [formError, setFormError] = useState("");

  const detailKey = useMemo(() => (isNew ? "" : makeCacheKey("instructors.get", { id })), [isNew, id]);
  const { data: instructorData, loading } = useCachedQuery({
    key: detailKey,
    enabled: !isNew && Boolean(id),
    fetcher: () => api.instructors.get(id),
    select: (res) => (res?.ok ? res.data : null),
    staleTimeMs: 10_000,
  });

  useEffect(() => {
    if (isNew) {
      setInstructor(emptyInstructor);
      setFormError("");
      return;
    }

    if (!loading && instructorData) {
      setInstructor(instructorData || emptyInstructor);
      setFormError("");
    }
  }, [isNew, loading, instructorData]);

  const title = useMemo(() => (isNew ? "Create Instructor" : "Edit Instructor"), [isNew]);

  const firstNameError = useMemo(() => {
    if (!touched.firstName) return "";
    if (!instructor.firstName.trim()) return "First name is required.";
    if (instructor.firstName.trim().length < 2) return "First name is too short.";
    return "";
  }, [instructor.firstName, touched.firstName]);

  const lastNameError = useMemo(() => {
    if (!touched.lastName) return "";
    if (!instructor.lastName.trim()) return "Last name is required.";
    if (instructor.lastName.trim().length < 2) return "Last name is too short.";
    return "";
  }, [instructor.lastName, touched.lastName]);

  const phoneError = useMemo(() => {
    if (!touched.phone) return "";
    return validatePhone(instructor.phone);
  }, [instructor.phone, touched.phone]);

  const canSubmit = useMemo(() => {
    const reqOk = instructor.firstName.trim() && instructor.lastName.trim();
    const phoneOk = !validatePhone(instructor.phone);
    return Boolean(reqOk && phoneOk);
  }, [instructor.firstName, instructor.lastName, instructor.phone]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");
    setTouched({ firstName: true, lastName: true, phone: true });

    const phErr = validatePhone(instructor.phone);
    if (!instructor.firstName.trim() || !instructor.lastName.trim() || phErr) {
      setFormError(phErr || "Please correct the highlighted fields.");
      return;
    }

    setSaving(true);

    const payload = {
      firstName: instructor.firstName.trim(),
      lastName: instructor.lastName.trim(),
      phone: instructor.phone.trim(),
      status: instructor.status,
    };

    const res = isNew ? await api.instructors.create(payload) : await api.instructors.update(id, payload);
    setSaving(false);

    if (!res.ok) {
      const msg = res.message || res.error || "Save failed.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    toast.success(isNew ? "Instructor created." : "Instructor updated.");

    cache.invalidate("instructors.list*");
    cache.invalidate("instructors.listAssignedStudents*");
    if (!isNew) cache.invalidate(makeCacheKey("instructors.get", { id }));

    navigate("/instructors", { replace: true, state: { flash: isNew ? "Instructor created." : "Instructor updated." } });
  }

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">{title}</h1>
          <p className="ds-page__subtitle">{isNew ? "Add a new instructor to the roster" : "Update instructor details"}</p>
        </div>
        <div className="ds-page__actions">
          <Link to="/instructors">
            <Button variant="ghost">Back</Button>
          </Link>
        </div>
      </div>

      <Card title="Instructor Details" subtitle={loading ? "Loading…" : "Complete the details below"}>
        {formError && <div className="ds-alert ds-alert--error">{formError}</div>}

        <form className="ds-form" onSubmit={onSubmit}>
          <div className="ds-form__grid">
            <Input
              label="First Name"
              value={instructor.firstName}
              onChange={(e) => setInstructor((s) => ({ ...s, firstName: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
              placeholder="e.g. Sophia"
              disabled={loading || saving}
              error={firstNameError}
              autoComplete="given-name"
            />

            <Input
              label="Last Name"
              value={instructor.lastName}
              onChange={(e) => setInstructor((s) => ({ ...s, lastName: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, lastName: true }))}
              placeholder="e.g. Reed"
              disabled={loading || saving}
              error={lastNameError}
              autoComplete="family-name"
            />

            <Input
              label="Phone (optional)"
              value={instructor.phone}
              onChange={(e) => setInstructor((s) => ({ ...s, phone: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              placeholder="+1 (555) 010-0000"
              disabled={loading || saving}
              error={phoneError}
              inputMode="tel"
              autoComplete="tel"
            />

            <Select
              label="Status"
              value={instructor.status}
              onChange={(e) => setInstructor((s) => ({ ...s, status: e.target.value }))}
              disabled={loading || saving}
            >
              <option value="Available">Available</option>
              <option value="Assigned">Assigned</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </div>

          <div className="ds-form__actions">
            <Button type="submit" disabled={loading || saving || !canSubmit}>
              {saving ? "Saving…" : isNew ? "Create Instructor" : "Save Changes"}
            </Button>
            <Link to="/instructors" className="ds-link-muted" aria-disabled={saving ? "true" : "false"}>
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
