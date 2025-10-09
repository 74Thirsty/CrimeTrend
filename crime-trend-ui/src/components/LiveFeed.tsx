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
        const text = `${incident.title} ${incident.location} ${incident.description ?? ''}`.toLowerCase();
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
                <div>
                  <h3 className="text-base font-semibold text-white">{incident.title}</h3>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{incident.category}</p>
                </div>
                <span className={`text-xs font-semibold ${severityColors[incident.severity] ?? 'text-slate-300'}`}>
                  {incident.severity}
                </span>
              </header>
              <p className="mt-2 text-sm text-slate-300">{incident.description ?? 'No additional details provided.'}</p>
              <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>{new Date(incident.timestamp).toLocaleTimeString()}</span>
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
              </footer>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
