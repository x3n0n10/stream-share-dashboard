import { IconAlert } from "./Icons.jsx";

export function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}

export function StatTile({ label, value, sublabel, icon: Icon, tone = "default" }) {
  const toneClasses = {
    default: "text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-900/30",
    green: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30",
    rose: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30",
  };
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white sm:text-3xl">
            {value}
          </p>
          {sublabel && (
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{sublabel}</p>
          )}
        </div>
        {Icon && (
          <div className={`shrink-0 rounded-xl p-2.5 ${toneClasses[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}

export function Badge({ children, tone = "slate" }) {
  const toneClasses = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    accent: "bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ online }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {online && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      )}
      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
          online ? "bg-emerald-500" : "bg-rose-500"
        }`}
      />
    </span>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 py-14 text-center dark:border-slate-700">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {subtitle && <p className="max-w-sm text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
      <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800 ${className}`} />;
}

export function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
