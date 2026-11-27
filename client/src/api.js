// api.js - the only place the React app talks to Express.
// The JWT lives in an HttpOnly cookie, so JavaScript never sees it: fetch simply sends the
// cookie automatically (same origin). There is no localStorage and no Authorization header.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
  } catch {
    throw new ApiError("Cannot reach the server. Please try again.", 0);
  }
  let body = null;
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new ApiError(body?.error || `Request failed (HTTP ${res.status})`, res.status);
  return body;
}

export const getMe = () => request("/api/auth/me");
export const logout = () => request("/api/auth/logout", { method: "POST" });
export const listCapsules = () => request("/api/capsules");
export const createCapsule = (data) => request("/api/capsules", { method: "POST", body: JSON.stringify(data) });
export const updateCapsule = (id, data) => request(`/api/capsules/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteCapsule = (id) => request(`/api/capsules/${id}`, { method: "DELETE" });
