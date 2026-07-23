# stream-share-dashboard

A read-only dashboard for one or more [stream-share](https://github.com/lucasduport/stream-share)
instances: live viewers, active streams, watch history, and leaderboards,
aggregated across every instance you point it at.

Runs as a single Docker container. There is no database — every request is
answered by calling each configured instance's internal API live, then the
result is discarded. Nothing about your instances or their viewers is
persisted by the dashboard itself.

## Why a (tiny) backend, not a static site

It might look like this could be a pure static/browser app, but two things
rule that out:

- **Auth.** Each stream-share instance's `/api/internal/*` endpoints require
  an `X-API-Key` header. Shipping those keys to the browser would expose them
  to anyone who loads the page.
- **CORS.** stream-share's CORS policy doesn't allow custom headers
  cross-origin, so a browser can't call `X-API-Key`-protected endpoints on a
  different origin directly anyway.

So the container includes a small stateless Node/Express backend that holds
the API keys server-side, proxies/aggregates the calls, and serves the built
frontend. It has no database and no persistence — restart it any time.

## Configuring instances

Instances are set as numbered environment variables (see `docker-compose.yml`),
so no JSON escaping is needed in Compose:

```yaml
INSTANCE_1_NAME: "Main"
INSTANCE_1_URL: "http://stream-share-main:8080"
INSTANCE_1_API_KEY: "<that instance's INTERNAL_API_KEY>"

INSTANCE_2_NAME: "Backup"
INSTANCE_2_URL: "http://stream-share-backup:8080"
INSTANCE_2_API_KEY: "<that instance's INTERNAL_API_KEY>"
```

Add as many `INSTANCE_N_*` triples as you have instances; numbering starts at
1 and stops at the first missing `_URL`. Each `INSTANCE_N_API_KEY` must match
that instance's `INTERNAL_API_KEY` (set in the stream-share instance's own
`docker-compose.yml`).

Other environment variables (all optional, see `docker-compose.yml` for the
full list with defaults): `PORT`, `DASHBOARD_TITLE`, `POLL_INTERVAL_MS`,
`INSTANCE_TIMEOUT_MS`, and `DASHBOARD_USER` / `DASHBOARD_PASSWORD` to put the
whole dashboard behind HTTP basic auth (it displays viewer usernames and IPs
pulled from every configured instance, so consider enabling this or putting
it behind your own reverse proxy / VPN if it's reachable outside a trusted
network).

## Running it

```bash
docker compose up -d --build
```

Then open `http://localhost:3000`. If an instance is unreachable or its key
is wrong, the dashboard keeps working for the rest — that instance just shows
as offline with the error it hit.

## Testing a commit without building it yourself

Every push to this repo publishes a Docker image via the `Dev Image` GitHub
Actions workflow (`.github/workflows/dev-image.yml`), no build required on
your side:

- `ghcr.io/x3n0n10/stream-share-dashboard:dev-<short-sha>` — one specific
  commit, always available, never moves.
- `ghcr.io/x3n0n10/stream-share-dashboard:dev` — floating tag that always
  points at the latest commit on `main`.

To run one of these instead of building locally, use the provided override:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

That pulls `:dev` by default; pin a specific commit with:

```bash
DASHBOARD_IMAGE=ghcr.io/x3n0n10/stream-share-dashboard:dev-abc1234 \
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

GHCR packages are private by default. Either mark the package public under
the repo's *Packages* settings on GitHub, or authenticate first:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <your-github-username> --password-stdin
```

(A classic PAT with `read:packages` scope works too, in place of
`$GITHUB_TOKEN`.)

## What it shows

- **Overview** — global totals plus a live status card per instance and a
  "now playing" table merged across all of them.
- **Live Now** — every currently active stream, with viewers, grouped across
  instances. Both this and Overview's "now playing" table show a compact
  technical summary (video codec/resolution/fps, audio track languages,
  subtitle languages) under the title whenever the instance reports it —
  requires a stream-share version that probes and returns stream tech info;
  older instances simply show nothing extra.
- **History** — a merged, searchable, chronological watch-history feed.
- **Leaderboard** — top titles and top viewers, summed across instances for
  the selected time window.
- **Users** — every known user session across instances, watching or idle.
- **Instances** — per-instance health, uptime, and enabled features
  (Discord, VOD cache, catchup).
- **VPN** — optional; shows [gluetun](https://github.com/qdm12/gluetun)'s
  connection status and exit IP/location, with Start/Stop buttons. Only
  appears once configured (see below); otherwise shows how to enable it.
- **VOD Search** — search movies and series across every instance at once.
  Requires that instance's Xtream provider to be configured; instances
  proxying a plain M3U will show a per-instance error instead of results.
  File size is left blank until you click "Get size" (it's a live upstream
  probe per title, done on demand rather than for every result). Download
  creates a temporary link on the instance that owns the content and opens
  it directly — the dashboard itself never proxies the file.

All pages except VOD Search auto-refresh (`POLL_INTERVAL_MS`, default 15s)
and work down to phone-sized screens.

## Gluetun VPN control (optional)

If your stack routes stream-share's outbound connection through
[gluetun](https://github.com/qdm12/gluetun), point the dashboard at its
control server to get a VPN page with live status, exit IP, and Start/Stop
buttons:

```yaml
GLUETUN_URL: "http://gluetun:8000"   # gluetun's control server, same network

# Gluetun's control server uses either an API key OR HTTP Basic Auth,
# depending on its roles config — set whichever one matches yours.
GLUETUN_API_KEY: ""
# GLUETUN_USER: ""
# GLUETUN_PASSWORD: ""

# GLUETUN_STATUS_PATH: "/v1/openvpn/status"  # override for older gluetun versions, see below
```

Leave `GLUETUN_URL` blank to hide the page entirely.

This talks to gluetun's [control server
API](https://github.com/qdm12/gluetun-wiki/blob/main/setup/advanced/control-server.md).
By default it uses `/v1/vpn/status`, gluetun's current unified status/start/stop
endpoint for both OpenVPN and WireGuard. Older gluetun versions only have the
legacy `/v1/openvpn/status` path (used for both VPN types despite the name) —
set `GLUETUN_STATUS_PATH` to that if `/v1/vpn/status` 404s for you. The VPN
page has a "Show raw gluetun response" toggle so you can immediately see the
actual JSON shape your gluetun version returns if something looks off.

**Stopping the VPN is a real action**, not just a UI toggle — it calls
gluetun's control server directly and will interrupt or expose whatever
traffic is routed through it. The dashboard confirms before stopping, but
there's no undo beyond hitting Start again.

## Development

```bash
# backend
cd server && npm install && npm start

# frontend (separate terminal, proxies /api to the backend above)
cd web && npm install && npm run dev
```
