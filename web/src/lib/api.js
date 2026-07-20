async function get(path, params = {}) {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.pathname + url.search);
  if (!res.ok) {
    throw new Error(`Request to ${path} failed: HTTP ${res.status}`);
  }
  return res.json();
}

async function post(path) {
  const res = await fetch(path, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request to ${path} failed: HTTP ${res.status}`);
  }
  return body;
}

export const api = {
  config: () => get("/api/config"),
  overview: (hours) => get("/api/overview", { hours }),
  history: (hours, limit) => get("/api/history", { hours, limit }),
  leaderboard: (hours) => get("/api/leaderboard", { hours }),
  users: () => get("/api/users"),
  streams: () => get("/api/streams"),
  userHistory: (instanceId, username, hours) =>
    get(`/api/instances/${instanceId}/users/${encodeURIComponent(username)}/history`, { hours }),
  gluetunStatus: () => get("/api/gluetun"),
  gluetunStart: () => post("/api/gluetun/start"),
  gluetunStop: () => post("/api/gluetun/stop"),
};
