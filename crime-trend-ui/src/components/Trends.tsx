import { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import type { Incident } from '../hooks/useIncidentStream';
import type { IncidentStats } from '../hooks/useIncidentStream';
import type { Timeframe } from './Filters';

interface TrendsProps {
  incidents: Incident[];
  stats: IncidentStats;
  timeframe: Timeframe;
  isDarkMode: boolean;
}

export function Trends({ incidents, stats, timeframe, isDarkMode }: TrendsProps) {
  const timelineData = useMemo(() => {
    const groups = new Map<string, number>();
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: timeframe === '1h' ? '2-digit' : undefined,
      day: timeframe === '7d' ? '2-digit' : undefined,
      month: timeframe === '7d' ? 'short' : undefined,
      minute: timeframe === '1h' ? '2-digit' : undefined
    });
    incidents.forEach((incident) => {
      const key = formatter.format(new Date(incident.timestamp));
      groups.set(key, (groups.get(key) ?? 0) + 1);
    });
    return Array.from(groups.entries()).map(([bucket, value]) => ({ bucket, value }));
  }, [incidents, timeframe]);

  const categoryData = useMemo(() => {
    return Object.entries(stats.categories).map(([category, value]) => ({ category, value }));
  }, [stats.categories]);

  const axisColor = isDarkMode ? '#94a3b8' : '#475569';
  const gridColor = isDarkMode ? '#1f2937' : '#e2e8f0';
  const tooltipStyle = {
    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
    borderRadius: '0.75rem',
    border: `1px solid ${isDarkMode ? '#1e293b' : '#cbd5f5'}`
  } as const;

  return (
    <div className="grid gap-6 rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-slate-200/70 transition-colors dark:border-slate-800/60 dark:bg-slate-900/50 dark:shadow-slate-900/50 lg:grid-cols-2">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Incident volume</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={timelineData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="fillVolume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="bucket" stroke={axisColor} tickLine={false} axisLine={false} />
            <YAxis stroke={axisColor} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="value" stroke="#22d3ee" fillOpacity={1} fill="url(#fillVolume)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Category breakdown</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={categoryData}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4ade80" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="category" stroke={axisColor} tickLine={false} axisLine={false} />
            <YAxis stroke={axisColor} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[12, 12, 0, 0]} fill="url(#barGradient)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
