export const stockState = (p) =>
  p.status === "inactive" ? "inactive" : p.stockQty === 0 ? "out" : p.stockQty <= p.minStockLevel ? "low" : "ok";

export const pick = (o, path) => path.split(".").reduce((a, k) => a?.[k], o);
