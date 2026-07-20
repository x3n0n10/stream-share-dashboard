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

export { GluetunError };
