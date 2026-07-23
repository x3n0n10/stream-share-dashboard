import { Router } from "express";
import {
  fetchInstanceSnapshot,
  fetchHistory,
  fetchStats,
  fetchUsers,
  fetchStreams,
  fetchUserHistory,
} from "./instanceClient.js";
import { getVpnStatus, setVpnStatus, getPublicIP } from "./gluetunClient.js";
import { searchVOD, enrichVODResult, createVODDownload } from "./instanceClient.js";

function findInstance(config, id) {
  return config.instances.find((i) => i.id === id);
}

function hoursParam(req, fallback = 24) {
  const raw = Number(req.query.hours);
  return Number.isFinite(raw) ? raw : fallback;
}

// Wraps a per-instance settled result into a uniform {instance, error, data} shape.
function settle(instance, result) {
  if (result.status === "fulfilled") {
    return { instanceId: instance.id, instanceName: instance.name, error: null, data: result.value };
  }
  return { instanceId: instance.id, instanceName: instance.name, error: result.reason.message, data: null };
}

export function createRouter(config) {
  const router = Router();
  const opts = { timeoutMs: config.requestTimeoutMs };

  router.get("/config", (req, res) => {
    res.json({
      title: config.title,
      pollIntervalMs: config.pollIntervalMs,
      instances: config.instances.map(({ id, name, url }) => ({ id, name, url })),
      gluetun: { enabled: !!config.gluetun },
    });
  });

  // One combined snapshot per instance: identity + live status + windowed stats.
  router.get("/overview", async (req, res) => {
    const hours = hoursParam(req, 24);
    const snapshots = await Promise.all(
      config.instances.map((instance) => fetchInstanceSnapshot(instance, { ...opts, hours }))
    );
    res.json({ hours, instances: snapshots });
  });

  // Chronological watch history merged across every instance, newest first.
  router.get("/history", async (req, res) => {
    const hours = hoursParam(req, 24);
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const results = await Promise.allSettled(
      config.instances.map((instance) => fetchHistory(instance, { ...opts, hours, limit }))
    );

    const errors = [];
    const merged = [];
    config.instances.forEach((instance, idx) => {
      const r = results[idx];
      if (r.status === "fulfilled") {
        for (const item of r.value.feed || []) {
          merged.push({ ...item, instance_id: instance.id, instance_name: instance.name });
        }
      } else {
        errors.push({ instanceId: instance.id, instanceName: instance.name, error: r.reason.message });
      }
    });

    merged.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    res.json({ hours, feed: merged.slice(0, limit), errors });
  });

  // Top titles / top users, summed across instances for the requested window.
  router.get("/leaderboard", async (req, res) => {
    const hours = hoursParam(req, 24);
    const results = await Promise.allSettled(
      config.instances.map((instance) => fetchStats(instance, { ...opts, hours }))
    );

    const errors = [];
    const titles = new Map();
    const users = new Map();

    config.instances.forEach((instance, idx) => {
      const r = results[idx];
      if (r.status !== "fulfilled") {
        errors.push({ instanceId: instance.id, instanceName: instance.name, error: r.reason.message });
        return;
      }
      const data = r.value;

      for (const t of data.top_titles || []) {
        const key = `${t.stream_type}::${t.stream_title}`;
        const existing = titles.get(key) || {
          stream_title: t.stream_title,
          stream_type: t.stream_type,
          views: 0,
          watch_seconds: 0,
          instances: new Set(),
        };
        existing.views += t.views;
        existing.watch_seconds += t.watch_seconds;
        existing.instances.add(instance.name);
        titles.set(key, existing);
      }

      for (const u of data.top_users || []) {
        const existing = users.get(u.username) || {
          username: u.username,
          sessions: 0,
          watch_seconds: 0,
          instances: new Set(),
        };
        existing.sessions += u.sessions;
        existing.watch_seconds += u.watch_seconds;
        existing.instances.add(instance.name);
        users.set(u.username, existing);
      }
    });

    const toSorted = (map, key) =>
      Array.from(map.values())
        .map((v) => ({ ...v, instances: Array.from(v.instances) }))
        .sort((a, b) => b[key] - a[key])
        .slice(0, 10);

    res.json({
      hours,
      top_titles: toSorted(titles, "watch_seconds"),
      top_users: toSorted(users, "watch_seconds"),
      errors,
    });
  });

  // Currently active user sessions across every instance.
  router.get("/users", async (req, res) => {
    const results = await Promise.allSettled(
      config.instances.map((instance) => fetchUsers(instance, opts))
    );

    const errors = [];
    const merged = [];
    config.instances.forEach((instance, idx) => {
      const r = results[idx];
      if (r.status === "fulfilled") {
        for (const session of r.value || []) {
          merged.push({ ...session, instance_id: instance.id, instance_name: instance.name });
        }
      } else {
        errors.push({ instanceId: instance.id, instanceName: instance.name, error: r.reason.message });
      }
    });

    res.json({ users: merged, errors });
  });

  // Currently active streams across every instance.
  router.get("/streams", async (req, res) => {
    const results = await Promise.allSettled(
      config.instances.map((instance) => fetchStreams(instance, opts))
    );

    const errors = [];
    const merged = [];
    config.instances.forEach((instance, idx) => {
      const r = results[idx];
      if (r.status === "fulfilled") {
        for (const stream of r.value || []) {
          merged.push({ ...stream, instance_id: instance.id, instance_name: instance.name });
        }
      } else {
        errors.push({ instanceId: instance.id, instanceName: instance.name, error: r.reason.message });
      }
    });

    res.json({ streams: merged, errors });
  });

  // Drill-down: one user's history on one specific instance.
  router.get("/instances/:id/users/:username/history", async (req, res) => {
    const instance = findInstance(config, req.params.id);
    if (!instance) return res.status(404).json({ error: "Unknown instance" });

    const hours = hoursParam(req, 24 * 7);
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const offset = Number(req.query.offset) || 0;

    try {
      const data = await fetchUserHistory(instance, req.params.username, {
        ...opts,
        hours,
        limit,
        offset,
      });
      res.json(data);
    } catch (err) {
      res.status(err.status && err.status < 500 ? err.status : 502).json({ error: err.message });
    }
  });

  // Gluetun VPN status + exit IP. { enabled: false } when GLUETUN_URL isn't set.
  router.get("/gluetun", async (req, res) => {
    if (!config.gluetun) {
      return res.json({ enabled: false });
    }

    const [vpn, ip] = await Promise.allSettled([
      getVpnStatus(config.gluetun),
      getPublicIP(config.gluetun),
    ]);

    res.json({
      enabled: true,
      // vpn.status is gluetun's raw response, typically {"status": "running"|"stopped"}
      vpn: vpn.status === "fulfilled" ? vpn.value : null,
      vpnError: vpn.status === "rejected" ? vpn.reason.message : null,
      publicIp: ip.status === "fulfilled" ? ip.value : null,
      publicIpError: ip.status === "rejected" ? ip.reason.message : null,
    });
  });

  // Starts/stops the VPN connection via gluetun's control server.
  router.post("/gluetun/:action(start|stop)", async (req, res) => {
    if (!config.gluetun) {
      return res.status(404).json({ error: "Gluetun is not configured (set GLUETUN_URL)" });
    }

    const desired = req.params.action === "start" ? "running" : "stopped";
    try {
      const status = await setVpnStatus(config.gluetun, desired);
      res.json(status);
    } catch (err) {
      res.status(err.status && err.status < 500 ? err.status : 502).json({ error: err.message });
    }
  });

  // VOD search across every instance. Fast — no file sizes probed here, only
  // whatever an instance already had cached. Requires that instance's Xtream
  // config to be set; instances proxying a plain M3U will error per-item below.
  router.get("/vod/search", async (req, res) => {
    const query = (req.query.q || "").toString().trim();
    if (!query) return res.json({ query: "", results: [], errors: [] });

    const results = await Promise.allSettled(
      config.instances.map((instance) =>
        searchVOD(instance, query, { ...opts, username: config.vodActorUsername })
      )
    );

    const errors = [];
    const merged = [];
    config.instances.forEach((instance, idx) => {
      const r = results[idx];
      if (r.status === "fulfilled") {
        for (const item of r.value.results || []) {
          merged.push({ ...item, instance_id: instance.id, instance_name: instance.name });
        }
      } else {
        errors.push({ instanceId: instance.id, instanceName: instance.name, error: r.reason.message });
      }
    });

    merged.sort((a, b) => (a.Title || "").localeCompare(b.Title || ""));

    res.json({ query, results: merged, errors });
  });

  // On-demand file size for a single result — a live upstream probe on the
  // instance's side, so it's never done in bulk from the search endpoint.
  router.post("/instances/:id/vod/size", async (req, res) => {
    const instance = findInstance(config, req.params.id);
    if (!instance) return res.status(404).json({ error: "Unknown instance" });

    try {
      const enriched = await enrichVODResult(instance, req.body.result, opts);
      res.json(enriched);
    } catch (err) {
      res.status(err.status && err.status < 500 ? err.status : 502).json({ error: err.message });
    }
  });

  // Creates a temporary download link on the owning instance. The returned
  // download_url points directly at that instance (using its own configured
  // public address) — the browser opens it directly, not through this backend.
  router.post("/instances/:id/vod/download", async (req, res) => {
    const instance = findInstance(config, req.params.id);
    if (!instance) return res.status(404).json({ error: "Unknown instance" });

    const { streamId, title, type } = req.body;
    if (!streamId) return res.status(400).json({ error: "streamId is required" });

    try {
      const data = await createVODDownload(
        instance,
        { username: config.vodActorUsername, streamId, title, type },
        opts
      );
      res.json(data);
    } catch (err) {
      res.status(err.status && err.status < 500 ? err.status : 502).json({ error: err.message });
    }
  });

  return router;
}
