import { motion, AnimatePresence } from 'framer-motion';
import type { HotZone } from '../hooks/useIncidentStream';

interface HotZoneAlertsProps {
  hotZones: HotZone[];
}

export function HotZoneAlerts({ hotZones }: HotZoneAlertsProps) {
  if (hotZones.length === 0) {
    return null;
  }

  const topZones = hotZones.slice(0, 3);

  return (
    <AnimatePresence>
      <motion.div
        key="hotzones"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="overflow-hidden rounded-3xl border border-rose-500/40 bg-rose-500/10 shadow-lg"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-rose-200">Hot zone alert</p>
            <p className="text-xs text-rose-100/80">
              Elevated activity detected in {topZones.length} area{topZones.length > 1 ? 's' : ''}. Monitor closely.
            </p>
          </div>
          <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 ring-1 ring-rose-400/40">
            {hotZones.reduce((sum, zone) => sum + zone.count, 0)} incidents
          </span>
        </div>
        <div className="grid gap-4 px-5 pb-5 md:grid-cols-3">
          {topZones.map((zone) => (
            <div key={zone.id} className="rounded-2xl bg-slate-950/60 p-4 text-xs text-rose-100/90">
              <p className="text-sm font-semibold text-rose-200">Lat {zone.center.lat.toFixed(2)}, Lng {zone.center.lng.toFixed(2)}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-rose-100/60">{zone.count} incidents</p>
              <ul className="mt-2 space-y-1 text-[11px]">
                {Object.entries(zone.categories)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, value]) => (
                    <li key={category} className="flex items-center justify-between text-rose-100/70">
                      <span>{category}</span>
                      <span className="font-semibold text-rose-100">{value}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
