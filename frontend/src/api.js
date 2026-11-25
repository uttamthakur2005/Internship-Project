import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api' });
api.interceptors.request.use((c) => { const t = sessionStorage.getItem('ims_token'); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use((r) => r, (e) => {
  if (e.response?.status === 401 && !e.config.url.includes('/auth/login')) { sessionStorage.removeItem('ims_token'); location.href = '/login'; }
  return Promise.reject(e);
});
export const get = (u, params) => api.get(u, { params }).then((r) => r.data);
export const post = (u, b) => api.post(u, b || {}).then((r) => r.data);
export const patch = (u, b) => api.patch(u, b).then((r) => r.data);
export const errMsg = (e) => { const er = e.response?.data?.error; if (!er) return e.message; const d = er.details?.[0]; return d?.message ? `${er.message} — ${d.message}` : er.message; };
export const rupee = (p) => '₹' + ((p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fdate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const today = (offset = 0) => new Date(Date.now() - offset * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
export const toast = (msg, bad) => window.dispatchEvent(new CustomEvent('ims-toast', { detail: { msg, bad } }));
