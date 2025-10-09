import { Dispatch, ReactNode, SetStateAction, useEffect } from 'react';
import { FilterState } from './Filters';
import { IncidentStats } from '../hooks/useIncidentStream';
import { motion } from 'framer-motion';

interface LayoutShellProps {
  children: ReactNode;
  onToggleTheme: () => void;
  filters: FilterState;
  setFilters: Dispatch<SetStateAction<FilterState>>;
  paused: boolean;
  onTogglePause: () => void;
  stats: IncidentStats;
}

const STORAGE_KEY = 'crime-trend-filters';

export function LayoutShell({
  children,
  onToggleTheme,
  filters,
  setFilters,
  paused,
  onTogglePause,
  stats
}: LayoutShellProps) {
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<FilterState>;
        setFilters((prev) => ({
          ...prev,
          ...parsed,
          categories: new Set((parsed.categories as string[] | undefined) ?? Array.from(prev.categories)),
          severities: new Set((parsed.severities as string[] | undefined) ?? Array.from(prev.severities))
        }));
      } catch (error) {
        console.error('Failed to parse stored filters', error);
      }
    }
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({
      ...filters,
      categories: Array.from(filters.categories),
      severities: Array.from(filters.severities)
    });
    localStorage.setItem(STORAGE_KEY, payload);
  }, [filters]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-6 pb-10 pt-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Crime Trend Tracker</h1>
            <p className="text-sm text-slate-400">
              Live situational awareness across violent, property, and traffic incidents.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onToggleTheme}
              className="rounded-full border border-slate-700/60 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 shadow-md shadow-slate-900/50 transition hover:border-slate-500"
            >
              Toggle theme
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onTogglePause}
              className={`rounded-full px-4 py-2 text-sm font-semibold shadow-md transition ${
                paused ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-400/60' : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/60'
              }`}
            >
              {paused ? 'Resume stream' : 'Pause stream'}
            </motion.button>
          </div>
        </header>
        <section className="grid grid-cols-2 gap-4 text-sm text-slate-300 sm:grid-cols-5">
          <StatCard title="Active incidents" value={stats.total.toLocaleString()} highlight="from-emerald-500/80 to-emerald-400/60" />
          <StatCard title="Violent" value={stats.categories.violent ?? 0} highlight="from-violent/60 to-violent/30" />
          <StatCard title="Property" value={stats.categories.property ?? 0} highlight="from-property/50 to-property/20" />
          <StatCard title="Traffic" value={stats.categories.traffic ?? 0} highlight="from-traffic/50 to-traffic/20" />
          <StatCard title="Other" value={stats.categories.other ?? 0} highlight="from-other/50 to-other/20" />
        </section>
        {children}
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  highlight: string;
}

function StatCard({ title, value, highlight }: StatCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/50 shadow-lg">
      <div className={`h-1 bg-gradient-to-r ${highlight}`} />
      <div className="space-y-2 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
        <p className="text-2xl font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}
