import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Input, Select, useToast } from "../components/ui";
import { createApiClient } from "../api/client";
import { makeCacheKey, useDataCache } from "../cache/DataCacheContext";
import { useCachedQuery } from "../cache/useCachedQuery";

const api = createApiClient();

const emptyService = {
  name: "",
  price: "",
  lessons: "",
  active: true,
};

function validateMoney(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "Price is required.";
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return "Enter a valid non-negative price.";
  return "";
}

function validateLessons(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "Lessons is required.";
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return "Enter a whole number greater than 0.";
  return "";
}

// PUBLIC_INTERFACE
export default function ServiceForm() {
  /** This is a public page component: create or edit a service with validation and UI states. */
  const toast = useToast();
  const { id } = useParams();
  const isNew = id == null;

  const navigate = useNavigate();

  const cache = useDataCache();

  const [saving, setSaving] = useState(false);

  const [service, setService] = useState(emptyService);
  const [touched, setTouched] = useState({ name: false, price: false, lessons: false });
  const [formError, setFormError] = useState("");

  const detailKey = useMemo(() => (isNew ? "" : makeCacheKey("services.get", { id })), [isNew, id]);
  const { data: serviceData, loading } = useCachedQuery({
    key: detailKey,
    enabled: !isNew && Boolean(id),
    fetcher: () => api.services.get(id),
    select: (res) => (res?.ok ? res.data : null),
    staleTimeMs: 10_000,
  });

  useEffect(() => {
    if (isNew) {
      setService(emptyService);
      setFormError("");
      return;
    }

    if (!loading && serviceData) {
      const data = serviceData || {};
      setService({
        name: String(data.name || ""),
        price: data.price == null ? "" : String(data.price),
        lessons: data.lessons == null ? "" : String(data.lessons),
        active: Boolean(data.active),
      });
      setFormError("");
    }
  }, [isNew, loading, serviceData]);

  const title = useMemo(() => (isNew ? "Create Service" : "Edit Service"), [isNew]);

  const nameError = useMemo(() => {
    if (!touched.name) return "";
    const v = String(service.name || "").trim();
    if (!v) return "Service name is required.";
    if (v.length < 2) return "Service name is too short.";
    return "";
  }, [service.name, touched.name]);

  const priceError = useMemo(() => {
    if (!touched.price) return "";
    return validateMoney(service.price);
  }, [service.price, touched.price]);

  const lessonsError = useMemo(() => {
    if (!touched.lessons) return "";
    return validateLessons(service.lessons);
  }, [service.lessons, touched.lessons]);

  const canSubmit = useMemo(() => {
    const nameOk = String(service.name || "").trim().length >= 2;
    const pOk = !validateMoney(service.price);
    const lOk = !validateLessons(service.lessons);
    return Boolean(nameOk && pOk && lOk);
  }, [service.name, service.price, service.lessons]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");
    setTouched({ name: true, price: true, lessons: true });

    const nErr = String(service.name || "").trim().length >= 2 ? "" : "Please enter a valid service name.";
    const pErr = validateMoney(service.price);
    const lErr = validateLessons(service.lessons);

    if (nErr || pErr || lErr) {
      setFormError(nErr || pErr || lErr || "Please correct the highlighted fields.");
      return;
    }

    setSaving(true);

    const payload = {
      name: String(service.name).trim(),
      price: Number(service.price),
      lessons: Number(service.lessons),
      active: Boolean(service.active),
    };

    const res = isNew ? await api.services.create(payload) : await api.services.update(id, payload);
    setSaving(false);

    if (!res.ok) {
      const msg = res.message || res.error || "Save failed.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    toast.success(isNew ? "Service created." : "Service updated.");

    cache.invalidate("services.list*");
    if (!isNew) cache.invalidate(makeCacheKey("services.get", { id }));

    navigate("/services", { replace: true, state: { flash: isNew ? "Service created." : "Service updated." } });
  }

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">{title}</h1>
          <p className="ds-page__subtitle">{isNew ? "Add a new service offering" : "Update service details"}</p>
        </div>
        <div className="ds-page__actions">
          <Link to="/services">
            <Button variant="ghost">Back</Button>
          </Link>
        </div>
      </div>

      <Card title="Service Details" subtitle={loading ? "Loading…" : "Complete the details below"}>
        {formError && <div className="ds-alert ds-alert--error">{formError}</div>}

        <form className="ds-form" onSubmit={onSubmit}>
          <div className="ds-form__grid">
            <Input
              label="Service Name"
              value={service.name}
              onChange={(e) => setService((s) => ({ ...s, name: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              placeholder="e.g. Weekend Package"
              disabled={loading || saving}
              error={nameError}
              autoComplete="off"
            />

            <Input
              label="Price"
              value={service.price}
              onChange={(e) => setService((s) => ({ ...s, price: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, price: true }))}
              placeholder="e.g. 450"
              inputMode="decimal"
              disabled={loading || saving}
              error={priceError}
            />

            <Input
              label="Lessons"
              value={service.lessons}
              onChange={(e) => setService((s) => ({ ...s, lessons: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, lessons: true }))}
              placeholder="e.g. 12"
              inputMode="numeric"
              disabled={loading || saving}
              error={lessonsError}
            />

            <Select
              label="Status"
              value={service.active ? "Active" : "Disabled"}
              onChange={(e) => setService((s) => ({ ...s, active: e.target.value === "Active" }))}
              disabled={loading || saving}
            >
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
            </Select>
          </div>

          <div className="ds-form__actions">
            <Button type="submit" disabled={loading || saving || !canSubmit}>
              {saving ? "Saving…" : isNew ? "Create Service" : "Save Changes"}
            </Button>
            <Link to="/services" className="ds-link-muted" aria-disabled={saving ? "true" : "false"}>
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
