import { useEffect, useState } from "react";
import { get, errMsg } from "../api";
import { Modal } from "./Modal";
import { Field } from "./Field";

export function FormModal({ title, fields, initial = {}, onSubmit, onClose, submitLabel = "Save", top }) {
  const [v, setV] = useState(initial);
  const [opts, setOpts] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    fields.forEach((f) =>
      f.from && get(f.from, { limit: 100 }).then((r) => setOpts((o) => ({ ...o, [f.k]: r.data }))),
    );
  }, []);
  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const body = {};
      fields.forEach((f) => {
        let x = v[f.k];
        if (x === "" || x === undefined) return;
        if (f.t === "money") x = Math.round(Number(x) * 100);
        if (f.t === "number") x = Number(x);
        body[f.k] = x;
      });
      await onSubmit(body);
      onClose();
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={go}>
        {top}
        {fields.map((f) => (
          <Field key={f.k} label={f.l + (f.req ? " *" : "")}>
            {f.from || f.opts ? (
              <select
                className="inp"
                required={f.req}
                value={v[f.k] || ""}
                onChange={(e) => setV({ ...v, [f.k]: e.target.value })}
              >
                <option value="">Select…</option>
                {(f.opts || opts[f.k] || []).map((o) => (
                  <option
                    key={o.value ?? o._id ?? o}
                    value={o.value ?? o._id ?? o}
                  >
                    {o.label ?? o.name ?? o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="inp"
                required={f.req}
                type={f.t === "password" ? "password" : f.t === "money" || f.t === "number" ? "number" : "text"}
                min={f.t ? 0 : undefined}
                step={f.t === "money" ? "0.01" : undefined}
                value={v[f.k] ?? ""}
                onChange={(e) => setV({ ...v, [f.k]: e.target.value })}
              />
            )}
          </Field>
        ))}
        {err && (
          <p role="alert" className="mb-3 rounded-lg bg-red-100 p-2 text-sm text-red-800">{err}</p>
        )}
        <button className="btn-p w-full" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
      </form>
    </Modal>
  );
}
