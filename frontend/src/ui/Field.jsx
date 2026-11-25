export const Field = ({ label: l, children }) => (
  <label className="mb-3 block text-sm">
    <span className="mb-1 block text-g600">{l}</span>
    {children}
  </label>
);
