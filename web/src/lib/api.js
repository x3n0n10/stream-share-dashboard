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

async function post(path, payload) {
  const res = await fetch(path, {
    method: "POST",
    headers: payload !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request to ${path} failed: HTTP ${res.status}`);
  }
  return body;
}

// True until the first /api/overview of this page load comes back. It asks the
// instances to re-read their provider subscription from the provider instead of
// serving their cached copy, so a freshly opened dashboard shows current numbers
// rather than something up to a refresh-interval old.
//
// Module state is exactly the right scope: a browser reload resets it (which is
// what the operator means by "reload the page"), while navigating between
// dashboard pages, changing the time window, or the 15s poll does not.
let coldLoad = true;

export const api = {
  config: () => get("/api/config"),
  overview: async (hours) => {
    // Claim the cold load before awaiting, not after: a mount can issue two
    // overview calls in the same tick (the poll interval arrives with the
    // config and re-runs the effect), and only one of them should force a
    // provider read. A throw hands the claim back, so a first load that never
    // landed still forces on its retry.
    const refresh = coldLoad;
    coldLoad = false;
    try {
      return await get("/api/overview", { hours, refresh: refresh ? 1 : undefined });
    } catch (err) {
      if (refresh) coldLoad = true;
      throw err;
    }
  },
  history: (hours, limit) => get("/api/history", { hours, limit }),
  leaderboard: (hours) => get("/api/leaderboard", { hours }),
  users: () => get("/api/users"),
  streams: () => get("/api/streams"),
  userHistory: (instanceId, username, hours) =>
    get(`/api/instances/${instanceId}/users/${encodeURIComponent(username)}/history`, { hours }),
  gluetunStatus: () => get("/api/gluetun"),
  gluetunStart: () => post("/api/gluetun/start"),
  gluetunStop: () => post("/api/gluetun/stop"),
  gluetunReconnect: () => post("/api/gluetun/reconnect"),
  vodSearch: (q) => get("/api/vod/search", { q }),
  vodDownload: (instanceId, streamId, title, type) =>
    post(`/api/instances/${instanceId}/vod/download`, { streamId, title, type }),
  aliases: () => get("/api/aliases"),
  createAlias: (instanceId, ipAddress, alias) =>
    post(`/api/instances/${instanceId}/aliases`, { ipAddress, alias }),
  deleteAlias: (instanceId, ipAddress) =>
    post(`/api/instances/${instanceId}/aliases/delete`, { ipAddress }),
};
