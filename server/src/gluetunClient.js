// Thin client for gluetun's control server HTTP API.
// https://github.com/qdm12/gluetun-wiki/blob/main/setup/advanced/control-server.md

class GluetunError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GluetunError";
    this.status = status;
  }
}

// Basic Auth takes precedence over the API key when both are configured,
// since gluetun's roles config ties a client to exactly one auth method.
function authHeaders(gluetun) {
  if (gluetun.basicAuth) {
    const encoded = Buffer.from(`${gluetun.basicAuth.user}:${gluetun.basicAuth.password}`).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }
  if (gluetun.apiKey) {
    return { "X-Api-Key": gluetun.apiKey };
  }
  return {};
}

async function request(gluetun, path, options = {}) {
  const url = `${gluetun.url}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), gluetun.timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(gluetun),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new GluetunError(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`, res.status);
    }

    if (!res.ok) {
      throw new GluetunError(body.error || body.message || `HTTP ${res.status}`, res.status);
    }
    return body;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new GluetunError(`Timed out after ${gluetun.timeoutMs}ms`, 504);
    }
    if (err instanceof GluetunError) throw err;
    throw new GluetunError(err.message || "Request failed", 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function getVpnStatus(gluetun) {
  const data = await request(gluetun, gluetun.statusPath);
  return data;
}

export async function setVpnStatus(gluetun, status) {
  const data = await request(gluetun, gluetun.statusPath, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
  return data;
}

export async function getPublicIP(gluetun) {
  return request(gluetun, "/v1/publicip/ip");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForVpnStatus(gluetun, desired, deadline) {
  for (;;) {
    try {
      const data = await getVpnStatus(gluetun);
      if (data.status === desired) return data;
    } catch {
      // Transient (e.g. control server momentarily unreachable mid-restart)
      // — keep polling until the deadline instead of failing on the first miss.
    }
    if (Date.now() >= deadline) {
      throw new GluetunError(`Timed out waiting for VPN status "${desired}"`, 504);
    }
    await sleep(1000);
  }
}

// Collapses the manual "stop, wait for it to confirm, start, wait, keep
// refreshing until a new IP shows up" routine into one call: stop, confirm
// stopped, start, confirm running, then poll for a public IP now that the
// tunnel should be back up (retrying since routing/DNS can lag a few seconds
// behind gluetun reporting "running").
export async function reconnectVpn(gluetun) {
  const deadline = Date.now() + gluetun.reconnectTimeoutMs;

  await setVpnStatus(gluetun, "stopped");
  await waitForVpnStatus(gluetun, "stopped", deadline);

  await setVpnStatus(gluetun, "running");
  const vpn = await waitForVpnStatus(gluetun, "running", deadline);

  let publicIp = null;
  let publicIpError = null;
  for (;;) {
    try {
      publicIp = await getPublicIP(gluetun);
      publicIpError = null;
      break;
    } catch (err) {
      publicIpError = err.message;
      if (Date.now() >= deadline) break;
      await sleep(1000);
    }
  }

  return { vpn, publicIp, publicIpError };
}

export { GluetunError };
