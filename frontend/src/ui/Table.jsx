import { pick } from "./helpers";

export function Table({ cols, rows, loading, err, onRetry }) {
  if (err)
    return (
      <div className="table-state table-state-error">
        <span>!</span>
        <div>
          <b>We couldn't load these records.</b>
          <p>{err}</p>
          <button className="btn-s" onClick={onRetry}>Try again</button>
        </div>
      </div>
    );
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-g50 text-g600">
          <tr>
            {cols.map(([, l]) => (
              <th key={l} className="whitespace-nowrap px-3 py-2 font-medium">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={cols.length} className="table-state-cell">
                <span className="table-spinner" />
                <b>Gathering your records…</b>
                <small>This should only take a moment.</small>
              </td>
            </tr>
          )}
          {!loading && !rows.length && (
            <tr>
              <td colSpan={cols.length} className="table-state-cell">
                <span className="table-empty-mark">✦</span>
                <b>Nothing here just yet</b>
                <small>Add a record or change the filters to see results.</small>
              </td>
            </tr>
          )}
          {!loading &&
            rows.map((r, i) => (
              <tr
                key={r._id || r.id || i}
                className="rise border-t border-g200"
                style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}
              >
                {cols.map(([k, l, fn]) => (
                  <td key={l} className="whitespace-nowrap px-3 py-2">
                    {fn ? fn(pick(r, k), r) : pick(r, k) ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
