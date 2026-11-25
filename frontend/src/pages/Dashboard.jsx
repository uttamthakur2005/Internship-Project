import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { get, errMsg, rupee, today } from "../api";
import { useCount } from "../hooks/useCount";

function Stat({ label, value, money, tone = "", icon = "✦", caption = "CURRENT OVERVIEW" }) {
  const n = useCount(value);
  return (
    <article className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-caption">{caption}</span>
        <span className="stat-spark">↗</span>
      </div>
      <div className="stat-value">
        {money ? rupee(n) : n.toLocaleString("en-IN")}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-progress"><i /></div>
    </article>
  );
}

export function Dashboard() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [tr, setTr] = useState([]);
  const [err, setErr] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const p = { from: today(days - 1), to: today() };
    setErr("");
    Promise.all([
      get("/dashboard/summary", p),
      get("/dashboard/trends", { ...p, interval: "day" }),
    ])
      .then(([s, t]) => {
        setD(s.data);
        const m = {};
        t.data.sales.forEach((x) => (m[x._id] = { day: x._id, sales: x.total / 100 }));
        t.data.purchases.forEach((x) => (m[x._id] = { ...m[x._id], day: x._id, purchases: x.total / 100 }));
        setTr(Object.values(m).sort((a, b) => a.day.localeCompare(b.day)));
      })
      .catch((e) => setErr(errMsg(e)));
  }, [days, retry]);
  if (err)
    return (
      <div className="dashboard-error">
        <span>!</span>
        <div>
          <b>We couldn't load your overview.</b>
          <p>{err}</p>
          <button className="btn-s" onClick={() => setRetry((v) => v + 1)}>Try again</button>
        </div>
      </div>
    );
  if (!d)
    return (
      <div className="dashboard-loading">
        <span className="loading-orbit" />
        <b>Setting up your overview…</b>
        <small>Your inventory insights are on their way.</small>
      </div>
    );
  const mini = (title, rows, accent) => (
    <article className={`insight-card ${accent || ""}`}>
      <div className="insight-heading">
        <span className="insight-mark">{accent === "insight-danger" ? "!" : "↗"}</span>
        <div>
          <h3>{title}</h3>
          <small>{rows.length ? `${rows.length} items need a closer look` : "Looking good right now"}</small>
        </div>
        <span className="insight-arrow">↗</span>
      </div>
      {rows.length ? (
        <div className="insight-list">
          {rows.slice(0, 5).map((r) => (
            <div key={r._id} className="insight-row">
              <span className="insight-product-mark">{r.name?.slice(0, 1).toUpperCase()}</span>
              <span className="insight-name">
                <b>{r.name}</b>
                <small>{r.sku}</small>
              </span>
              <span className="insight-quantity">
                <b>{r.stockQty}</b>
                <small>of {r.minStockLevel}</small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="insight-empty"><span>✓</span> All clear. No stock alerts.</div>
      )}
    </article>
  );
  const rec = (title, rows, accent) => (
    <article className="recent-card">
      <div className="recent-heading">
        <span className={`recent-mark ${accent || ""}`}>{accent === "recent-sales" ? "↗" : "↙"}</span>
        <div>
          <h3>{title}</h3>
          <small>Latest activity</small>
        </div>
        <span className="insight-arrow">↗</span>
      </div>
      {rows.slice(0, 5).map((r) => (
        <div key={r._id} className="recent-row">
          <span className="recent-ref">
            <b>{r.referenceNo}</b>
            <small>{(r.updatedAt || r.createdAt) ? new Date(r.updatedAt || r.createdAt).toLocaleDateString("en-IN") : "—"}</small>
          </span>
          <span className="recent-total">{rupee(r.total)}</span>
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium`}
            style={{ background: r.status === "confirmed" || r.status === "received" ? "#eaf7e7" : r.status === "cancelled" ? "#fff0f2" : "#edf2ff",
              color: r.status === "confirmed" || r.status === "received" ? "#528148" : r.status === "cancelled" ? "#c55368" : "#637dc2" }}>
            {r.status ? r.status[0].toUpperCase() + r.status.slice(1) : "—"}
          </span>
        </div>
      ))}
      {!rows.length && <div className="recent-empty">Nothing here yet. Your activity will show up here.</div>}
    </article>
  );
  return (
    <div className="page-stack dashboard-page">
      <section className="dashboard-welcome">
        <div className="welcome-copy">
          <span className="page-eyebrow"><i /> YOUR BUSINESS AT A GLANCE</span>
          <h1>Good to see you<span className="hero-period">.</span></h1>
          <p>Here's what's happening with your inventory today.</p>
        </div>
        <label className="period-picker">
          <span>VIEW PERIOD</span>
          <select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <b>⌄</b>
        </label>
        <div className="welcome-decoration" aria-hidden="true"><i /><i /><i /></div>
      </section>
      <section aria-label="Inventory counts" className="stat-grid">
        <Stat label="Active products" value={d.counts.activeProducts} icon="▦" caption="CATALOG" />
        <Stat label="Categories" value={d.counts.categories} icon="⌗" caption="ORGANIZATION" />
        <Stat label="Low stock" value={d.lowStock.length} icon="↘" tone="stat-warn" caption="NEEDS ATTENTION" />
        <Stat label="Out of stock" value={d.outOfStock.length} icon="!" tone="stat-danger" caption="RESTOCK SOON" />
      </section>
      <section aria-label="Inventory value and totals" className="stat-grid stat-grid-finance">
        <Stat money label="Estimated stock value" value={d.estimatedStockValue} icon="◈" caption="AT LAST PURCHASE COST" />
        <Stat money label="Sales revenue" value={d.salesRevenue} icon="↗" caption={`LAST ${days} DAYS`} />
        <Stat money label="Purchases received" value={d.purchaseTotal} icon="↙" caption={`LAST ${days} DAYS`} />
      </section>
      <section className="chart-card">
        <div className="section-heading">
          <div>
            <span className="section-kicker">MOVEMENT OVER TIME</span>
            <h2>Sales &amp; purchases</h2>
            <p>See how stock is flowing through your business.</p>
          </div>
          <div className="chart-legend">
            <span><i className="legend-sales" /> Sales</span>
            <span><i className="legend-purchases" /> Purchases</span>
          </div>
        </div>
        <div className="chart-area">
          <ResponsiveContainer>
            <LineChart data={tr} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid stroke="#eeedf4" vertical={false} />
              <XAxis dataKey="day" tickFormatter={(v) => v.slice(5)} tickLine={false} axisLine={false} fontSize={10} stroke="#9695a8" />
              <YAxis tickLine={false} axisLine={false} fontSize={10} stroke="#9695a8" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #eeedf4", boxShadow: "0 12px 35px #24204a18", fontSize: 12 }}
                formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, undefined]}
              />
              <Legend verticalAlign="top" align="right" height={28} iconType="circle" wrapperStyle={{ fontSize: 10, color: "#77768c" }} />
              <Line type="monotone" dataKey="sales" name="Sales" stroke="#8060df" strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} animationDuration={1200} />
              <Line type="monotone" dataKey="purchases" name="Purchases" stroke="#e99b58" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} animationDuration={1400} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <div className="section-heading compact-heading">
        <div>
          <span className="section-kicker">YOUR INVENTORY HEALTH</span>
          <h2>What needs your attention</h2>
        </div>
      </div>
      <section className="insight-grid">
        {mini("Low-stock alerts", d.lowStock, "insight-warn")}
        {mini("Out of stock", d.outOfStock, "insight-danger")}
      </section>
      <div className="section-heading compact-heading">
        <div>
          <span className="section-kicker">RECENT ACTIVITY</span>
          <h2>Latest transactions</h2>
        </div>
      </div>
      <section className="insight-grid">
        {rec("Recent purchases", d.recentPurchases, "recent-purchases")}
        {rec("Recent sales", d.recentSales, "recent-sales")}
      </section>
      <section className="movement-card">
        <div className="movement-heading">
          <span className="movement-mark">⇄</span>
          <div>
            <span className="section-kicker">AUDIT TRAIL</span>
            <h2>Stock movement summary</h2>
            <p>Every quantity change, accounted for.</p>
          </div>
        </div>
        <div className="movement-pills">
          {d.movementSummary.map((m, index) => (
            <div key={m._id} className="movement-pill" style={{ "--item-delay": `${index * 70}ms` }}>
              <span className="movement-pill-icon">
                {m._id === "SALE_OUT" || m._id === "ADJUSTMENT_OUT" ? "↗" : "↙"}
              </span>
              <span>
                <b>{m._id.replaceAll("_", " ")}</b>
                <small>{m.count} moves · {m.quantity} units</small>
              </span>
              <i>↗</i>
            </div>
          ))}
          {!d.movementSummary.length && (
            <span className="empty-note">No movements in this period. Your stock history will appear here.</span>
          )}
        </div>
      </section>
    </div>
  );
}
