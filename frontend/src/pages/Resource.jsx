import { useEffect, useState } from "react";
import { get, post, patch, errMsg, rupee, toast } from "../api";
import { Badge } from "../ui/Badge";
import { FormModal } from "../ui/FormModal";
import { Field } from "../ui/Field";
import { Table } from "../ui/Table";
import { Pager } from "../ui/Pager";
import { stockState } from "../ui/helpers";
import { useList } from "../hooks/useList";
import { useAuth } from "../context/AuthContext";

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
      { k: "category", l: "Category", from: "/categories?isActive=true", req: 1 },
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
      ["extraPermissions", "Extra access", (v) => (v?.length ? v.join(", ") : "—")],
      ["isActive", "Status", active],
    ],
    fields: [
      { k: "name", l: "Name", req: 1 },
      { k: "email", l: "Email", req: 1 },
      { k: "password", l: "Temporary password (min 8)", t: "password", req: 1 },
      {
        k: "role",
        l: "Role",
        opts: [
          { value: "admin", label: "Admin" },
          { value: "manager", label: "Manager" },
          { value: "staff", label: "Staff — sales access not granted" },
          { value: "staff-sales", label: "Staff — can create and confirm sales" },
        ],
        req: 1,
      },
    ],
  },
};

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
          { k: "reason", l: "Reason", req: 1, opts: ["COUNT_CORRECTION", "DAMAGED", "LOST", "FOUND", "EXPIRED", "OTHER"] },
          { k: "note", l: "Note (required for OTHER)" },
        ];
  return (
    <FormModal
      key={mode}
      title={`Stock — ${p.name} (${p.stockQty} ${p.unit} now)`}
      fields={f}
      onClose={onClose}
      submitLabel={mode === "opening" ? "Record opening stock" : "Apply adjustment"}
      onSubmit={async (b) => {
        await post(
          mode === "opening" ? "/stock/opening" : "/stock/adjustments",
          { productId: p._id, ...(mode === "opening" ? {} : { direction: mode }), ...b },
        );
        toast("Stock updated");
        done();
      }}
      top={
        <Field label="Action">
          <select className="inp" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="out">Adjust out</option>
            <option value="in">Adjust in</option>
            <option value="opening">Opening stock (once)</option>
          </select>
        </Field>
      }
    />
  );
}

const descriptions = {
  products: "A clear picture of every item, its price and what is on hand.",
  categories: "Keep your catalog tidy with a few well-organized groups.",
  suppliers: "The people and partners behind your incoming stock.",
  customers: "A simple home for the people you sell to.",
  users: "The right access for every person on your team.",
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
    const t = setTimeout(() => { setQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const L = useList(c.url, { page, limit: 20, search: q || undefined, stockStatus: stockStatus || undefined });
  if (!can(c.view))
    return <div className="card p-6">You do not have permission to open this page (403).</div>;
  const toggle = async (r) => {
    const id = r._id || r.id;
    try {
      if (kind === "products") await patch(`/products/${id}/status`, { status: r.status === "active" ? "inactive" : "active" });
      else if (kind === "users") await patch(`/users/${id}/status`, { isActive: !r.isActive });
      else await patch(`${c.url}/${id}`, { isActive: !r.isActive });
      toast("Status updated");
      L.reload();
    } catch (e) { toast(errMsg(e), 1); }
  };
  const cols = [...c.cols];
  if (can(c.manage))
    cols.push([
      "_a",
      "Actions",
      (v, r) => (
        <span className="flex gap-2">
          {kind === "products" && can("stock.adjust") && (
            <button className="btn-s action-button" onClick={() => setModal({ stock: r })}>
              ↕ <span>Stock</span>
            </button>
          )}
          <button
            className="btn-s"
            onClick={() =>
              window.confirm(`${(r.isActive ?? r.status === "active") ? "Deactivate" : "Activate"} ${r.name}?`) && toggle(r)
            }
          >
            {(r.isActive ?? r.status === "active") ? "Deactivate" : "Activate"}
          </button>
        </span>
      ),
    ]);
  return (
    <div className="page-stack">
      <section className={`page-hero page-hero-${kind}`}>
        <div>
          <span className="page-eyebrow">
            <i />{" "}
            {kind === "users" ? "TEAM & ACCESS" : kind === "products" || kind === "categories" ? "YOUR CATALOG" : "YOUR NETWORK"}
          </span>
          <h1>
            {c.title}
            <span className="hero-period">.</span>
          </h1>
          <p>{descriptions[kind]}</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span>
            {kind === "products" ? "▦" : kind === "categories" ? "⌗" : kind === "users" ? "♙" : "✦"}
          </span>
          <i />
          <b />
        </div>
      </section>
      <section className="resource-toolbar">
        <div className="resource-result">
          <span className="result-spark">✦</span>
          <span>
            {L.loading ? "Gathering your records…" : `${L.meta.total ?? L.rows.length} ${c.title.toLowerCase()} in your workspace`}
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
            {search && <button onClick={() => setSearch("")} aria-label="Clear search">×</button>}
          </label>
          {kind === "products" && (
            <select className="filter-control" aria-label="Stock status" value={stockStatus} onChange={(e) => { setSS(e.target.value); setPage(1); }}>
              <option value="">All stock</option>
              <option value="ok">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          )}
          {can(c.manage) && (
            <button className="action-primary" onClick={() => setModal({ add: 1 })}>
              <span>＋</span> Add {c.title.replace(/ies$/, "y").replace(/s$/, "").toLowerCase()}
            </button>
          )}
        </div>
      </section>
      <div className="table-shell">
        <Table cols={cols} rows={L.rows} loading={L.loading} err={L.err} onRetry={L.reload} />
      </div>
      <Pager meta={L.meta} page={page} setPage={setPage} />
      {modal?.add && (
        <FormModal
          title={`Add ${c.title.toLowerCase()}`}
          fields={c.fields}
          onClose={() => setModal(null)}
          onSubmit={async (b) => {
            const body =
              kind === "users"
                ? b.role === "staff-sales"
                  ? { ...b, role: "staff", extraPermissions: ["sales.create"] }
                  : { ...b, extraPermissions: [] }
                : b;
            await post(c.url, body);
            toast("Saved");
            L.reload();
          }}
        />
      )}
      {modal?.stock && (
        <StockModal p={modal.stock} onClose={() => setModal(null)} done={L.reload} />
      )}
    </div>
  );
}
