import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ALL_STATE_OPTION, US_STATES } from '../constants/states';
import { ALL_COUNTY_OPTION, getCountiesForState } from '../constants/counties';
import { STREAM_SOURCES, StreamSource } from '../constants/streams';

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
  violent: 'border-transparent bg-gradient-to-r from-violent/40 to-violent/20 text-white',
  property: 'border-transparent bg-gradient-to-r from-property/40 to-property/20 text-slate-100',
  traffic: 'border-transparent bg-gradient-to-r from-traffic/40 to-traffic/20 text-slate-100',
  other: 'border-transparent bg-gradient-to-r from-other/40 to-other/20 text-slate-100',
  neutral: 'border-transparent bg-gradient-to-r from-slate-700/60 to-slate-600/40 text-slate-200'
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
  const feedbackTone = useMemo(() => {
    if (!feedback) return '';
    return feedback.includes('updated') ? 'text-amber-300' : 'text-emerald-300';
  }, [feedback]);

  useEffect(() => {
    setStateDraft(filters.state);
    setCountyDraft(filters.county);
  }, [filters.state, filters.county]);

  useEffect(() => {
    const counties = getCountiesForState(stateDraft);
    if (countyDraft !== ALL_COUNTY_OPTION && !counties.includes(countyDraft)) {
      setCountyDraft(ALL_COUNTY_OPTION);
    }
  }, [stateDraft, countyDraft]);

  const availableCounties = useMemo(() => {
    const counties = getCountiesForState(stateDraft);
    return [ALL_COUNTY_OPTION, ...counties];
  }, [stateDraft]);

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

      <div className="flex flex-col gap-3">
        <label htmlFor="state-select" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          State
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <select
            id="state-select"
            value={stateDraft}
            onChange={(event) => setStateDraft(event.target.value)}
            className="w-full rounded-lg border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-emerald-400/80 focus:outline-none focus:ring focus:ring-emerald-500/30"
          >
            <option value={ALL_STATE_OPTION}>Nationwide (all states)</option>
            {US_STATES.map((state) => (
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
                ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30'
                : 'cursor-not-allowed bg-slate-800/50 text-slate-500'
            }`}
          >
            Search
          </motion.button>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="county-select" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            County
          </label>
          <select
            id="county-select"
            value={countyDraft}
            onChange={(event) => setCountyDraft(event.target.value)}
            className="w-full rounded-lg border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-emerald-400/80 focus:outline-none focus:ring focus:ring-emerald-500/30"
          >
            <option value={ALL_COUNTY_OPTION}>
              {stateDraft === ALL_STATE_OPTION ? 'All counties (nationwide)' : 'All counties'}
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
        <label htmlFor="stream-select" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
          className="w-full rounded-lg border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-emerald-400/80 focus:outline-none focus:ring focus:ring-emerald-500/30"
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

      <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Saved filter presets</p>
          {feedback && <span className={`text-[11px] font-semibold ${feedbackTone}`}>{feedback}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {savedPresets.length === 0 && <span className="text-slate-500">No presets yet.</span>}
          {savedPresets.map((preset) => (
            <div key={preset.id} className="flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-900/70 px-2 py-1">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleApplyPreset(preset.id)}
                className="text-slate-200"
              >
                {preset.name}
              </motion.button>
              <button
                type="button"
                onClick={() => handleDeletePreset(preset.id)}
                className="rounded-full p-1 text-slate-500 transition hover:text-rose-300"
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
            className="flex-1 rounded-lg border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-slate-100 focus:border-emerald-400/80 focus:outline-none focus:ring focus:ring-emerald-500/30"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSavePreset}
            className="rounded-lg bg-emerald-500/20 px-3 py-2 font-semibold text-emerald-200 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/30"
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
        active ? TONE_STYLES[tone] : 'border-slate-700/60 bg-slate-900/50 text-slate-300 hover:border-slate-500'
      }`}
    >
      {label}
    </motion.button>
  );
}
