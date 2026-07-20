import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  IconOverview,
  IconPlay,
  IconHistory,
  IconTrophy,
  IconUsers,
  IconServer,
  IconSun,
  IconMoon,
  IconMenu,
  IconClose,
} from "./Icons.jsx";
import { useTheme } from "../lib/useTheme.js";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: IconOverview, end: true },
  { to: "/live", label: "Live Now", icon: IconPlay },
  { to: "/history", label: "History", icon: IconHistory },
  { to: "/leaderboard", label: "Leaderboard", icon: IconTrophy },
  { to: "/users", label: "Users", icon: IconUsers },
  { to: "/instances", label: "Instances", icon: IconServer },
];

function NavList({ onNavigate }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60"
            }`
          }
        >
          <Icon className="h-5 w-5 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout({ title, children, headerExtra }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white py-5 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-4">
          <span className="text-xl">📡</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            Stream Share
          </span>
        </div>
        <NavList />
        <div className="px-4 pt-4 text-[11px] text-slate-400 dark:text-slate-600">
          Live data — nothing stored
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white py-5 dark:bg-slate-900">
            <div className="mb-6 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">📡</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Stream Share
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <NavList onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            >
              <IconMenu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {headerExtra}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:pb-6">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        {NAV_ITEMS.slice(0, 5).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                isActive
                  ? "text-accent-600 dark:text-accent-400"
                  : "text-slate-500 dark:text-slate-500"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
