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
  points at whichever push landed most recently, on any branch. If you're
  working on more than one branch at a time, pin `:dev-<short-sha>` instead
  so you know exactly which commit you're running.

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

## Stable releases

Publishing a [GitHub Release](https://github.com/x3n0n10/stream-share-dashboard/releases)
(e.g. tagging `v1.1`) runs the `Release Image` workflow
(`.github/workflows/release-image.yml`), which builds and publishes:

- `ghcr.io/x3n0n10/stream-share-dashboard:<tag>` — e.g. `:v1.1`, that exact
  release, never moves.
- `ghcr.io/x3n0n10/stream-share-dashboard:latest` — floating tag that always
  points at the most recently published release. Pre-releases get their own
  version tag but don't move `:latest`.

Same override file as the dev images works here too, just point
`DASHBOARD_IMAGE` at a release tag instead:

```bash
DASHBOARD_IMAGE=ghcr.io/x3n0n10/stream-share-dashboard:latest \
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## What it shows

- **Overview** — global totals plus a live status card per instance and a
  "now playing" table merged across all of them: title, instance, EPG
  channel ID, viewer count and names, and how long each stream's been
  running. Shows a compact technical summary (video codec/resolution/fps,
  audio track languages, subtitle languages) under the title whenever the
  instance reports it — requires a stream-share version that probes and
  returns stream tech info; older instances simply show nothing extra.
- **History** — a merged, searchable, chronological watch-history feed.
- **Leaderboard** — top titles and top viewers, summed across instances for
  the selected time window.
- **Users** — every known user session across instances, watching or idle.
- **Aliases** — give a friendly name to viewers that show up by IP address
  (e.g. when an instance has LDAP disabled and falls back to using the
  client's IP as its per-viewer identity). An alias means the same thing
  regardless of which instance a viewer hits, but each instance stores its
  own copy (separate DBs, via that instance's own `/api/internal/ip-aliases`
  endpoints) — adding one applies it to every configured instance at once by
  default (toggle off to target just one), and the table groups by IP so a
  synced alias shows as one row instead of one per instance, only flagging
  as "mixed" if a set has actually drifted. On Overview, any viewer chip
  that's still showing a raw, un-aliased IP links straight to this page with
  that IP prefilled. Once set, the alias replaces the raw IP anywhere a
  viewer identity is shown (Overview, Users, History) and requires a
  stream-share version with the IP-alias feature; older instances just show
  raw IPs as before.
- **Instances** — per-instance health, uptime, and enabled features
  (Discord, VOD cache, catchup).
- **VPN** — optional; shows [gluetun](https://github.com/qdm12/gluetun)'s
  connection status and exit IP/location, with Start/Stop/Reconnect buttons.
  Only appears once configured (see below); otherwise shows how to enable it.
- **VOD Search** — search movies and series across every instance at once.
  Requires that instance's Xtream provider to be configured; instances
  proxying a plain M3U will show a per-instance error instead of results.
  Series results are grouped into one card per series (per instance) that
  expands to list its episodes — stream-share's search returns one result
  per episode, so the dashboard consolidates them client-side. "Copy URL"
  copies the temporary download link to the clipboard instead of opening it;
  both that and "Download" create a fresh link each time on the instance
  that owns the content — the dashboard itself never proxies the file.
  Search itself is a live call to each instance's upstream Xtream provider
  (not the fast, in-memory endpoints the rest of the dashboard uses) and can
  take well over
  `INSTANCE_TIMEOUT_MS` on a slow provider or a large series catalog, so it
  has its own, longer budget: `VOD_SEARCH_TIMEOUT_MS` (default 30s).

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
# GLUETUN_RECONNECT_TIMEOUT_MS: "45000"  # overall budget for the Reconnect button, see below
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

**Reconnect** collapses the manual "stop, wait, start, wait, keep refreshing"
routine into one button: it stops the tunnel, confirms it actually stopped,
starts it again, and confirms it's running — that's it server-side. It
deliberately doesn't touch gluetun's public IP endpoint itself (repeatedly
polling it here on top of the dashboard's own regular polling was hammering
gluetun's IP lookup); "reconnected" is purely the VPN status flipping to
"running". The exit IP just shows up naturally from the dashboard's own
status polling, which is why the dashboard bumps that polling to every
second while a reconnect is in flight (budget: `GLUETUN_RECONNECT_TIMEOUT_MS`,
default 45s, floor 15s) and keeps it at that pace for a bit afterward until
the exit IP card actually has a value (or ~20s pass without one) — same
mechanism as always, just running faster during and right after a
reconnect. Like Stop, it briefly interrupts traffic, so it's confirmed
before running — the confirmation closes immediately once you accept so
you can watch the reconnect happen live instead of staring at a dialog.

## Development

```bash
# backend
cd server && npm install && npm start

# frontend (separate terminal, proxies /api to the backend above)
cd web && npm install && npm run dev
```
