import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LiveFeed } from './components/LiveFeed';
import { MapView } from './components/MapView';
import { Trends } from './components/Trends';
import { Filters, FilterState } from './components/Filters';
import { useIncidentStream } from './hooks/useIncidentStream';
import { HotZoneAlerts } from './components/HotZoneAlerts';
import { LayoutShell } from './components/LayoutShell';

function App() {
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    categories: new Set(),
    severities: new Set(),
    timeframe: '24h',
    heatmap: false
  });
  const { incidents, stats, togglePause, paused, hotZones } = useIncidentStream(filters);

  return (
    <LayoutShell
      onToggleTheme={() => document.documentElement.classList.toggle('dark')}
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
          <Trends incidents={incidents} stats={stats} timeframe={filters.timeframe} />
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
            <Filters filters={filters} setFilters={setFilters} onTogglePause={togglePause} paused={paused} />
            <LiveFeed incidents={incidents} filters={filters} paused={paused} />
          </motion.div>
        </AnimatePresence>
      </div>
    </LayoutShell>
  );
}

export default App;
