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
import { get, post, patch, errMsg, rupee, fdate, today, toast } from "./api";
import {
  Badge,
  FormModal,
  Modal,
  Field,
  Pager,
  Table,
  stockState,
  useCount,
  useList,
} from "./ui";
import { useAuth } from "./App";

const UNITS = ["pcs", "box", "pack", "kg", "g", "l", "ml", "m"];
const active = (v) => <Badge s={v ? "active" : "inactive"} />;
const RES = {
  products: {
    title: "Products",
    url: "/products",
    view: "products.view",
    manage: "products.manage",
    statusKey: "status",
    search: true,
    cols: [
      ["sku", "SKU"],
      ["name", "Name"],
      ["category.name", "Category"],
      ["stockQty", "Stock", (v, r) => `${v} ${r.unit}`],
      ["minStockLevel", "Min"],
      ["sellingPrice", "Price", rupee],
      ["_s", "Status", (v, r) => <Badge s={stockState(r)} />],
    ],
    fields: [
      { k: "name", l: "Name", req: 1 },
      { k: "sku", l: "SKU (letters, digits, dashes)", req: 1 },
      {
        k: "category",
        l: "Category",
        from: "/categories?isActive=true",
        req: 1,
      },
      { k: "unit", l: "Unit", opts: UNITS, req: 1 },
      { k: "purchasePrice", l: "Purchase price (₹)", t: "money", req: 1 },
      { k: "sellingPrice", l: "Selling price (₹)", t: "money", req: 1 },
      { k: "minStockLevel", l: "Minimum stock", t: "number" },
    ],
  },
  categories: {
    title: "Categories",
    url: "/categories",
    manage: "products.manage",
    view: "products.manage",
    toggle: "isActive",
    search: true,
    cols: [
      ["name", "Name"],
      ["description", "Description"],
      ["isActive", "Status", active],
    ],
    fields: [
      { k: "name", l: "Name", req: 1 },
      { k: "description", l: "Description" },
    ],
  },
  suppliers: {
    title: "Suppliers",
    url: "/suppliers",
    manage: "contacts.manage",
    view: "contacts.manage",
    toggle: "isActive",
    search: true,
    cols: [
      ["name", "Name"],
      ["contactPerson", "Contact"],
      ["phone", "Phone"],
      ["email", "Email"],
      ["isActive", "Status", active],
    ],
    fields: [
      { k: "name", l: "Name", req: 1 },
      { k: "contactPerson", l: "Contact person" },
      { k: "phone", l: "Phone (10–15 digits)", req: 1 },
      { k: "email", l: "Email" },
    ],
  },
  customers: {
    title: "Customers",
    url: "/customers",
    manage: "contacts.manage",
    view: "contacts.manage",
    toggle: "isActive",
    search: true,
    cols: [
      ["name", "Name"],
      ["phone", "Phone"],
      ["email", "Email"],
      ["isActive", "Status", active],
    ],
    fields: [
      { k: "name", l: "Name", req: 1 },
      { k: "phone", l: "Phone" },
      { k: "email", l: "Email" },
    ],
  },
  users: {
    title: "Users",
    url: "/users",
    manage: "users.manage",
    view: "users.manage",
    toggle: "isActive",
    statusPath: true,
    search: true,
    cols: [
      ["name", "Name"],
      ["email", "Email"],
      ["role", "Role"],
      [
        "extraPermissions",
        "Extra access",
        (v) => (v?.length ? v.join(", ") : "—"),
      ],
      ["isActive", "Status", active],
    ],
    fields: [
      { k: "name", l: "Name", req: 1 },
      { k: "email", l: "Email", req: 1 },
      { k: "password", l: "Temporary password (min 8)", t: "password", req: 1 },
      { k: "role", l: "Role", opts: ["admin", "manager", "staff"], req: 1 },
    ],
  },
};

export function Resource({ kind }) {
  const c = RES[kind];
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [stockStatus, setSS] = useState("");
  const [modal, setModal] = useState(null);
  useEffect(() => {
    setPage(1);
    setSearch("");
    setQ("");
    setModal(null);
  }, [kind]);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const L = useList(c.url, {
    page,
    limit: 20,
    search: q || undefined,
    stockStatus: stockStatus || undefined,
  });
  if (!can(c.view))
    return (
      <div className="card p-6">
        You do not have permission to open this page (403).
      </div>
    );
  const toggle = async (r) => {
    const id = r._id || r.id;
    try {
      if (kind === "products")
        await patch(`/products/${id}/status`, {
          status: r.status === "active" ? "inactive" : "active",
        });
      else if (kind === "users")
        await patch(`/users/${id}/status`, { isActive: !r.isActive });
      else await patch(`${c.url}/${id}`, { isActive: !r.isActive });
      toast("Status updated");
      L.reload();
    } catch (e) {
      toast(errMsg(e), 1);
    }
  };
  const cols = [...c.cols];
  if (can(c.manage))
    cols.push([
      "_a",
      "Actions",
      (v, r) => (
        <span className="flex gap-2">
          {kind === "products" && can("stock.adjust") && (
            <button
              className="btn-s action-button"
              onClick={() => setModal({ stock: r })}
            >
              ↕ <span>Stock</span>
            </button>
          )}
          <button
            className="btn-s"
            onClick={() =>
              window.confirm(
                `${(r.isActive ?? r.status === "active") ? "Deactivate" : "Activate"} ${r.name}?`,
              ) && toggle(r)
            }
          >
            {(r.isActive ?? r.status === "active") ? "Deactivate" : "Activate"}
          </button>
        </span>
      ),
    ]);
  const descriptions = {
    products: "A clear picture of every item, its price and what is on hand.",
    categories: "Keep your catalog tidy with a few well-organized groups.",
    suppliers: "The people and partners behind your incoming stock.",
    customers: "A simple home for the people you sell to.",
    users: "The right access for every person on your team.",
  };
  return (
    <div className="page-stack">
      <section className={`page-hero page-hero-${kind}`}>
        <div>
          <span className="page-eyebrow">
            <i />{" "}
            {kind === "users"
              ? "TEAM & ACCESS"
              : kind === "products" || kind === "categories"
                ? "YOUR CATALOG"
                : "YOUR NETWORK"}
          </span>
          <h1>
            {c.title}
            <span className="hero-period">.</span>
          </h1>
          <p>{descriptions[kind]}</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span>
            {kind === "products"
              ? "▦"
              : kind === "categories"
                ? "⌗"
                : kind === "users"
                  ? "♙"
                  : "✦"}
          </span>
          <i />
          <b />
        </div>
      </section>
      <section className="resource-toolbar">
        <div className="resource-result">
          <span className="result-spark">✦</span>
          <span>
            {L.loading
              ? "Gathering your records…"
              : `${L.meta.total ?? L.rows.length} ${c.title.toLowerCase()} in your workspace`}
          </span>
        </div>
        <div className="resource-controls">
          <label className="search-control">
            <span>⌕</span>
            <input
              placeholder={`Search ${c.title.toLowerCase()}…`}
              aria-label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search">
                ×
              </button>
            )}
          </label>
          {kind === "products" && (
            <select
              className="filter-control"
              aria-label="Stock status"
              value={stockStatus}
              onChange={(e) => {
                setSS(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All stock</option>
              <option value="ok">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          )}
          {can(c.manage) && (
            <button
              className="action-primary"
              onClick={() => setModal({ add: 1 })}
            >
              <span>＋</span> Add{" "}
              {c.title.replace(/ies$/, "y").replace(/s$/, "").toLowerCase()}
            </button>
          )}
        </div>
      </section>
      <div className="table-shell">
        <Table
          cols={cols}
          rows={L.rows}
          loading={L.loading}
          err={L.err}
          onRetry={L.reload}
        />
      </div>
      <Pager meta={L.meta} page={page} setPage={setPage} />
      {modal?.add && (
        <FormModal
          title={`Add ${c.title.toLowerCase()}`}
          fields={c.fields}
          onClose={() => setModal(null)}
          onSubmit={async (b) => {
            await post(c.url, b);
            toast("Saved");
            L.reload();
          }}
        />
      )}
      {modal?.stock && (
        <StockModal
          p={modal.stock}
          onClose={() => setModal(null)}
          done={L.reload}
        />
      )}
    </div>
  );
}

function StockModal({ p, onClose, done }) {
  const [mode, setMode] = useState("out");
  const f =
    mode === "opening"
      ? [
          { k: "quantity", l: "Quantity", t: "number", req: 1 },
          { k: "unitCost", l: "Unit cost (₹)", t: "money", req: 1 },
          { k: "note", l: "Note", req: 1 },
        ]
      : [
          { k: "quantity", l: "Quantity", t: "number", req: 1 },
          {
            k: "reason",
            l: "Reason",
            req: 1,
            opts: [
              "COUNT_CORRECTION",
              "DAMAGED",
              "LOST",
              "FOUND",
              "EXPIRED",
              "OTHER",
            ],
          },
          { k: "note", l: "Note (required for OTHER)" },
        ];
  return (
    <FormModal
      key={mode}
      title={`Stock — ${p.name} (${p.stockQty} ${p.unit} now)`}
      fields={f}
      onClose={onClose}
      submitLabel={
        mode === "opening" ? "Record opening stock" : "Apply adjustment"
      }
      onSubmit={async (b) => {
        await post(
          mode === "opening" ? "/stock/opening" : "/stock/adjustments",
          {
            productId: p._id,
            ...(mode === "opening" ? {} : { direction: mode }),
            ...b,
          },
        );
        toast("Stock updated");
        done();
      }}
      top={
        <Field label="Action">
          <select
            className="inp"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="out">Adjust out</option>
            <option value="in">Adjust in</option>
            <option value="opening">Opening stock (once)</option>
          </select>
        </Field>
      }
    />
  );
}

/* ---------- Purchases & sales ---------- */
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
export function Transactions({ kind }) {
  const t = TX[kind];
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setPage(1);
    setStatus("");
  }, [kind]);
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
      toast(
        `${t.title.slice(0, -1)} ${a === "order" ? "ordered" : a === "receive" ? "received" : a === "confirm" ? "confirmed" : "cancelled"}`,
      );
      L.reload();
    } catch (e) {
      toast(errMsg(e), 1);
      L.reload();
    }
  };
  const cols = [
    ["referenceNo", "Reference"],
    [
      t.snap,
      kind === "sales" ? "Customer" : "Supplier",
      (v) => v || "Walk-in customer",
    ],
    [t.date, "Date", fdate],
    ["items", "Items", (v) => v?.length],
    ["total", "Total", rupee],
    ["status", "Status", (v) => <Badge s={v} />],
    [
      "_a",
      "Actions",
      (v, r) => (
        <span className="flex gap-2">
          {kind === "purchases" &&
            can("purchases.manage") &&
            r.status === "draft" && (
              <button
                className="btn-s"
                onClick={() =>
                  act(r, "order", "Mark as ordered? Stock stays unchanged.")
                }
              >
                Order
              </button>
            )}
          {kind === "purchases" &&
            can("purchases.manage") &&
            r.status === "ordered" && (
              <button
                className="btn-p"
                onClick={() =>
                  act(
                    r,
                    "receive",
                    `Receive ${r.items.length} product(s)? Stock will increase once.`,
                  )
                }
              >
                Receive
              </button>
            )}
          {kind === "sales" && can("sales.create") && r.status === "draft" && (
            <button
              className="btn-p"
              onClick={() =>
                act(
                  r,
                  "confirm",
                  `Confirm sale? Stock of ${r.items.length} product(s) will decrease once.`,
                )
              }
            >
              Confirm
            </button>
          )}
          {["draft", "ordered"].includes(r.status) &&
            (kind === "purchases"
              ? can("purchases.manage")
              : can("sales.cancel") || can("sales.create")) && (
              <button className="btn-s" onClick={() => act(r, "cancel")}>
                Cancel
              </button>
            )}
        </span>
      ),
    ],
  ];
  return (
    <div className="page-stack">
      <section className={`page-hero page-hero-${kind}`}>
        <div>
          <span className="page-eyebrow">
            <i />{" "}
            {kind === "sales"
              ? "REVENUE & CUSTOMER ORDERS"
              : "INCOMING INVENTORY"}
          </span>
          <h1>
            {t.title}
            <span className="hero-period">.</span>
          </h1>
          <p>
            {kind === "sales"
              ? "Every sale, clearly tracked from draft to confirmation."
              : "Track what is on its way and receive it into stock with confidence."}
          </p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span>{kind === "sales" ? "↗" : "↙"}</span>
          <i />
          <b />
        </div>
      </section>
      <section className="resource-toolbar">
        <div className="resource-result">
          <span className="result-spark">{kind === "sales" ? "↗" : "↙"}</span>
          <span>
            {L.loading
              ? "Gathering your records…"
              : `${L.meta.total ?? L.rows.length} ${t.title.toLowerCase()} in your workspace`}
          </span>
        </div>
        <div className="resource-controls">
          <select
            className="filter-control"
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {(kind === "sales"
              ? ["draft", "confirmed", "cancelled"]
              : ["draft", "ordered", "received", "cancelled"]
            ).map((s) => (
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
        <Table
          cols={cols}
          rows={L.rows}
          loading={L.loading}
          err={L.err}
          onRetry={L.reload}
        />
      </div>
      <Pager meta={L.meta} page={page} setPage={setPage} />
      {open && (
        <TxForm
          t={t}
          kind={kind}
          onClose={() => setOpen(false)}
          done={L.reload}
        />
      )}
    </div>
  );
}
function TxForm({ t, kind, onClose, done }) {
  const [parties, setParties] = useState([]);
  const [prods, setProds] = useState([]);
  const [party, setParty] = useState("");
  const [date, setDate] = useState(today());
  const [lines, setLines] = useState([{ product: "", quantity: 1, price: "" }]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    get(t.partyUrl, { limit: 100 })
      .then((r) => setParties(r.data))
      .catch(() => {});
    get("/products", { status: "active", limit: 100 }).then((r) =>
      setProds(r.data),
    );
  }, []);
  const usable = kind === "sales" ? prods.filter((p) => p.stockQty > 0) : prods;
  const byId = (id) => prods.find((p) => p._id === id);
  const set = (i, k, v) =>
    setLines(
      lines.map((l, j) =>
        j === i
          ? {
              ...l,
              [k]: v,
              ...(k === "product"
                ? {
                    price: String(
                      ((kind === "sales"
                        ? byId(v)?.sellingPrice
                        : byId(v)?.purchasePrice) || 0) / 100,
                    ),
                  }
                : {}),
            }
          : l,
      ),
    );
  const total = lines.reduce(
    (s, l) =>
      s + Math.round(Number(l.price || 0) * 100) * Number(l.quantity || 0),
    0,
  );
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
      await post(t.url, {
        [t.party]: party || undefined,
        [t.date]: date,
        items,
      });
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
    <Modal
      title={`New ${t.title.slice(0, -1).toLowerCase()}`}
      onClose={onClose}
      wide
    >
      <form onSubmit={go}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={kind === "sales" ? "Customer" : "Supplier *"}>
            <select
              className="inp"
              required={kind === "purchases"}
              value={party}
              onChange={(e) => setParty(e.target.value)}
            >
              <option value="">
                {kind === "sales" ? "Walk-in customer" : "Select…"}
              </option>
              {parties.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date *">
            <input
              className="inp"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="mb-2 grid gap-2 sm:grid-cols-12">
            <select
              aria-label="Product"
              className="inp sm:col-span-6"
              required
              value={l.product}
              onChange={(e) => set(i, "product", e.target.value)}
            >
              <option value="">Product…</option>
              {usable
                .filter(
                  (p) =>
                    p._id === l.product ||
                    !lines.some((x) => x.product === p._id),
                )
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.sku})
                    {kind === "sales" ? ` — ${p.stockQty} available` : ""}
                  </option>
                ))}
            </select>
            <input
              aria-label="Quantity"
              className="inp sm:col-span-2"
              type="number"
              min="1"
              required
              value={l.quantity}
              onChange={(e) => set(i, "quantity", e.target.value)}
            />
            <input
              aria-label={t.priceLabel}
              className="inp sm:col-span-3"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder={t.priceLabel}
              value={l.price}
              onChange={(e) => set(i, "price", e.target.value)}
            />
            <button
              type="button"
              className="btn-s sm:col-span-1"
              disabled={lines.length < 2}
              onClick={() => setLines(lines.filter((_, j) => j !== i))}
              aria-label="Remove line"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-s mb-3"
          onClick={() =>
            setLines([...lines, { product: "", quantity: 1, price: "" }])
          }
        >
          Add line
        </button>
        <p className="mb-3 text-sm text-g600">
          Total preview: <b className="text-navy-900">{rupee(total)}</b> (final
          total is calculated on save)
        </p>
        {err && (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-red-100 p-2 text-sm text-red-800"
          >
            {err}
          </p>
        )}
        <button className="btn-p w-full" disabled={busy}>
          {busy ? "Saving…" : "Save as draft"}
        </button>
      </form>
    </Modal>
  );
}

/* ---------- Dashboard ---------- */
function Stat({
  label,
  value,
  money,
  tone = "",
  icon = "✦",
  caption = "CURRENT OVERVIEW",
}) {
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
      <div className="stat-progress">
        <i />
      </div>
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
        t.data.sales.forEach(
          (x) => (m[x._id] = { day: x._id, sales: x.total / 100 }),
        );
        t.data.purchases.forEach(
          (x) =>
            (m[x._id] = { ...m[x._id], day: x._id, purchases: x.total / 100 }),
        );
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
          <button
            className="btn-s"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
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
        <span className="insight-mark">
          {accent === "insight-danger" ? "!" : "↗"}
        </span>
        <div>
          <h3>{title}</h3>
          <small>
            {rows.length
              ? `${rows.length} items need a closer look`
              : "Looking good right now"}
          </small>
        </div>
        <span className="insight-arrow">↗</span>
      </div>
      {rows.length ? (
        <div className="insight-list">
          {rows.slice(0, 5).map((r) => (
            <div key={r._id} className="insight-row">
              <span className="insight-product-mark">
                {r.name?.slice(0, 1).toUpperCase()}
              </span>
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
        <div className="insight-empty">
          <span>✓</span> All clear. No stock alerts.
        </div>
      )}
    </article>
  );
  const rec = (title, rows, accent) => (
    <article className="recent-card">
      <div className="recent-heading">
        <span className={`recent-mark ${accent || ""}`}>
          {accent === "recent-sales" ? "↗" : "↙"}
        </span>
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
            <small>{fdate(r.updatedAt || r.createdAt)}</small>
          </span>
          <span className="recent-total">{rupee(r.total)}</span>
          <Badge s={r.status} />
        </div>
      ))}
      {!rows.length && (
        <div className="recent-empty">
          Nothing here yet. Your activity will show up here.
        </div>
      )}
    </article>
  );
  return (
    <div className="page-stack dashboard-page">
      <section className="dashboard-welcome">
        <div className="welcome-copy">
          <span className="page-eyebrow">
            <i /> YOUR BUSINESS AT A GLANCE
          </span>
          <h1>
            Good to see you<span className="hero-period">.</span>
          </h1>
          <p>Here’s what’s happening with your inventory today.</p>
        </div>
        <label className="period-picker">
          <span>VIEW PERIOD</span>
          <select
            aria-label="Period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <b>⌄</b>
        </label>
        <div className="welcome-decoration" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>
      <section aria-label="Inventory counts" className="stat-grid">
        <Stat
          label="Active products"
          value={d.counts.activeProducts}
          icon="▦"
          caption="CATALOG"
        />
        <Stat
          label="Categories"
          value={d.counts.categories}
          icon="⌗"
          caption="ORGANIZATION"
        />
        <Stat
          label="Low stock"
          value={d.lowStock.length}
          icon="↘"
          tone="stat-warn"
          caption="NEEDS ATTENTION"
        />
        <Stat
          label="Out of stock"
          value={d.outOfStock.length}
          icon="!"
          tone="stat-danger"
          caption="RESTOCK SOON"
        />
      </section>
      <section
        aria-label="Inventory value and totals"
        className="stat-grid stat-grid-finance"
      >
        <Stat
          money
          label="Estimated stock value"
          value={d.estimatedStockValue}
          icon="◈"
          caption="AT LAST PURCHASE COST"
        />
        <Stat
          money
          label="Sales revenue"
          value={d.salesRevenue}
          icon="↗"
          caption={`LAST ${days} DAYS`}
        />
        <Stat
          money
          label="Purchases received"
          value={d.purchaseTotal}
          icon="↙"
          caption={`LAST ${days} DAYS`}
        />
      </section>
      <section className="chart-card">
        <div className="section-heading">
          <div>
            <span className="section-kicker">MOVEMENT OVER TIME</span>
            <h2>Sales & purchases</h2>
            <p>See how stock is flowing through your business.</p>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-sales" /> Sales
            </span>
            <span>
              <i className="legend-purchases" /> Purchases
            </span>
          </div>
        </div>
        <div className="chart-area">
          <ResponsiveContainer>
            <LineChart
              data={tr}
              margin={{ top: 12, right: 12, left: -12, bottom: 4 }}
            >
              <CartesianGrid stroke="#eeedf4" vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={(value) => value.slice(5)}
                tickLine={false}
                axisLine={false}
                fontSize={10}
                stroke="#9695a8"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={10}
                stroke="#9695a8"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #eeedf4",
                  boxShadow: "0 12px 35px #24204a18",
                  fontSize: 12,
                }}
                formatter={(value) => [
                  `₹${Number(value).toLocaleString("en-IN")}`,
                  undefined,
                ]}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={28}
                iconType="circle"
                wrapperStyle={{ fontSize: 10, color: "#77768c" }}
              />
              <Line
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke="#8060df"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
                animationDuration={1200}
              />
              <Line
                type="monotone"
                dataKey="purchases"
                name="Purchases"
                stroke="#e99b58"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
                animationDuration={1400}
              />
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
            <div
              key={m._id}
              className="movement-pill"
              style={{ "--item-delay": `${index * 70}ms` }}
            >
              <span className="movement-pill-icon">
                {m._id === "SALE_OUT" || m._id === "ADJUSTMENT_OUT" ? "↗" : "↙"}
              </span>
              <span>
                <b>{m._id.replaceAll("_", " ")}</b>
                <small>
                  {m.count} moves · {m.quantity} units
                </small>
              </span>
              <i>↗</i>
            </div>
          ))}
          {!d.movementSummary.length && (
            <span className="empty-note">
              No movements in this period. Your stock history will appear here.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------- Movements & reports ---------- */
const MCOLS = [
  ["createdAt", "When", fdate],
  ["product.name", "Product"],
  ["type", "Type"],
  [
    "quantity",
    "Qty",
    (v) => (
      <b className={v < 0 ? "text-red-700" : "text-green-700"}>
        {v > 0 ? `+${v}` : v}
      </b>
    ),
  ],
  ["quantityBefore", "Before"],
  ["quantityAfter", "After"],
  ["reference.referenceNo", "Reference"],
  ["performedBy.name", "By"],
];
export function Movements() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const L = useList("/stock/movements", {
    page,
    limit: 20,
    type: type || undefined,
    sort: "-createdAt",
  });
  return (
    <div className="page-stack">
      <section className="page-hero page-hero-movements">
        <div>
          <span className="page-eyebrow">
            <i /> COMPLETE INVENTORY AUDIT TRAIL
          </span>
          <h1>
            Stock movements<span className="hero-period">.</span>
          </h1>
          <p>
            Follow every stock change back to its source, product and teammate.
          </p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span>⇄</span>
          <i />
          <b />
        </div>
      </section>
      <section className="resource-toolbar">
        <div className="resource-result">
          <span className="result-spark">⇄</span>
          <span>
            {L.loading
              ? "Gathering your records…"
              : `${L.meta.total ?? L.rows.length} stock movements recorded`}
          </span>
        </div>
        <div className="resource-controls">
          <select
            className="filter-control"
            aria-label="Type"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All movement types</option>
            {[
              "OPENING",
              "PURCHASE_IN",
              "SALE_OUT",
              "ADJUSTMENT_IN",
              "ADJUSTMENT_OUT",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
      </section>
      <div className="table-shell">
        <Table
          cols={MCOLS}
          rows={L.rows}
          loading={L.loading}
          err={L.err}
          onRetry={L.reload}
        />
      </div>
      <Pager meta={L.meta} page={page} setPage={setPage} />
    </div>
  );
}
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
  const L = useList(r.u, {
    page,
    limit: 20,
    ...(r.range ? { from, to } : { search: search || undefined }),
  });
  return (
    <div className="page-stack">
      <section className="page-hero page-hero-reports">
        <div>
          <span className="page-eyebrow">
            <i /> CLEAR NUMBERS, BETTER DECISIONS
          </span>
          <h1>
            Reports<span className="hero-period">.</span>
          </h1>
          <p>
            A reliable view of your inventory, transactions and stock history.
          </p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span>▤</span>
          <i />
          <b />
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
            onClick={() => {
              setK(id);
              setPage(1);
            }}
          >
            <span>
              {["▦", "↘", "!", "↙", "↗", "⇄"][Object.keys(REP).indexOf(id)]}
            </span>
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
            <span>
              {L.loading
                ? "Preparing report…"
                : `${L.meta.total ?? L.rows.length} records in this report`}
            </span>
          </div>
          <div className="resource-controls">
            {r.range ? (
              <>
                <label className="date-control">
                  <span>FROM</span>
                  <input
                    type="date"
                    aria-label="From"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label className="date-control">
                  <span>TO</span>
                  <input
                    type="date"
                    aria-label="To"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
              </>
            ) : (
              <label className="search-control">
                <span>⌕</span>
                <input
                  placeholder="Search name or SKU…"
                  aria-label="Search name or SKU"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </label>
            )}
          </div>
        </div>
        <div className="table-shell">
          <Table
            cols={r.cols}
            rows={L.rows}
            loading={L.loading}
            err={L.err}
            onRetry={L.reload}
          />
        </div>
        <Pager meta={L.meta} page={page} setPage={setPage} />
      </section>
    </div>
  );
}
