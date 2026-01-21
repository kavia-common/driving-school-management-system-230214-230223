import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Select, Table } from "../components/ui";
import { createApiClient } from "../api/client";

const api = createApiClient();

// PUBLIC_INTERFACE
export default function Documents() {
  /** This is a public page component: track student documents (stub). */
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const res = await api.documents.list();
      if (!mounted) return;
      if (res.ok) setDocs(res.data || []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const columns = useMemo(
    () => [
      { key: "studentId", header: "Student ID" },
      { key: "type", header: "Document Type" },
      {
        key: "status",
        header: "Status",
        render: (d) => (
          <span className={`ds-chip ${d.status === "Received" ? "ds-chip--success" : "ds-chip--warning"}`}>
            {d.status}
          </span>
        ),
      },
      { key: "updatedAt", header: "Updated" },
      {
        key: "actions",
        header: "",
        render: (d) => (
          <div className="ds-row-actions">
            <button
              className="ds-link ds-link--button"
              onClick={async () => {
                const next = d.status === "Received" ? "Missing" : "Received";
                const res = await api.documents.updateStatus(d.id, next);
                if (res.ok) {
                  const refreshed = await api.documents.list();
                  if (refreshed.ok) setDocs(refreshed.data || []);
                }
              }}
            >
              Toggle
            </button>
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
          <h1 className="ds-page__title">Documents</h1>
          <p className="ds-page__subtitle">Track required paperwork for compliance</p>
        </div>
      </div>

      <Card title="Document Tracker" subtitle={loading ? "Loading…" : `${docs.length} item(s)`}>
        <Table columns={columns} rows={docs} emptyLabel={loading ? "Loading…" : "No documents tracked yet."} />
        <div className="ds-muted ds-mt">
          Tip: This is a stubbed tracker. Later, integrate with backend document uploads and verification.
        </div>
      </Card>
    </div>
  );
}

