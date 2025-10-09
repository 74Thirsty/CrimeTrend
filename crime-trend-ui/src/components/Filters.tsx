import { Dispatch, SetStateAction } from 'react';
import { motion } from 'framer-motion';

export type Category = 'violent' | 'property' | 'traffic' | 'other';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Timeframe = '1h' | '24h' | '7d';

export interface FilterState {
  query: string;
  categories: Set<Category>;
  severities: Set<Severity>;
  timeframe: Timeframe;
  heatmap: boolean;
}

interface FiltersProps {
  filters: FilterState;
  setFilters: Dispatch<SetStateAction<FilterState>>;
  onTogglePause: () => void;
  paused: boolean;
}

const CATEGORY_LABELS: Record<Category, string> = {
  violent: 'Violent',
  property: 'Property',
  traffic: 'Traffic',
  other: 'Other'
};

const SEVERITY_LABELS: Record<Severity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical'
};

const TONE_STYLES: Record<Category | 'neutral', string> = {
  violent: 'border-transparent bg-gradient-to-r from-violent/40 to-violent/20 text-white',
  property: 'border-transparent bg-gradient-to-r from-property/40 to-property/20 text-slate-100',
  traffic: 'border-transparent bg-gradient-to-r from-traffic/40 to-traffic/20 text-slate-100',
  other: 'border-transparent bg-gradient-to-r from-other/40 to-other/20 text-slate-100',
  neutral: 'border-transparent bg-gradient-to-r from-slate-700/60 to-slate-600/40 text-slate-200'
};

export function Filters({ filters, setFilters, onTogglePause, paused }: FiltersProps) {
  const toggleSetValue = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 shadow-inner">
      <div className="flex flex-col gap-3">
        <label htmlFor="search" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Search incidents
        </label>
        <input
          id="search"
          type="search"
          placeholder="Search by keyword or location"
          value={filters.query}
          onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
          className="w-full rounded-lg border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-emerald-400/80 focus:outline-none focus:ring focus:ring-emerald-500/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <ToggleChip
            key={value}
            label={label}
            active={filters.categories.has(value as Category)}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                categories: toggleSetValue(prev.categories, value as Category)
              }))
            }
            tone={value as Category}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
          <ToggleChip
            key={value}
            label={label}
            active={filters.severities.has(value as Severity)}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                severities: toggleSetValue(prev.severities, value as Severity)
              }))
            }
            tone="neutral"
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        {([
          { value: '1h', label: 'Last hour' },
          { value: '24h', label: '24 hours' },
          { value: '7d', label: '7 days' }
        ] as const).map(({ value, label }) => (
          <ToggleChip
            key={value}
            label={label}
            active={filters.timeframe === value}
            onClick={() => setFilters((prev) => ({ ...prev, timeframe: value }))}
            tone="neutral"
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-xs">
        <label className="flex items-center gap-2 text-slate-300">
          <input
            type="checkbox"
            checked={filters.heatmap}
            onChange={(event) => setFilters((prev) => ({ ...prev, heatmap: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-400 focus:ring-emerald-500/40"
          />
          Heatmap mode
        </label>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onTogglePause}
          className={`rounded-full px-3 py-1 font-medium transition ${
            paused ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-400/60' : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/60'
          }`}
        >
          {paused ? 'Resume' : 'Pause'}
        </motion.button>
      </div>
    </div>
  );
}

interface ToggleChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  tone: Category | 'neutral';
}

function ToggleChip({ label, active, onClick, tone }: ToggleChipProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left font-medium shadow transition ${
        active ? TONE_STYLES[tone] : 'border-slate-700/60 bg-slate-900/50 text-slate-300 hover:border-slate-500'
      }`}
    >
      {label}
    </motion.button>
  );
}
