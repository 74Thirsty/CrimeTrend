import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ALL_STATE_OPTION } from '../constants/states';
import { ALL_COUNTY_OPTION } from '../constants/counties';
import { STREAM_SOURCES, StreamSource } from '../constants/streams';
import { useBroadcastifyRegions } from '../hooks/useBroadcastifyRegions';

export type Category = 'violent' | 'property' | 'traffic' | 'other';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Timeframe = '1h' | '24h' | '7d';

export interface FilterState {
  query: string;
  categories: Set<Category>;
  severities: Set<Severity>;
  timeframe: Timeframe;
  heatmap: boolean;
  state: string;
  county: string;
  stream: StreamSource;
}

export interface SavedFilterPreset {
  id: string;
  name: string;
  filters: {
    query: string;
    categories: Category[];
    severities: Severity[];
    timeframe: Timeframe;
    heatmap: boolean;
    state: string;
    county: string;
    stream: StreamSource;
  };
}

export type SavePresetResult = 'created' | 'updated' | 'skipped';

interface FiltersProps {
  filters: FilterState;
  setFilters: Dispatch<SetStateAction<FilterState>>;
  onTogglePause: () => void;
  paused: boolean;
  savedPresets: SavedFilterPreset[];
  onSavePreset: (name: string) => SavePresetResult;
  onApplyPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
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
  violent:
    'border-transparent bg-gradient-to-r from-violent/20 to-violent/10 text-violent-700 dark:from-violent/40 dark:to-violent/20 dark:text-white',
  property:
    'border-transparent bg-gradient-to-r from-property/20 to-property/10 text-orange-700 dark:from-property/40 dark:to-property/20 dark:text-slate-100',
  traffic:
    'border-transparent bg-gradient-to-r from-traffic/20 to-traffic/10 text-sky-700 dark:from-traffic/40 dark:to-traffic/20 dark:text-slate-100',
  other:
    'border-transparent bg-gradient-to-r from-other/20 to-other/10 text-emerald-700 dark:from-other/40 dark:to-other/20 dark:text-slate-100',
  neutral:
    'border-transparent bg-gradient-to-r from-slate-200 to-slate-100 text-slate-800 dark:from-slate-700/60 dark:to-slate-600/40 dark:text-slate-200'
};

export function Filters({
  filters,
  setFilters,
  onTogglePause,
  paused,
  savedPresets,
  onSavePreset,
  onApplyPreset,
  onDeletePreset
}: FiltersProps) {
  const toggleSetValue = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  };

  const [presetName, setPresetName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [stateDraft, setStateDraft] = useState(filters.state);
  const [countyDraft, setCountyDraft] = useState(filters.county);
  const { states, counties, loadingStates, loadingCounties } = useBroadcastifyRegions(stateDraft);
  const feedbackTone = useMemo(() => {
    if (!feedback) return '';
    return feedback.includes('updated') ? 'text-amber-300' : 'text-emerald-300';
  }, [feedback]);

  useEffect(() => {
    setStateDraft(filters.state);
    setCountyDraft(filters.county);
  }, [filters.state, filters.county]);

  useEffect(() => {
    const available = counties;
    if (countyDraft !== ALL_COUNTY_OPTION && !available.includes(countyDraft)) {
      setCountyDraft(ALL_COUNTY_OPTION);
    }
  }, [stateDraft, countyDraft, counties]);

  const availableCounties = useMemo(() => {
    return [ALL_COUNTY_OPTION, ...counties];
  }, [counties]);

  useEffect(() => {
    if (stateDraft === ALL_STATE_OPTION) {
      return;
    }
    if (states.length === 0) {
      setStateDraft(ALL_STATE_OPTION);
    } else if (!states.some((state) => state.code === stateDraft)) {
      setStateDraft(ALL_STATE_OPTION);
    }
  }, [states, stateDraft]);

  const needsLocationApply = stateDraft !== filters.state || countyDraft !== filters.county;

  const handleSavePreset = () => {
    const result = onSavePreset(presetName);
    if (result === 'skipped') {
      setFeedback('Name required');
      return;
    }
    setFeedback(result === 'created' ? 'Preset saved' : 'Preset updated');
    setPresetName('');
    setTimeout(() => setFeedback(null), 2400);
  };

  const handleApplyPreset = (id: string) => {
    onApplyPreset(id);
    setFeedback('Preset applied');
    setTimeout(() => setFeedback(null), 1800);
  };

  const handleDeletePreset = (id: string) => {
    onDeletePreset(id);
    setFeedback('Preset removed');
    setTimeout(() => setFeedback(null), 1800);
  };

  const handleApplyLocation = () => {
    setFilters((prev) => ({
      ...prev,
      state: stateDraft,
      county: countyDraft
    }));
    setFeedback('Location updated');
    setTimeout(() => setFeedback(null), 1800);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-inner shadow-slate-200/60 transition-colors dark:border-slate-800/60 dark:bg-slate-900/40 dark:shadow-none">
      <div className="flex flex-col gap-3">
        <label htmlFor="search" className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Search incidents
        </label>
        <input
          id="search"
          type="search"
          placeholder="Search by keyword or location"
          value={filters.query}
          onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
          className="w-full rounded-lg border border-slate-300/80 bg-white/70 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-500/60 focus:outline-none focus:ring focus:ring-emerald-500/30 dark:border-slate-700/60 dark:bg-slate-950/70 dark:text-slate-100"
        />
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="state-select" className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          State
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <select
            id="state-select"
            value={stateDraft}
            onChange={(event) => setStateDraft(event.target.value)}
            disabled={loadingStates && states.length === 0}
            className="w-full rounded-lg border border-slate-300/80 bg-white/70 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-500/60 focus:outline-none focus:ring focus:ring-emerald-500/30 dark:border-slate-700/60 dark:bg-slate-950/70 dark:text-slate-100"
          >
            <option value={ALL_STATE_OPTION}>Nationwide (all states)</option>
            {states.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
          <motion.button
            whileTap={{ scale: needsLocationApply ? 0.95 : 1 }}
            type="button"
            onClick={handleApplyLocation}
            disabled={!needsLocationApply}
            className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition sm:w-auto ${
              needsLocationApply
                ? 'bg-emerald-200/60 text-emerald-700 ring-1 ring-emerald-300/70 hover:bg-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-500/40 dark:hover:bg-emerald-500/30'
                : 'cursor-not-allowed bg-slate-200/70 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500'
            }`}
          >
            Search
          </motion.button>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="county-select" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
            County
          </label>
          <select
            id="county-select"
            value={countyDraft}
            onChange={(event) => setCountyDraft(event.target.value)}
            disabled={stateDraft === ALL_STATE_OPTION || loadingCounties}
            className="w-full rounded-lg border border-slate-300/80 bg-white/70 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-500/60 focus:outline-none focus:ring focus:ring-emerald-500/30 dark:border-slate-700/60 dark:bg-slate-950/70 dark:text-slate-100"
          >
            <option value={ALL_COUNTY_OPTION}>
              {stateDraft === ALL_STATE_OPTION
                ? 'All counties (nationwide)'
                : loadingCounties
                  ? 'Loading counties…'
                  : 'All counties'}
            </option>
            {availableCounties
              .filter((county) => county !== ALL_COUNTY_OPTION)
              .map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="stream-select" className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Preferred stream
        </label>
        <select
          id="stream-select"
          value={filters.stream}
          onChange={(event) => {
            const nextStream = event.target.value as StreamSource;
            setFilters((prev) => ({
              ...prev,
              stream: nextStream
            }));
            setFeedback('Stream updated');
            setTimeout(() => setFeedback(null), 1800);
          }}
          className="w-full rounded-lg border border-slate-300/80 bg-white/70 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-500/60 focus:outline-none focus:ring focus:ring-emerald-500/30 dark:border-slate-700/60 dark:bg-slate-950/70 dark:text-slate-100"
        >
          {STREAM_SOURCES.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
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
        <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={filters.heatmap}
            onChange={(event) => setFilters((prev) => ({ ...prev, heatmap: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-600 focus:ring-emerald-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-emerald-400 dark:focus:ring-emerald-500/40"
          />
          Heatmap mode
        </label>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onTogglePause}
          className={`rounded-full px-3 py-1 font-medium transition ${
            paused
              ? 'bg-amber-200/60 text-amber-700 ring-1 ring-amber-300/70 dark:bg-amber-500/20 dark:text-amber-400 dark:ring-amber-400/60'
              : 'bg-emerald-200/60 text-emerald-700 ring-1 ring-emerald-300/70 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/60'
          }`}
        >
          {paused ? 'Resume' : 'Pause'}
        </motion.button>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-slate-100/70 p-3 text-xs text-slate-600 transition-colors dark:border-slate-800/60 dark:bg-slate-950/40 dark:text-slate-300">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Saved filter presets</p>
          {feedback && <span className={`text-[11px] font-semibold ${feedbackTone}`}>{feedback}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {savedPresets.length === 0 && <span className="text-slate-500 dark:text-slate-400">No presets yet.</span>}
          {savedPresets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center gap-1 rounded-full border border-slate-300/70 bg-white/80 px-2 py-1 dark:border-slate-700/60 dark:bg-slate-900/70"
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleApplyPreset(preset.id)}
                className="text-slate-700 dark:text-slate-200"
              >
                {preset.name}
              </motion.button>
              <button
                type="button"
                onClick={() => handleDeletePreset(preset.id)}
                className="rounded-full p-1 text-slate-400 transition hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-300"
                aria-label={`Remove ${preset.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Preset name"
            className="flex-1 rounded-lg border border-slate-300/80 bg-white/70 px-3 py-2 text-slate-800 focus:border-emerald-500/60 focus:outline-none focus:ring focus:ring-emerald-500/30 dark:border-slate-700/60 dark:bg-slate-950/70 dark:text-slate-100"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSavePreset}
            className="rounded-lg bg-emerald-200/60 px-3 py-2 font-semibold text-emerald-700 ring-1 ring-emerald-300/70 transition hover:bg-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-500/40 dark:hover:bg-emerald-500/30"
          >
            Save
          </motion.button>
        </div>
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
        active
          ? TONE_STYLES[tone]
          : 'border-slate-300/80 bg-white/70 text-slate-600 hover:border-slate-400 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-slate-500'
      }`}
    >
      {label}
    </motion.button>
  );
}
