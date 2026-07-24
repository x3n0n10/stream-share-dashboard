// Thin client for a single stream-share instance's internal API.
// Every call is made fresh at request time — nothing is persisted here.

class InstanceError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "InstanceError";
    this.status = status;
  }
}

async function callInstance(instance, path, { timeoutMs, query, method, body } = {}) {
  const url = new URL(`${instance.url}/api/internal${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: method || "GET",
      headers: {
        "X-API-Key": instance.apiKey,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let responseBody;
    try {
      responseBody = await res.json();
    } catch {
      throw new InstanceError(`Non-JSON response (HTTP ${res.status})`, res.status);
    }

    if (!res.ok || responseBody.success === false) {
      throw new InstanceError(responseBody.error || `HTTP ${res.status}`, res.status);
    }

    return responseBody.data;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new InstanceError(`Timed out after ${timeoutMs}ms`, 504);
    }
    if (err instanceof InstanceError) throw err;
    throw new InstanceError(err.message || "Request failed", 502);
  } finally {
    clearTimeout(timer);
  }
}

// Fetches the small set of endpoints the Overview page needs in one shot.
// Failures are captured per-call (Promise.allSettled) so a partially-broken
// instance (e.g. DB down but sessions up) still surfaces what it can.
export async function fetchInstanceSnapshot(instance, { timeoutMs, hours }) {
  const [instanceInfo, status, stats] = await Promise.allSettled([
    callInstance(instance, "/instance", { timeoutMs }),
    callInstance(instance, "/status", { timeoutMs }),
    callInstance(instance, "/stats", { timeoutMs, query: { hours } }),
  ]);

  const firstError = [instanceInfo, status, stats].find((r) => r.status === "rejected");

  return {
    id: instance.id,
    name: instance.name,
    url: instance.url,
    online: instanceInfo.status === "fulfilled" || status.status === "fulfilled",
    error: firstError ? firstError.reason.message : null,
    instance: instanceInfo.status === "fulfilled" ? instanceInfo.value : null,
    status: status.status === "fulfilled" ? status.value : null,
    stats: stats.status === "fulfilled" ? stats.value : null,
  };
}

export async function fetchHistory(instance, { timeoutMs, hours, limit, offset }) {
  return callInstance(instance, "/history", { timeoutMs, query: { hours, limit, offset } });
}

export async function fetchStats(instance, { timeoutMs, hours }) {
  return callInstance(instance, "/stats", { timeoutMs, query: { hours } });
}

export async function fetchUsers(instance, { timeoutMs }) {
  return callInstance(instance, "/users", { timeoutMs });
}

export async function fetchStreams(instance, { timeoutMs }) {
  return callInstance(instance, "/streams", { timeoutMs });
}

export async function fetchUserHistory(instance, username, { timeoutMs, hours, limit, offset }) {
  return callInstance(instance, `/history/${encodeURIComponent(username)}`, {
    timeoutMs,
    query: { hours, limit, offset },
  });
}

// Search is fast and never includes file sizes — stream-share only prefills
// sizes it already has cached, keeping the request cheap across instances.
export async function searchVOD(instance, query, { timeoutMs, username }) {
  return callInstance(instance, "/vod/search", {
    timeoutMs,
    method: "POST",
    body: { username, query },
  });
}

export async function createVODDownload(instance, { username, streamId, title, type }, { timeoutMs }) {
  return callInstance(instance, "/vod/download", {
    timeoutMs,
    method: "POST",
    body: { username, stream_id: streamId, title, type },
  });
}

export { InstanceError };
