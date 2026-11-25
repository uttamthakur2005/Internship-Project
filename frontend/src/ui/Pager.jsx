export const Pager = ({ meta, page, setPage }) =>
  meta.totalPages > 1 && (
    <div className="pagination-bar">
      <span className="pagination-summary">
        Page <b>{meta.page}</b> of <b>{meta.totalPages}</b>
        <i />{meta.total} records
      </span>
      <button className="btn-s" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
      <button className="btn-s" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
