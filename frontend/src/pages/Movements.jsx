import { useState } from "react";
import { fdate } from "../api";
import { Table } from "../ui/Table";
import { Pager } from "../ui/Pager";
import { useList } from "../hooks/useList";

const MCOLS = [
  ["createdAt", "When", fdate],
  ["product.name", "Product"],
  ["type", "Type"],
  ["quantity", "Qty", (v) => <b className={v < 0 ? "text-red-700" : "text-green-700"}>{v > 0 ? `+${v}` : v}</b>],
  ["quantityBefore", "Before"],
  ["quantityAfter", "After"],
  ["reference.referenceNo", "Reference"],
  ["performedBy.name", "By"],
];

export function Movements() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const L = useList("/stock/movements", { page, limit: 20, type: type || undefined, sort: "-createdAt" });
  return (
    <div className="page-stack">
      <section className="page-hero page-hero-movements">
        <div>
          <span className="page-eyebrow">
            <i /> COMPLETE INVENTORY AUDIT TRAIL
          </span>
          <h1>Stock movements<span className="hero-period">.</span></h1>
          <p>Follow every stock change back to its source, product and teammate.</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span>⇄</span>
          <i /><b />
        </div>
      </section>
      <section className="resource-toolbar">
        <div className="resource-result">
          <span className="result-spark">⇄</span>
          <span>{L.loading ? "Gathering your records…" : `${L.meta.total ?? L.rows.length} stock movements recorded`}</span>
        </div>
        <div className="resource-controls">
          <select className="filter-control" aria-label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">All movement types</option>
            {["OPENING", "PURCHASE_IN", "SALE_OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
      </section>
      <div className="table-shell">
        <Table cols={MCOLS} rows={L.rows} loading={L.loading} err={L.err} onRetry={L.reload} />
      </div>
      <Pager meta={L.meta} page={page} setPage={setPage} />
    </div>
  );
}

export { MCOLS };
