const tone = {
  ok: "bg-green-100 text-green-800",
  "In stock": "bg-green-100 text-green-800",
  low: "bg-amber-100 text-amber-800",
  out: "bg-red-100 text-red-800",
  inactive: "bg-g200 text-g600",
  active: "bg-green-100 text-green-800",
  draft: "bg-g200 text-g600",
  ordered: "bg-blue-100 text-blue-800",
  received: "bg-green-100 text-green-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "border border-dashed border-g600 text-g600",
};
const label = { ok: "In stock", low: "Low stock", out: "Out of stock" };

export const Badge = ({ s }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone[s] || "bg-g200"}`}>
    {label[s] || (s ? s[0].toUpperCase() + s.slice(1) : "—")}
  </span>
);
