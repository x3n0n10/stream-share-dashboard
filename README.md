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

## What it shows

- **Overview** — global totals plus a live status card per instance and a
  "now playing" table merged across all of them.
- **Live Now** — every currently active stream, with viewers, grouped across
  instances.
- **History** — a merged, searchable, chronological watch-history feed.
- **Leaderboard** — top titles and top viewers, summed across instances for
  the selected time window.
- **Users** — every known user session across instances, watching or idle.
- **Instances** — per-instance health, uptime, and enabled features
  (Discord, VOD cache, catchup).

All pages auto-refresh (`POLL_INTERVAL_MS`, default 15s) and work down to
phone-sized screens.

## Development

```bash
# backend
cd server && npm install && npm start

# frontend (separate terminal, proxies /api to the backend above)
cd web && npm install && npm run dev
```
