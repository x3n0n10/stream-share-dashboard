import { useMemo, useState } from "react";
import Layout from "../components/Layout.jsx";
import { Card, Badge, EmptyState, ErrorNote, Skeleton, Select, Button } from "../components/common.jsx";
import { IconRefresh, IconTag, IconTrash } from "../components/Icons.jsx";
import { api } from "../lib/api.js";
import { usePolling } from "../lib/usePolling.js";
import { useConfig } from "../lib/ConfigContext.jsx";
import { formatDateTime, formatRelativeTime } from "../lib/format.js";

function rowKey(a) {
  return `${a.instance_id}::${a.ip_address}`;
}

export default function Aliases({ pollIntervalMs }) {
  const config = useConfig();
  const instances = config?.instances || [];

  const [search, setSearch] = useState("");
  const { data, error, loading, updatedAt, refresh } = usePolling(() => api.aliases(), pollIntervalMs, []);

  const [formInstanceId, setFormInstanceId] = useState("");
  const [formIp, setFormIp] = useState("");
  const [formAlias, setFormAlias] = useState("");
  const [formError, setFormError] = useState(null);
  const [formSaving, setFormSaving] = useState(false);

  const [rowState, setRowState] = useState({}); // key -> { deleting, error }

  const aliases = data?.aliases || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return aliases;
    return aliases.filter(
      (a) =>
        a.ip_address?.toLowerCase().includes(q) ||
        a.alias?.toLowerCase().includes(q) ||
        a.instance_name?.toLowerCase().includes(q)
    );
  }, [aliases, search]);

  const instanceId = formInstanceId || instances[0]?.id || "";

  function patchRow(key, patch) {
    setRowState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function submitAlias(e) {
    e.preventDefault();
    const ip = formIp.trim();
    const alias = formAlias.trim();
    if (!ip || !alias || !instanceId) return;

    setFormError(null);
    setFormSaving(true);
    try {
      await api.createAlias(instanceId, ip, alias);
      setFormIp("");
      setFormAlias("");
      await refresh();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSaving(false);
    }
  }

  async function removeAlias(a) {
    const key = rowKey(a);
    patchRow(key, { deleting: true, error: null });
    try {
      await api.deleteAlias(a.instance_id, a.ip_address);
      await refresh();
    } catch (err) {
      patchRow(key, { error: err.message, deleting: false });
    }
  }

  return (
    <Layout
      title="Aliases"
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
      <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
        Give a friendly name to viewers that show up by IP address (e.g. when an instance has LDAP disabled). Aliases
        are per instance and only affect how that instance's viewers are displayed here and in Discord — the
        underlying IP is still what's actually used to identify the viewer.
      </p>

      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Add alias</h2>
        <form onSubmit={submitAlias} className="flex flex-wrap items-end gap-3">
          {instances.length > 1 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Instance</label>
              <Select
                value={instanceId}
                onChange={setFormInstanceId}
                options={instances.map((i) => ({ value: i.id, label: i.name }))}
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">IP address</label>
            <input
              type="text"
              placeholder="203.0.113.42"
              value={formIp}
              onChange={(e) => setFormIp(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Alias</label>
            <input
              type="text"
              placeholder="Living room TV"
              maxLength={64}
              value={formAlias}
              onChange={(e) => setFormAlias(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <Button
            tone="default"
            loading={formSaving}
            disabled={!formIp.trim() || !formAlias.trim() || !instanceId}
            onClick={submitAlias}
          >
            <IconTag className="h-3.5 w-3.5" />
            Save alias
          </Button>
        </form>
        {formError && (
          <div className="mt-3">
            <ErrorNote message={formError} />
          </div>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <input
          type="search"
          placeholder="Search IP, alias, or instance…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-slate-700 dark:bg-slate-900"
        />
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {updatedAt ? `Updated ${formatRelativeTime(updatedAt.toISOString())}` : "Loading…"}
        </p>
      </div>

      {error && (
        <div className="mt-2">
          <ErrorNote message={`Refresh failed: ${error}`} />
        </div>
      )}
      {data?.errors?.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.errors.map((e) => (
            <ErrorNote key={e.instanceId} message={`${e.instanceName}: ${e.error}`} />
          ))}
        </div>
      )}

      <div className="mt-4">
        {loading && !data ? (
          <Skeleton className="h-64" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No aliases configured"
            subtitle="Add one above to give a friendly name to a viewer that currently shows up by IP address."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">IP address</th>
                    <th className="px-4 py-2.5 font-medium">Alias</th>
                    <th className="px-4 py-2.5 font-medium">Instance</th>
                    <th className="px-4 py-2.5 font-medium">Updated</th>
                    <th className="px-4 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((a) => {
                    const key = rowKey(a);
                    const state = rowState[key] || {};
                    return (
                      <tr key={key}>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {a.ip_address}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                          <Badge tone="accent">{a.alias}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{a.instance_name}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-500 dark:text-slate-400">
                          {formatDateTime(a.updated_at)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => removeAlias(a)}
                            disabled={state.deleting}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-900/20 dark:hover:text-rose-400"
                            aria-label={`Remove alias for ${a.ip_address}`}
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
                          {state.error && <p className="mt-1 text-xs text-rose-500 dark:text-rose-400">{state.error}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
