import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LiveFeed } from './components/LiveFeed';
import { MapView } from './components/MapView';
import { Trends } from './components/Trends';
import { Filters, FilterState, SavedFilterPreset, SavePresetResult, Category, Severity, Timeframe } from './components/Filters';
import { useIncidentStream } from './hooks/useIncidentStream';
import { HotZoneAlerts } from './components/HotZoneAlerts';
import { LayoutShell } from './components/LayoutShell';
import { ALL_STATE_OPTION, isValidStateFilter } from './constants/states';
import { ALL_COUNTY_OPTION, normaliseCountySelection } from './constants/counties';
import { DEFAULT_STREAM_SOURCE, isValidStreamSource } from './constants/streams';

const PRESET_STORAGE_KEY = 'crime-trend-filter-presets-v2';
const THEME_STORAGE_KEY = 'crime-trend-theme';
const CATEGORY_VALUES: readonly Category[] = ['violent', 'property', 'traffic', 'other'] as const;
const SEVERITY_VALUES: readonly Severity[] = ['low', 'medium', 'high', 'critical'] as const;
const TIMEFRAME_VALUES: readonly Timeframe[] = ['1h', '24h', '7d'] as const;
type SerializableFilters = SavedFilterPreset['filters'];

function createPresetId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitisePreset(candidate: unknown): SavedFilterPreset | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const raw = candidate as Partial<SavedFilterPreset> & { filters?: Partial<SerializableFilters> };
  if (typeof raw.name !== 'string' || raw.name.trim().length === 0) {
    return null;
  }

  const filters: Partial<SerializableFilters> = raw.filters ?? {};
  const query = typeof filters.query === 'string' ? filters.query : '';
  const categories = Array.isArray(filters.categories)
    ? filters.categories.filter((value): value is Category => CATEGORY_VALUES.includes(value))
    : [];
  const severities = Array.isArray(filters.severities)
    ? filters.severities.filter((value): value is Severity => SEVERITY_VALUES.includes(value))
    : [];
  const timeframe = filters.timeframe && TIMEFRAME_VALUES.includes(filters.timeframe) ? filters.timeframe : '24h';
  const heatmap = typeof filters.heatmap === 'boolean' ? filters.heatmap : false;
  const state = isValidStateFilter(filters.state) ? filters.state : ALL_STATE_OPTION;
  const county = normaliseCountySelection(state, filters.county);
  const stream = isValidStreamSource(filters.stream) ? filters.stream : DEFAULT_STREAM_SOURCE;

  return {
    id: typeof raw.id === 'string' ? raw.id : createPresetId(),
    name: raw.name.trim(),
    filters: {
      query,
      categories,
      severities,
      timeframe,
      heatmap,
      state,
      county,
      stream
    }
  };
}

function App() {
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    categories: new Set(),
    severities: new Set(),
    timeframe: '24h',
    heatmap: false,
    state: 'IA',
    county: ALL_COUNTY_OPTION,
    stream: DEFAULT_STREAM_SOURCE
  });
  const [savedPresets, setSavedPresets] = useState<SavedFilterPreset[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const stored = window.localStorage.getItem(PRESET_STORAGE_KEY);
      if (!stored) {
        return [];
      }
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((item) => sanitisePreset(item))
        .filter((item): item is SavedFilterPreset => Boolean(item))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Failed to load saved filter presets', error);
      return [];
    }
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light') {
      return false;
    }
    if (stored === 'dark') {
      return true;
    }
    const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark;
  });

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
  }, [isDarkMode]);

  const { incidents, stats, togglePause, paused, hotZones } = useIncidentStream(filters);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(savedPresets));
  }, [savedPresets]);

  const toSerializableFilters = useCallback(
    (state: FilterState) => ({
      query: state.query,
      categories: Array.from(state.categories) as Category[],
      severities: Array.from(state.severities) as Severity[],
      timeframe: state.timeframe,
      heatmap: state.heatmap,
      state: state.state,
      county: state.county,
      stream: state.stream
    }),
    []
  );

  const handleSavePreset = useCallback(
    (name: string): SavePresetResult => {
      const trimmed = name.trim();
      if (!trimmed) {
        return 'skipped';
      }

      const serialised = toSerializableFilters(filters);
      let result: SavePresetResult = 'created';
      setSavedPresets((prev) => {
        const existingIndex = prev.findIndex((preset) => preset.name.toLowerCase() === trimmed.toLowerCase());
        if (existingIndex >= 0) {
          result = 'updated';
          const next = [...prev];
          next[existingIndex] = { ...next[existingIndex], filters: serialised };
          return next;
        }
        return [...prev, { id: createPresetId(), name: trimmed, filters: serialised }].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });
      return result;
    },
    [filters, toSerializableFilters]
  );

  const handleApplyPreset = useCallback(
    (id: string) => {
      const preset = savedPresets.find((item) => item.id === id);
      if (!preset) {
        return;
      }
      setFilters({
        query: preset.filters.query,
        categories: new Set(preset.filters.categories),
        severities: new Set(preset.filters.severities),
        timeframe: preset.filters.timeframe,
        heatmap: preset.filters.heatmap,
        state: preset.filters.state,
        county: normaliseCountySelection(preset.filters.state, preset.filters.county),
        stream: isValidStreamSource(preset.filters.stream) ? preset.filters.stream : DEFAULT_STREAM_SOURCE
      });
    },
    [savedPresets]
  );

  const handleDeletePreset = useCallback((id: string) => {
    setSavedPresets((prev) => prev.filter((preset) => preset.id !== id));
  }, []);

  return (
    <LayoutShell
      onToggleTheme={() => setIsDarkMode((prev) => !prev)}
      isDarkMode={isDarkMode}
      filters={filters}
      setFilters={setFilters}
      paused={paused}
      onTogglePause={togglePause}
      stats={stats}
    >
      <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-6">
          <HotZoneAlerts hotZones={hotZones} />
          <MapView incidents={incidents} filters={filters} hotZones={hotZones} />
          <Trends incidents={incidents} stats={stats} timeframe={filters.timeframe} isDarkMode={isDarkMode} />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={paused ? 'paused' : 'active'}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.3 }}
          className="flex max-h-screen flex-col gap-4 overflow-hidden rounded-2xl bg-slate-900/60 p-4 shadow-lg ring-1 ring-slate-700/60 backdrop-blur"
        >
          <Filters
            filters={filters}
            setFilters={setFilters}
            onTogglePause={togglePause}
            paused={paused}
            savedPresets={savedPresets}
            onSavePreset={handleSavePreset}
            onApplyPreset={handleApplyPreset}
            onDeletePreset={handleDeletePreset}
          />
          <LiveFeed incidents={incidents} filters={filters} paused={paused} />
        </motion.div>
      </AnimatePresence>
    </div>
  </LayoutShell>
  );
}

export default App;
