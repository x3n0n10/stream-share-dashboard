// Reads dashboard configuration from environment variables.
//
// Instances are configured as numbered triples so they map cleanly onto a
// docker-compose `environment:` block without any JSON escaping:
//
//   INSTANCE_1_NAME=Main
//   INSTANCE_1_URL=http://stream-share-main:8080
//   INSTANCE_1_API_KEY=xxxxxxxx
//
// Numbering starts at 1 and stops at the first gap.

function readInstances(env) {
  const instances = [];
  for (let n = 1; ; n++) {
    const url = env[`INSTANCE_${n}_URL`];
    if (!url) break;

    const name = env[`INSTANCE_${n}_NAME`] || `Instance ${n}`;
    const apiKey = env[`INSTANCE_${n}_API_KEY`] || "";

    if (!apiKey) {
      // eslint-disable-next-line no-console
      console.warn(
        `[config] INSTANCE_${n} (${name}) has no INSTANCE_${n}_API_KEY set — ` +
          `requests to it will likely fail with 401 from stream-share.`
      );
    }

    instances.push({
      id: `instance-${n}`,
      name,
      url: url.replace(/\/+$/, ""),
      apiKey,
    });
  }
  return instances;
}

// Gluetun's control server API. GLUETUN_URL is the only required var — leave
// it unset to disable the VPN page entirely. /v1/vpn/status is gluetun's
// current, unified status/start/stop endpoint for both OpenVPN and WireGuard
// (https://github.com/qdm12/gluetun-wiki/blob/main/setup/advanced/control-server.md#openvpn-and-wireguard).
// GLUETUN_STATUS_PATH is an escape hatch for older gluetun versions that only
// have the legacy /v1/openvpn/status path.
//
// Auth: gluetun's control server supports either an API key (X-Api-Key
// header) or HTTP Basic Auth, depending on how its roles config is set up —
// set whichever one matches. If both are set, Basic Auth is used.
function readGluetun(env) {
  const url = (env.GLUETUN_URL || "").replace(/\/+$/, "");
  if (!url) return null;

  return {
    url,
    apiKey: env.GLUETUN_API_KEY || "",
    basicAuth:
      env.GLUETUN_USER && env.GLUETUN_PASSWORD
        ? { user: env.GLUETUN_USER, password: env.GLUETUN_PASSWORD }
        : null,
    statusPath: env.GLUETUN_STATUS_PATH || "/v1/vpn/status",
    timeoutMs: Math.max(1000, Number(env.GLUETUN_TIMEOUT_MS) || 5000),
  };
}

export function loadConfig(env = process.env) {
  const instances = readInstances(env);

  return {
    port: Number(env.PORT) || 3000,
    title: env.DASHBOARD_TITLE || "Stream Share Dashboard",
    pollIntervalMs: Math.max(5000, Number(env.POLL_INTERVAL_MS) || 15000),
    requestTimeoutMs: Math.max(1000, Number(env.INSTANCE_TIMEOUT_MS) || 6000),
    // VOD search hits the instance's upstream Xtream provider live (movies +
    // series, the latter doing a get_series_info round-trip per matching
    // show) — it's routinely much slower than the other, in-memory-backed
    // endpoints that share INSTANCE_TIMEOUT_MS, so it gets its own, longer
    // budget instead of forcing everything else to wait as long too.
    vodSearchTimeoutMs: Math.max(5000, Number(env.VOD_SEARCH_TIMEOUT_MS) || 30000),
    basicAuth:
      env.DASHBOARD_USER && env.DASHBOARD_PASSWORD
        ? { user: env.DASHBOARD_USER, password: env.DASHBOARD_PASSWORD }
        : null,
    instances,
    gluetun: readGluetun(env),
    // Identity sent as "username" on VOD search/download calls — stream-share
    // uses it for per-user timeout checks and to block downloads while that
    // "user" is live-streaming, neither of which apply to dashboard-initiated
    // requests. Change it only if it happens to collide with a real username.
    vodActorUsername: env.VOD_ACTOR_USERNAME || "dashboard",
  };
}
