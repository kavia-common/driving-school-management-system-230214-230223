import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui";
import { createApiClient } from "../api/client";

const api = createApiClient();

// PUBLIC_INTERFACE
export default function Dashboard() {
  /** This is a public page component: KPIs and recent activity. */
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const res = await api.dashboard.getSummary();
      if (!mounted) return;
      if (res.ok) {
        setKpis(res.data.kpis || []);
        setActivity(res.data.recentActivity || []);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const subtitle = useMemo(() => {
    const { apiBase } = api.config();
    return `Connected to: ${apiBase} (stub mode)`;
  }, []);

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">Dashboard</h1>
          <p className="ds-page__subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="ds-grid ds-grid--kpis">
        {(loading ? new Array(4).fill(null) : kpis).map((k, idx) => (
          <div key={k?.label || idx} className="ds-kpi">
            <div className="ds-kpi__label">{loading ? "Loading…" : k.label}</div>
            <div className="ds-kpi__value">{loading ? "—" : k.value}</div>
          </div>
        ))}
      </div>

      <div className="ds-grid ds-grid--two">
        <Card
          title="Recent Activity"
          subtitle="Latest operations across modules"
        >
          <ul className="ds-list">
            {activity.length === 0 ? (
              <li className="ds-muted">No activity yet.</li>
            ) : (
              activity.map((a) => (
                <li key={a.id} className="ds-list__item">
                  <div className="ds-list__main">
                    <div className="ds-list__title">{a.label}</div>
                    <div className="ds-list__meta">
                      <span>{a.meta}</span>
                      <span className="ds-dot" aria-hidden="true">•</span>
                      <span>{a.at}</span>
                    </div>
                  </div>
                  <span className="ds-chip ds-chip--info">Event</span>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card title="Operational Notes" subtitle="Quick reminders for admins">
          <div className="ds-callout">
            <div className="ds-callout__title">Tip</div>
            <div className="ds-callout__body">
              Use the Students module to create/edit profiles, then assign instructors from the Instructors module. Track missing paperwork under Documents.
            </div>
          </div>

          <div className="ds-callout ds-callout--warning">
            <div className="ds-callout__title">Reminder</div>
            <div className="ds-callout__body">
              Finance totals are currently stubbed. Once a backend is available, switch API client to network mode.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

