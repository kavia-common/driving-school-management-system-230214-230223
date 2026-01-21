import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Table } from "../components/ui";
import { createApiClient } from "../api/client";

const api = createApiClient();

// PUBLIC_INTERFACE
export default function Services() {
  /** This is a public page component: manage service offerings (stub). */
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [lessons, setLessons] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const res = await api.services.list();
      if (!mounted) return;
      if (res.ok) setServices(res.data || []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const columns = useMemo(
    () => [
      { key: "name", header: "Service" },
      { key: "lessons", header: "Lessons" },
      { key: "price", header: "Price", render: (s) => `$${s.price}` },
      { key: "active", header: "Status", render: (s) => <span className={`ds-chip ${s.active ? "ds-chip--success" : "ds-chip--warning"}`}>{s.active ? "Active" : "Disabled"}</span> },
      {
        key: "actions",
        header: "",
        render: (s) => (
          <div className="ds-row-actions">
            <button
              className="ds-link ds-link--button"
              onClick={async () => {
                const res = await api.services.update(s.id, { active: !s.active });
                if (res.ok) {
                  const refreshed = await api.services.list();
                  if (refreshed.ok) setServices(refreshed.data || []);
                }
              }}
            >
              {s.active ? "Disable" : "Enable"}
            </button>
          </div>
        ),
      },
    ],
    []
  );

  async function onAdd(e) {
    e.preventDefault();
    const p = Number(price);
    const l = Number(lessons);
    if (!name.trim() || !Number.isFinite(p) || !Number.isFinite(l)) return;

    const res = await api.services.create({ name: name.trim(), price: p, lessons: l });
    if (res.ok) {
      const refreshed = await api.services.list();
      if (refreshed.ok) setServices(refreshed.data || []);
      setName("");
      setPrice("");
      setLessons("");
    }
  }

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">Services</h1>
          <p className="ds-page__subtitle">Manage offerings and pricing</p>
        </div>
      </div>

      <div className="ds-grid ds-grid--two">
        <Card title="Service Catalog" subtitle={loading ? "Loading…" : `${services.length} service(s)`}>
          <Table columns={columns} rows={services} emptyLabel={loading ? "Loading…" : "No services yet."} />
        </Card>

        <Card title="Add Service" subtitle="Create a new offering (stub)">
          <form className="ds-form" onSubmit={onAdd}>
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend Package" />
            <Input label="Price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 450" inputMode="numeric" />
            <Input label="Lessons" value={lessons} onChange={(e) => setLessons(e.target.value)} placeholder="e.g. 12" inputMode="numeric" />
            <div className="ds-form__actions">
              <Button type="submit">Add</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

