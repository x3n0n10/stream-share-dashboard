import { useState } from "react";
import Layout from "../components/Layout.jsx";
import HoursSelect from "../components/HoursSelect.jsx";
import { Card, StatTile, Badge, StatusDot, EmptyState, ErrorNote, Skeleton, TechSummary } from "../components/common.jsx";
import { IconOverview, IconPlay, IconUsers, IconHistory, IconRefresh } from "../components/Icons.jsx";
import { api } from "../lib/api.js";
import { usePolling } from "../lib/usePolling.js";
import { formatDuration, formatNumber, formatRelativeTime, titleCase } from "../lib/format.js";

export default function Overview({ pollIntervalMs }) {
  const [hours, setHours] = useState(24);
  const { data, error, loading, updatedAt, refresh } = usePolling(
    () => api.overview(hours),
    pollIntervalMs,
    [hours]
  );

  const instances = data?.instances || [];
  const online = instances.filter((i) => i.online);

  const totals = instances.reduce(
    (acc, i) => {
      acc.activeStreams += i.stats?.active_streams ?? i.status?.streams_count ?? 0;
      acc.activeViewers += i.stats?.active_viewers ?? i.status?.users_count_active ?? 0;
      acc.sessions += i.stats?.sessions ?? 0;
      acc.watchSeconds += i.stats?.watch_seconds ?? 0;
      return acc;
    },
    { activeStreams: 0, activeViewers: 0, sessions: 0, watchSeconds: 0 }
  );

  const nowPlaying = instances
    .flatMap((i) =>
      (i.status?.summary || []).map((s) => ({ ...s, instanceName: i.name, instanceId: i.id }))
    )
    .sort((a, b) => b.viewer_count - a.viewer_count);

  return (
    <Layout
      title="Overview"
      headerExtra={
        <>
          <HoursSelect hours={hours} onChange={setHours} />
          <button
            onClick={refresh}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Refresh"
          >
            <IconRefresh className="h-4 w-4" />
          </button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {updatedAt ? `Updated ${formatRelativeTime(updatedAt.toISOString())}` : "Loading…"}
        </p>
        {error && <ErrorNote message={`Refresh failed: ${error}`} />}
      </div>

      {loading && !data ? (
        <SkeletonGrid />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile
              label="Instances online"
              value={`${online.length}/${instances.length}`}
              icon={IconOverview}
              tone={online.length === instances.length ? "green" : "amber"}
            />
            <StatTile label="Active streams" value={formatNumber(totals.activeStreams)} icon={IconPlay} tone="accent" />
            <StatTile label="Active viewers" value={formatNumber(totals.activeViewers)} icon={IconUsers} tone="default" />
            <StatTile
              label="Watch time (window)"
              value={formatDuration(totals.watchSeconds)}
              sublabel={`${formatNumber(totals.sessions)} sessions`}
              icon={IconHistory}
              tone="default"
            />
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Instances</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {instances.map((i) => (
                <Card key={i.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusDot online={i.online} />
                      <span className="truncate font-medium text-slate-900 dark:text-white">{i.name}</span>
                    </div>
                    <Badge tone={i.online ? "green" : "rose"}>{i.online ? "online" : "offline"}</Badge>
                  </div>
                  {i.online ? (
                    <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
                      <dt className="text-slate-400">Streams</dt>
                      <dd className="text-right font-medium text-slate-700 dark:text-slate-200">
                        {i.stats?.active_streams ?? i.status?.streams_count ?? 0}
                      </dd>
                      <dt className="text-slate-400">Viewers</dt>
                      <dd className="text-right font-medium text-slate-700 dark:text-slate-200">
                        {i.stats?.active_viewers ?? i.status?.users_count_active ?? 0}
                      </dd>
                      <dt className="text-slate-400">Uptime</dt>
                      <dd className="text-right font-medium text-slate-700 dark:text-slate-200">
                        {i.instance ? formatDuration(i.instance.uptime_seconds) : "—"}
                      </dd>
                    </dl>
                  ) : (
                    <p className="mt-3 text-xs text-rose-500 dark:text-rose-400">{i.error || "Unreachable"}</p>
                  )}
                </Card>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Now playing</h2>
            {nowPlaying.length === 0 ? (
              <EmptyState title="Nothing is playing" subtitle="Active streams across every instance will show up here." />
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Title</th>
                        <th className="px-4 py-2.5 font-medium">Instance</th>
                        <th className="px-4 py-2.5 font-medium">Type</th>
                        <th className="px-4 py-2.5 font-medium">Viewers</th>
                        <th className="px-4 py-2.5 font-medium">Since</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {nowPlaying.map((s, idx) => (
                        <tr key={`${s.instanceId}-${s.stream_id}-${idx}`}>
                          <td className="max-w-[16rem] px-4 py-2.5">
                            <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                              {s.stream_title || s.stream_id}
                            </p>
                            <TechSummary tech={s.tech} className="truncate" />
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{s.instanceName}</td>
                          <td className="px-4 py-2.5">
                            <Badge tone="slate">{titleCase(s.stream_type)}</Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <span title={s.viewers?.join(", ")} className="font-medium">
                              {s.viewer_count}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{s.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}
