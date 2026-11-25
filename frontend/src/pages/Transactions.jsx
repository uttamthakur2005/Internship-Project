import { useEffect, useState } from "react";
import { get, post, errMsg, rupee, fdate, today, toast } from "../api";
import { Badge } from "../ui/Badge";
import { FormModal } from "../ui/FormModal";
import { Field } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { Table } from "../ui/Table";
import { Pager } from "../ui/Pager";
import { useList } from "../hooks/useList";
import { useAuth } from "../context/AuthContext";

const TX = {
  purchases: {
    title: "Purchases",
    url: "/purchases",
    manage: "purchases.manage",
    create: "purchases.manage",
    party: "supplier",
    partyUrl: "/suppliers?isActive=true",
    snap: "supplierSnapshot.name",
    date: "purchaseDate",
    price: "unitCost",
    priceLabel: "Unit cost (₹)",
  },
  sales: {
    title: "Sales",
    url: "/sales",
    manage: "sales.view",
    create: "sales.create",
    party: "customer",
    partyUrl: "/customers?isActive=true",
    snap: "customerSnapshot.name",
    date: "saleDate",
    price: "unitPrice",
    priceLabel: "Unit price (₹)",
  },
};

function TxForm({ t, kind, onClose, done }) {
  const [parties, setParties] = useState([]);
  const [prods, setProds] = useState([]);
  const [party, setParty] = useState("");
  const [date, setDate] = useState(today());
  const [lines, setLines] = useState([{ product: "", quantity: 1, price: "" }]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    get(t.partyUrl, { limit: 100 }).then((r) => setParties(r.data)).catch(() => {});
    get("/products", { status: "active", limit: 100 }).then((r) => setProds(r.data));
  }, []);
  const usable = kind === "sales" ? prods.filter((p) => p.stockQty > 0) : prods;
  const byId = (id) => prods.find((p) => p._id === id);
  const setLine = (i, k, v) =>
    setLines(
      lines.map((l, j) =>
        j === i
          ? {
              ...l,
              [k]: v,
              ...(k === "product"
                ? { price: String(((kind === "sales" ? byId(v)?.sellingPrice : byId(v)?.purchasePrice) || 0) / 100) }
                : {}),
            }
          : l,
      ),
    );
  const total = lines.reduce((s, l) => s + Math.round(Number(l.price || 0) * 100) * Number(l.quantity || 0), 0);
  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const items = lines.map((l) => ({
        product: l.product,
        quantity: Number(l.quantity),
        [t.price]: Math.round(Number(l.price) * 100),
      }));
      await post(t.url, { [t.party]: party || undefined, [t.date]: date, items });
      toast(`${t.title.slice(0, -1)} saved as draft`);
      done();
      onClose();
    } catch (x) {
      setErr(errMsg(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`New ${t.title.slice(0, -1).toLowerCase()}`} onClose={onClose} wide>
      <form onSubmit={go}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={kind === "sales" ? "Customer" : "Supplier *"}>
            <select className="inp" required={kind === "purchases"} value={party} onChange={(e) => setParty(e.target.value)}>
              <option value="">{kind === "sales" ? "Walk-in customer" : "Select…"}</option>
              {parties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Date *">
            <input className="inp" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="mb-2 grid gap-2 sm:grid-cols-12">
            <select aria-label="Product" className="inp sm:col-span-6" required value={l.product} onChange={(e) => setLine(i, "product", e.target.value)}>
              <option value="">Product…</option>
              {usable.filter((p) => p._id === l.product || !lines.some((x) => x.product === p._id)).map((p) => (
                <option key={p._id} value={p._id}>{p.name} ({p.sku}){kind === "sales" ? ` — ${p.stockQty} available` : ""}</option>
              ))}
            </select>
            <input aria-label="Quantity" className="inp sm:col-span-2" type="number" min="1" required value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} />
            <input aria-label={t.priceLabel} className="inp sm:col-span-3" type="number" min="0" step="0.01" required placeholder={t.priceLabel} value={l.price} onChange={(e) => setLine(i, "price", e.target.value)} />
            <button type="button" className="btn-s sm:col-span-1" disabled={lines.length < 2} onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line">✕</button>
          </div>
        ))}
        <button type="button" className="btn-s mb-3" onClick={() => setLines([...lines, { product: "", quantity: 1, price: "" }])}>Add line</button>
        <p className="mb-3 text-sm text-g600">Total preview: <b className="text-navy-900">{rupee(total)}</b> (final total is calculated on save)</p>
        {err && <p role="alert" className="mb-3 rounded-lg bg-red-100 p-2 text-sm text-red-800">{err}</p>}
        <button className="btn-p w-full" disabled={busy}>{busy ? "Saving…" : "Save as draft"}</button>
      </form>
    </Modal>
  );
}

export function Transactions({ kind }) {
  const t = TX[kind];
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { setPage(1); setStatus(""); }, [kind]);
  const L = useList(t.url, { page, limit: 20, status: status || undefined });
  const act = async (r, a, msg) => {
    let body;
    if (a === "cancel") {
      const reason = window.prompt("Reason for cancelling");
      if (!reason) return;
      body = { reason };
    } else if (!window.confirm(msg)) return;
    try {
      await post(`${t.url}/${r._id}/${a}`, body);
      toast(`${t.title.slice(0, -1)} ${a === "order" ? "ordered" : a === "receive" ? "received" : a === "confirm" ? "confirmed" : "cancelled"}`);
      L.reload();
    } catch (e) { toast(errMsg(e), 1); L.reload(); }
  };
  const cols = [
    ["referenceNo", "Reference"],
    [t.snap, kind === "sales" ? "Customer" : "Supplier", (v) => v || "Walk-in customer"],
    [t.date, "Date", fdate],
    ["items", "Items", (v) => v?.length],
    ["total", "Total", rupee],
    ["status", "Status", (v) => <Badge s={v} />],
    ["_a", "Actions", (v, r) => (
      <span className="flex gap-2">
        {kind === "purchases" && can("purchases.manage") && r.status === "draft" && (
          <button className="btn-s" onClick={() => act(r, "order", "Mark as ordered? Stock stays unchanged.")}>Order</button>
        )}
        {kind === "purchases" && can("purchases.manage") && r.status === "ordered" && (
          <button className="btn-p" onClick={() => act(r, "receive", `Receive ${r.items.length} product(s)? Stock will increase once.`)}>Receive</button>
        )}
        {kind === "sales" && can("sales.create") && r.status === "draft" && (
          <button className="btn-p" onClick={() => act(r, "confirm", `Confirm sale? Stock of ${r.items.length} product(s) will decrease once.`)}>Confirm</button>
        )}
        {["draft", "ordered"].includes(r.status) && (kind === "purchases" ? can("purchases.manage") : can("sales.cancel") || can("sales.create")) && (
          <button className="btn-s" onClick={() => act(r, "cancel")}>Cancel</button>
        )}
      </span>
    )],
  ];
  return (
    <div className="page-stack">
      <section className={`page-hero page-hero-${kind}`}>
        <div>
          <span className="page-eyebrow">
            <i />{" "}{kind === "sales" ? "REVENUE & CUSTOMER ORDERS" : "INCOMING INVENTORY"}
          </span>
          <h1>{t.title}<span className="hero-period">.</span></h1>
          <p>{kind === "sales" ? "Every sale, clearly tracked from draft to confirmation." : "Track what is on its way and receive it into stock with confidence."}</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span>{kind === "sales" ? "↗" : "↙"}</span>
          <i /><b />
        </div>
      </section>
      <section className="resource-toolbar">
        <div className="resource-result">
          <span className="result-spark">{kind === "sales" ? "↗" : "↙"}</span>
          <span>{L.loading ? "Gathering your records…" : `${L.meta.total ?? L.rows.length} ${t.title.toLowerCase()} in your workspace`}</span>
        </div>
        <div className="resource-controls">
          <select className="filter-control" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {(kind === "sales" ? ["draft", "confirmed", "cancelled"] : ["draft", "ordered", "received", "cancelled"]).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {can(t.create) && (
            <button className="action-primary" onClick={() => setOpen(true)}>
              <span>＋</span> New {t.title.slice(0, -1).toLowerCase()}
            </button>
          )}
        </div>
      </section>
      <div className="table-shell">
        <Table cols={cols} rows={L.rows} loading={L.loading} err={L.err} onRetry={L.reload} />
      </div>
      <Pager meta={L.meta} page={page} setPage={setPage} />
      {open && <TxForm t={t} kind={kind} onClose={() => setOpen(false)} done={L.reload} />}
    </div>
  );
}
