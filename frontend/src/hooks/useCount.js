import { useEffect, useState } from "react";

export function useCount(n, ms = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setV(n);
    let s, id;
    const f = (t) => {
      s ??= t;
      const p = Math.min((t - s) / ms, 1);
      setV(Math.round(n * (1 - (1 - p) ** 3)));
      if (p < 1) id = requestAnimationFrame(f);
    };
    id = requestAnimationFrame(f);
    return () => cancelAnimationFrame(id);
  }, [n]);
  return v;
}
