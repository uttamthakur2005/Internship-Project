import { useState } from "react";
import { rupee, fdate, today } from "../api";
import { Badge } from "../ui/Badge";
import { Table } from "../ui/Table";
import { Pager } from "../ui/Pager";
import { useList } from "../hooks/useList";
import { MCOLS } from "./Movements";

const REP = {
  stock: {
    l: "Current stock",
    u: "/reports/stock",
    note: "All products: stockQty × (last purchase cost, else purchase price).",
    cols: [
      ["sku", "SKU"],
      ["name", "Name"],
      ["category", "Category"],
      ["stockQty", "Stock"],
      ["minStockLevel", "Min"],
      ["stockStatus", "Status", (v) => <Badge s={v} />],
      ["estimatedValue", "Est. value", rupee],
    ],
  },
  low: {
    l: "Low stock",
    u: "/reports/low-stock",
    note: "Active products where 0 < stockQty ≤ minStockLevel.",
    cols: [
      ["sku", "SKU"],
      ["name", "Name"],
      ["category.name", "Category"],
      ["stockQty", "Stock"],
      ["minStockLevel", "Min"],
      ["shortfall", "Shortfall"],
    ],
  },
  out: {
    l: "Out of stock",
    u: "/reports/out-of-stock",
    note: "Active products where stockQty = 0.",
    cols: [
      ["sku", "SKU"],
      ["name", "Name"],
      ["category.name", "Category"],
      ["minStockLevel", "Min"],
    ],
  },
  pur: {
    l: "Purchases",
    u: "/reports/purchases",
    range: 1,
    note: "Received purchases by received date.",
    cols: [
      ["referenceNo", "Reference"],
      ["supplierSnapshot.name", "Supplier"],
      ["receivedAt", "Received", fdate],
      ["items", "Items", (v) => v?.length],
      ["total", "Total", rupee],
    ],
  },
  sal: {
    l: "Sales",
    u: "/reports/sales",
    range: 1,
    note: "Confirmed sales by confirmed date. This is revenue, not profit.",
    cols: [
      ["referenceNo", "Reference"],
      ["customerSnapshot.name", "Customer", (v) => v || "Walk-in customer"],
      ["confirmedAt", "Confirmed", fdate],
      ["items", "Items", (v) => v?.length],
      ["total", "Total", rupee],
    ],
  },
  mov: {
    l: "Movements",
    u: "/reports/movements",
    range: 1,
    note: "Every stock movement created in the date range.",
    cols: MCOLS,
  },
};

export function Reports() {
  const [k, setK] = useState("stock");
  const r = REP[k];
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(today(29));
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState("");
  const L = useList(r.u, { page, limit: 20, ...(r.range ? { from, to } : { search: search || undefined }) });
  return (
    <div className="page-stack">
      <section className="page-hero page-hero-reports">
        <div>
          <span className="page-eyebrow">
            <i /> CLEAR NUMBERS, BETTER DECISIONS
          </span>
          <h1>Reports<span className="hero-period">.</span></h1>
          <p>A reliable view of your inventory, transactions and stock history.</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span>▤</span>
          <i /><b />
        </div>
      </section>
      <div className="report-tabs" role="tablist" aria-label="Report type">
        {Object.entries(REP).map(([id, x]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === k}
            className={`report-tab ${id === k ? "report-tab-active" : ""}`}
            onClick={() => { setK(id); setPage(1); }}
          >
            <span>{["▦", "↘", "!", "↙", "↗", "⇄"][Object.keys(REP).indexOf(id)]}</span>
            {x.l}
          </button>
        ))}
      </div>
      <section className="report-panel">
        <div className="report-panel-heading">
          <div>
            <span className="section-kicker">INVENTORY INTELLIGENCE</span>
            <h2>{r.l}</h2>
            <p>{r.note}</p>
          </div>
          {L.meta.grandTotal !== undefined && (
            <div className="report-total">
              <small>GRAND TOTAL</small>
              <b>{rupee(L.meta.grandTotal)}</b>
            </div>
          )}
        </div>
        <div className="resource-toolbar report-toolbar">
          <div className="resource-result">
            <span className="result-spark">✦</span>
            <span>{L.loading ? "Preparing report…" : `${L.meta.total ?? L.rows.length} records in this report`}</span>
          </div>
          <div className="resource-controls">
            {r.range ? (
              <>
                <label className="date-control">
                  <span>FROM</span>
                  <input type="date" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
                </label>
                <label className="date-control">
                  <span>TO</span>
                  <input type="date" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
                </label>
              </>
            ) : (
              <label className="search-control">
                <span>⌕</span>
                <input placeholder="Search name or SKU…" aria-label="Search name or SKU" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                {search && <button onClick={() => setSearch("")} aria-label="Clear search">×</button>}
              </label>
            )}
          </div>
        </div>
        <div className="table-shell">
          <Table cols={r.cols} rows={L.rows} loading={L.loading} err={L.err} onRetry={L.reload} />
        </div>
        <Pager meta={L.meta} page={page} setPage={setPage} />
      </section>
    </div>
  );
}
