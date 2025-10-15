import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FilterState } from './Filters';
import type { Incident } from '../hooks/useIncidentStream';

interface LiveFeedProps {
  incidents: Incident[];
  filters: FilterState;
  paused: boolean;
}

const severityColors: Record<string, string> = {
  low: 'text-emerald-300',
  medium: 'text-amber-300',
  high: 'text-orange-300',
  critical: 'text-rose-300'
};

export function LiveFeed({ incidents, filters, paused }: LiveFeedProps) {
  const filteredIncidents = useMemo(() => {
    const query = filters.query.toLowerCase();
    return incidents.filter((incident) => {
      if (filters.categories.size > 0 && !filters.categories.has(incident.category)) {
        return false;
      }
      if (filters.severities.size > 0 && !filters.severities.has(incident.severity)) {
        return false;
      }
      if (query) {
        const text = `${incident.title} ${incident.location} ${incident.description ?? ''} ${incident.source.name} ${
          incident.status ?? ''
        }`.toLowerCase();
        if (!text.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [incidents, filters]);

  return (
    <div className="flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-2 text-xs text-slate-400">
        <span>{paused ? 'Feed paused' : 'Live feed'}</span>
        <span>{filteredIncidents.length} incidents</span>
      </div>
      <div className="mt-3 h-[60vh] space-y-3 overflow-y-auto pr-1">
        <AnimatePresence>
          {filteredIncidents.map((incident) => (
            <motion.article
              key={incident.id}
              layout
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.25 }}
              className="group rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 shadow-sm backdrop-blur hover:border-slate-600"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-white">{incident.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                    <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-slate-200">{incident.category}</span>
                    {incident.status && (
                      <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-indigo-200">{incident.status}</span>
                    )}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${severityColors[incident.severity] ?? 'text-slate-300'}`}>
                  {incident.severity}
                </span>
              </header>
              <p className="mt-2 text-sm text-slate-300">{incident.description ?? 'No additional details provided.'}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>{new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4 text-emerald-400"
                  >
                    <path d="M12 2.25c-4.97 0-9 3.77-9 8.42 0 2.6 1.3 4.96 3.34 6.51l5.07 4.03c.43.34 1.05.34 1.48 0l5.07-4.03A8.28 8.28 0 0021 10.67c0-4.65-4.03-8.42-9-8.42zm0 10.45a2.03 2.03 0 110-4.06 2.03 2.03 0 010 4.06z" />
                  </svg>
                  {incident.location}
                </span>
                <span className="flex items-center gap-2 text-slate-300">
                  <div className="relative h-2 w-24 overflow-hidden rounded-full bg-slate-800/80">
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-400/80"
                      style={{ width: `${Math.min(100, Math.max(0, incident.confidence))}%` }}
                    />
                  </div>
                  <span className="font-semibold text-emerald-300">{incident.confidence}% confidence</span>
                </span>
                <span className="flex items-center gap-1 text-slate-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4 text-sky-400"
                  >
                    <path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
                  </svg>
                  {incident.source.name}
                </span>
                {incident.ingestedAt && <span>First seen {formatRelativeTime(incident.ingestedAt)}</span>}
              </div>
              {incident.timeline.length > 0 && (
                <div className="mt-3 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recent activity</p>
                  <ol className="mt-2 space-y-2">
                    {incident.timeline.slice(-4).map((entry, index, array) => (
                      <li key={`${incident.id}-${entry.timestamp}-${index}`} className="flex items-center gap-3 text-xs text-slate-300">
                        <span className="font-semibold text-slate-200">
                          {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                        <span className="text-slate-400">{entry.label ?? entry.code ?? 'Updated'}</span>
                        {index === array.length - 1 && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                            Latest
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: string) {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return 'recently';
  }

  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
