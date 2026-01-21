import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select, Table, useToast } from "../components/ui";
import { createApiClient } from "../api/client";
import { makeCacheKey, useDataCache } from "../cache/DataCacheContext";
import { useCachedQuery } from "../cache/useCachedQuery";

const api = createApiClient();

function formatMoney(amount) {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}$${formatted}`;
}

function statusChipClass(status) {
  if (status === "Completed") return "ds-chip ds-chip--success";
  if (status === "Pending") return "ds-chip ds-chip--warning";
  if (status === "Failed") return "ds-chip ds-chip--danger";
  return "ds-chip";
}

// PUBLIC_INTERFACE
export default function Finance() {
  /** This is a public page component: finance overview with filters, summaries, and transaction log. */
  const toast = useToast();

  // Filters (server-driven)
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Sorting & pagination (server-driven)
  const [sort, setSort] = useState("date");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const cache = useDataCache();

  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      sort,
      order,
      q: search,
      filters: {
        from,
        to,
        type: type === "All" ? "" : type,
        status: status === "All" ? "" : status,
      },
    }),
    [page, pageSize, sort, order, search, from, to, type, status]
  );

  // List cache key includes pagination/sort (endpoint+params).
  const listKey = useMemo(() => makeCacheKey("finance.list", queryParams), [queryParams]);

  const {
    data: listData,
    loading,
    error,
    revalidate: load,
  } = useCachedQuery({
    key: listKey,
    fetcher: () => api.finance.list(queryParams),
    select: (res) => (res?.ok ? res.data : null),
    staleTimeMs: 5_000,
  });

  const rows = useMemo(() => (Array.isArray(listData?.items) ? listData.items : []), [listData]);
  const total = useMemo(() => Number(listData?.total || 0), [listData]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(Number(total || 0) / Number(pageSize || 10))), [total, pageSize]);

  // Summary ignores pagination, but respects filters/search.
  const summaryParams = useMemo(
    () => ({
      q: search,
      filters: {
        from,
        to,
        type: type === "All" ? "" : type,
        status: status === "All" ? "" : status,
      },
    }),
    [search, from, to, type, status]
  );

  const summaryKey = useMemo(() => makeCacheKey("finance.getSummary", summaryParams), [summaryParams]);

  const {
    data: summaryData,
    loading: summaryLoading,
    revalidate: loadSummary,
  } = useCachedQuery({
    key: summaryKey,
    fetcher: () => api.finance.getSummary(summaryParams),
    select: (res) =>
      res?.ok
        ? {
            totalRevenue: Number(res.data?.totalRevenue || 0),
            pending: Number(res.data?.pending || 0),
            refunds: Number(res.data?.refunds || 0),
          }
        : // Non-blocking fallback (missing backend endpoint)
          { totalRevenue: 0, pending: 0, refunds: 0 },
    staleTimeMs: 10_000,
  });

  const summary = useMemo(
    () =>
      summaryData || {
        totalRevenue: 0,
        pending: 0,
        refunds: 0,
      },
    [summaryData]
  );

  // Reset to first page on filter/sort changes
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type, status, from, to, sort, order, pageSize]);

  const columns = useMemo(
    () => [
      {
        key: "date",
        header: "Date",
        render: (t) => <span style={{ fontWeight: 800 }}>{t.date}</span>,
      },
      { key: "reference", header: "Reference", render: (t) => <span className="ds-muted">{t.reference || "—"}</span> },
      { key: "customer", header: "Customer", render: (t) => <span>{t.customer || "—"}</span> },
      { key: "type", header: "Type" },
      {
        key: "status",
        header: "Status",
        render: (t) => <span className={statusChipClass(t.status)}>{t.status}</span>,
      },
      {
        key: "amount",
        header: "Amount",
        render: (t) => <span className={Number(t.amount) < 0 ? "ds-negative" : "ds-positive"}>{formatMoney(t.amount)}</span>,
      },
      {
        key: "actions",
        header: "Actions",
        render: (t) => (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="ds-link ds-link--button"
              onClick={() => toast.info(`View ${t.id} (placeholder)`)}
              title="View"
            >
              View
            </button>
            <button
              type="button"
              className="ds-link ds-link--button"
              onClick={() => toast.info(`Edit ${t.id} (placeholder)`)}
              title="Edit"
            >
              Edit
            </button>
            <button
              type="button"
              className="ds-link ds-link--button"
              onClick={async () => {
                const okConfirm = window.confirm("Delete this transaction? (placeholder behavior)");
                if (!okConfirm) return;

                const res = await api.finance.remove(t.id);
                if (!res.ok) {
                  toast.error(res.message || "Failed to delete transaction.");
                  return;
                }
                toast.success("Transaction deleted.");

                cache.invalidate("finance.list*");
                cache.invalidate("finance.getSummary*");
                await load();
                await loadSummary();
              }}
              title="Delete"
              style={{ color: "var(--danger)" }}
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    [toast, load, loadSummary]
  );

  const emptyLabel = useMemo(() => {
    if (loading) return "Loading…";
    if (error) return "Unable to load transactions.";
    return "No transactions match your filters.";
  }, [loading, error]);

  return (
    <div className="ds-page">
      <div className="ds-page__header">
        <div>
          <h1 className="ds-page__title">Finance</h1>
          <p className="ds-page__subtitle">Overview, filters, and transaction summaries</p>
        </div>

        <div className="ds-page__actions">
          <Button
            variant="secondary"
            onClick={async () => {
              toast.info("Create transaction (minimal placeholder)");
              const res = await api.finance.create({
                date: new Date().toISOString().slice(0, 10),
                type: "Payment",
                status: "Pending",
                amount: 100,
                reference: `INV-${String(Math.random()).slice(2, 6)}`,
                customer: "Walk-in",
                notes: "Manual entry",
              });
              if (!res.ok) {
                toast.error(res.message || "Failed to create transaction.");
                return;
              }
              toast.success("Transaction created.");

              cache.invalidate("finance.list*");
              cache.invalidate("finance.getSummary*");
              await load();
              await loadSummary();
            }}
          >
            New Transaction
          </Button>
        </div>
      </div>

      <div className="ds-grid ds-grid--three" style={{ marginBottom: 16 }}>
        <div className="ds-kpi">
          <div className="ds-kpi__label">Total Revenue</div>
          <div className="ds-kpi__value">{summaryLoading ? "—" : formatMoney(summary.totalRevenue)}</div>
        </div>
        <div className="ds-kpi ds-kpi--accent">
          <div className="ds-kpi__label">Pending</div>
          <div className="ds-kpi__value">{summaryLoading ? "—" : summary.pending}</div>
        </div>
        <div className="ds-kpi">
          <div className="ds-kpi__label">Refunds</div>
          <div className="ds-kpi__value">{summaryLoading ? "—" : formatMoney(-Math.abs(summary.refunds || 0))}</div>
        </div>
      </div>

      <Card
        title="Filters"
        subtitle="Use filters to narrow results; pagination and sorting are server-driven."
        actions={
          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setType("All");
                setStatus("All");
                setFrom("");
                setTo("");
                setSort("date");
                setOrder("desc");
                setPage(1);
                setPageSize(10);
                toast.info("Filters reset.");
              }}
            >
              Reset
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                await load();
                await loadSummary();
                toast.success("Refreshed.");
              }}
            >
              Refresh
            </Button>
          </div>
        }
      >
        <div className="ds-form__grid">
          <Input label="Search" placeholder="ID, reference, customer, notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="All">All</option>
            <option value="Payment">Payment</option>
            <option value="Refund">Refund</option>
          </Select>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="All">All</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </Select>
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Select label="Sort" value={`${sort}:${order}`} onChange={(e) => {
            const [s, o] = String(e.target.value).split(":");
            setSort(s);
            setOrder(o);
          }}>
            <option value="date:desc">Date (newest)</option>
            <option value="date:asc">Date (oldest)</option>
            <option value="amount:desc">Amount (high → low)</option>
            <option value="amount:asc">Amount (low → high)</option>
            <option value="status:asc">Status (A → Z)</option>
            <option value="type:asc">Type (A → Z)</option>
          </Select>
        </div>
      </Card>

      <Card
        title="Transactions"
        subtitle={
          loading
            ? "Loading…"
            : error
              ? error
              : `Showing ${(rows || []).length} of ${total} transactions`
        }
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="ds-muted" style={{ fontWeight: 800 }}>
              Page {page} / {totalPages}
            </span>
            <Button variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </Button>
            <Button variant="ghost" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next
            </Button>
            <Select
              aria-label="Page size"
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value) || 10)}
              style={{ minWidth: 120 }}
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
            </Select>
          </div>
        }
      >
        <Table columns={columns} rows={rows} emptyLabel={emptyLabel} />

        {!loading && error ? (
          <div style={{ marginTop: 12 }}>
            <Button variant="secondary" onClick={load}>
              Retry
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
