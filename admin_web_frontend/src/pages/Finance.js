import React, { useEffect, useMemo, useState } from "react";
import { Card, Table } from "../components/ui";
import { createApiClient } from "../api/client";

const api = createApiClient();

// PUBLIC_INTERFACE
export default function Finance() {
  /** This is a public page component: finance transactions overview (stub). */
  const [loading, setLoading] = useState(true);
  const [txns, setTxns] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const res = await api.finance.listTransactions();
      if (!mounted) return;
      if (res.ok) setTxns(res.data || []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const total = useMemo(() => txns.reduce((acc, t) => acc + (Number(t.amount) || 0), 0), [txns]);

  const columns = useMemo(
    () => [
      { key: "date", header: "Date" },
      { key: "type", header: "Type" },
      { key: "status", header: "Status", render: (t) => <span className={`ds-chip ${t.status === "Completed" ? "ds-chip--success" : "ds-chip--warning"}`}>{t.status}</span> },
      { key: "amount", header: "Amount", render: (t) => <span className={t.amount < 0 ? "ds-negative" : "ds-positive"}>${t.amount}</span> },
    ],
    []
  );

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">Finance</h1>
          <p className="ds-page__subtitle">Transactions and cashflow overview</p>
        </div>
      </div>

      <div className="ds-grid ds-grid--two">
        <div className="ds-kpi">
          <div className="ds-kpi__label">Net Total (stub)</div>
          <div className="ds-kpi__value">${total}</div>
        </div>
        <div className="ds-kpi ds-kpi--accent">
          <div className="ds-kpi__label">Transactions</div>
          <div className="ds-kpi__value">{loading ? "—" : txns.length}</div>
        </div>
      </div>

      <Card title="Transaction Log" subtitle={loading ? "Loading…" : "Most recent first"}>
        <Table columns={columns} rows={txns} emptyLabel={loading ? "Loading…" : "No transactions yet."} />
      </Card>
    </div>
  );
}

