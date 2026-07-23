import { useState } from "react";
import Layout from "../components/Layout.jsx";
import { Card, Badge, EmptyState, ErrorNote, Button } from "../components/common.jsx";
import { IconSearch, IconDownload } from "../components/Icons.jsx";
import { api } from "../lib/api.js";
import { titleCase } from "../lib/format.js";

function resultKey(r) {
  return `${r.instance_id}::${r.StreamType}::${r.StreamID}`;
}

export default function Vod() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [rowState, setRowState] = useState({}); // key -> { sizing, downloading, error }

  async function runSearch(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setSearchError(null);
    setRowState({});
    try {
      const data = await api.vodSearch(q);
      setResults(data.results || []);
      setErrors(data.errors || []);
      setSubmittedQuery(q);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function patchRow(key, patch) {
    setRowState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function getSize(result) {
    const key = resultKey(result);
    patchRow(key, { sizing: true, error: null });
    try {
      const enriched = await api.vodSize(result.instance_id, result);
      setResults((prev) =>
        prev.map((r) => (resultKey(r) === key ? { ...r, SizeBytes: enriched.SizeBytes, Size: enriched.Size } : r))
      );
    } catch (err) {
      patchRow(key, { error: err.message });
    } finally {
      patchRow(key, { sizing: false });
    }
  }

  async function download(result) {
    const key = resultKey(result);
    patchRow(key, { downloading: true, error: null });
    try {
      const data = await api.vodDownload(result.instance_id, result.StreamID, result.Title, result.StreamType);
      window.open(data.download_url, "_blank", "noopener");
    } catch (err) {
      patchRow(key, { error: err.message });
    } finally {
      patchRow(key, { downloading: false });
    }
  }

  return (
    <Layout title="VOD Search">
      <form onSubmit={runSearch} className="flex gap-2">
        <input
          type="search"
          autoFocus
          placeholder="Search movies and series across all instances…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-slate-700 dark:bg-slate-900"
        />
        <Button onClick={runSearch} loading={loading} disabled={!query.trim()}>
          <IconSearch className="h-4 w-4" />
          Search
        </Button>
      </form>

      {searchError && (
        <div className="mt-3">
          <ErrorNote message={`Search failed: ${searchError}`} />
        </div>
      )}
      {errors.length > 0 && (
        <div className="mt-3 space-y-1">
          {errors.map((e) => (
            <ErrorNote key={e.instanceId} message={`${e.instanceName}: ${e.error}`} />
          ))}
        </div>
      )}

      <div className="mt-6">
        {!submittedQuery && !loading ? (
          <EmptyState
            title="Search for a movie or series"
            subtitle="Results are pulled live from every instance that has an Xtream provider configured — nothing is indexed or stored here."
          />
        ) : loading ? (
          <EmptyState title="Searching…" />
        ) : results.length === 0 ? (
          <EmptyState title={`No results for "${submittedQuery}"`} subtitle="Try a different title or spelling." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((r) => {
              const key = resultKey(r);
              const state = rowState[key] || {};
              return (
                <Card key={key} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug text-slate-900 dark:text-white">{r.Title}</p>
                    <Badge tone={r.StreamType === "series" ? "accent" : "slate"}>{titleCase(r.StreamType)}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {r.Category && <span>{r.Category}</span>}
                    {r.Year && <span>{r.Year}</span>}
                    {r.Rating && <span>★ {r.Rating}</span>}
                    {r.Duration && <span>{r.Duration}</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{r.instance_name}</p>

                  {state.error && (
                    <div className="mt-2">
                      <ErrorNote message={state.error} />
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    {r.Size ? (
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{r.Size}</span>
                    ) : (
                      <button
                        onClick={() => getSize(r)}
                        disabled={state.sizing}
                        className="text-xs font-medium text-accent-600 hover:underline disabled:opacity-50 dark:text-accent-400"
                      >
                        {state.sizing ? "Checking size…" : "Get size"}
                      </button>
                    )}
                    <Button tone="ghost" loading={state.downloading} onClick={() => download(r)}>
                      <IconDownload className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
