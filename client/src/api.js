const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function api(path, { method='GET', body, formData } = {}) {
  const opts = { method, headers: { ...authHeaders() } };
  if (formData) {
    opts.body = formData;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
