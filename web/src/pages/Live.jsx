import Layout from "../components/Layout.jsx";
import { Card, Badge, EmptyState, ErrorNote, Skeleton } from "../components/common.jsx";
import { IconRefresh, IconUsers } from "../components/Icons.jsx";
import { api } from "../lib/api.js";
import { usePolling } from "../lib/usePolling.js";
import { formatRelativeTime, titleCase } from "../lib/format.js";

export default function Live({ pollIntervalMs }) {
  const { data, error, loading, updatedAt, refresh } = usePolling(
    () => api.overview(1),
    pollIntervalMs,
    []
  );

  const instances = data?.instances || [];
  const streams = instances
    .flatMap((i) =>
      (i.status?.summary || []).map((s) => ({ ...s, instanceName: i.name, instanceId: i.id }))
    )
    .sort((a, b) => b.viewer_count - a.viewer_count);

  return (
    <Layout
      title="Live Now"
      headerExtra={
        <button
          onClick={refresh}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Refresh"
        >
          <IconRefresh className="h-4 w-4" />
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {updatedAt ? `Updated ${formatRelativeTime(updatedAt.toISOString())}` : "Loading…"}
        </p>
        {error && <ErrorNote message={`Refresh failed: ${error}`} />}
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : streams.length === 0 ? (
        <EmptyState title="No active streams" subtitle="Live streams from every configured instance appear here in real time." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {streams.map((s, idx) => (
            <Card key={`${s.instanceId}-${s.stream_id}-${idx}`} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-slate-900 dark:text-white">{s.stream_title || s.stream_id}</p>
                <Badge tone="green">{s.duration}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Badge tone="slate">{titleCase(s.stream_type)}</Badge>
                <span>on</span>
                <span className="font-medium text-slate-600 dark:text-slate-300">{s.instanceName}</span>
                {s.epg_channel_id && <span className="text-slate-400">· {s.epg_channel_id}</span>}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <IconUsers className="h-3.5 w-3.5" />
                {s.viewer_count} viewer{s.viewer_count === 1 ? "" : "s"}
              </div>
              {s.viewers?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.viewers.map((v) => (
                    <span
                      key={v}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}
