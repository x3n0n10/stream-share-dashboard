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
// it unset to disable the VPN page entirely. GLUETUN_STATUS_PATH exists as an
// escape hatch: the status/start/stop endpoint has moved across gluetun
// versions (/v1/openvpn/status historically, also used for WireGuard; some
// newer releases expose /v1/vpn/status instead) — override it if the default
// doesn't match your gluetun version.
function readGluetun(env) {
  const url = (env.GLUETUN_URL || "").replace(/\/+$/, "");
  if (!url) return null;

  return {
    url,
    apiKey: env.GLUETUN_API_KEY || "",
    statusPath: env.GLUETUN_STATUS_PATH || "/v1/openvpn/status",
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
    basicAuth:
      env.DASHBOARD_USER && env.DASHBOARD_PASSWORD
        ? { user: env.DASHBOARD_USER, password: env.DASHBOARD_PASSWORD }
        : null,
    instances,
    gluetun: readGluetun(env),
  };
}
