import { useEffect, useState } from "react";
import { get, errMsg } from "../api";

export function useList(url, params = {}) {
  const [s, set] = useState({ rows: [], meta: {}, loading: true, err: "" });
  const [n, setN] = useState(0);
  const key = JSON.stringify(params);
  useEffect(() => {
    let live = true;
    set((x) => ({ ...x, loading: true }));
    get(url, params)
      .then((r) => live && set({ rows: r.data, meta: r.meta || {}, loading: false, err: "" }))
      .catch((e) => live && set({ rows: [], meta: {}, loading: false, err: errMsg(e) }));
    return () => { live = false; };
  }, [url, key, n]);
  return { ...s, reload: () => setN((x) => x + 1) };
}
