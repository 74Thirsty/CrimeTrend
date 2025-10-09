const { EventEmitter } = require('events');
const logger = require('./logger');

const DEFAULT_ENDPOINT = 'https://data.seattle.gov/resource/kzjm-xkqj.json';
const SEVERITY_MAPPINGS = [
  { pattern: /ASSAULT|SHOOT|WEAPON|FIREARM|ROBBERY|THREAT|HOMICIDE|STABBING/i, severity: 'violent' },
  { pattern: /BURGLARY|THEFT|PROWL|PROPERTY|TRESPASS|VANDAL/i, severity: 'property' },
  { pattern: /MEDICAL|AID|EMS|INJURY|OVERDOSE|RESCUE/i, severity: 'medical' }
];

const AUDIO_FEEDS = {
  default: 'https://broadcastify.cdnstream1.com/35248',
  north: 'https://broadcastify.cdnstream1.com/35568',
  south: 'https://broadcastify.cdnstream1.com/35569'
};

function determineSeverity(type, subgroup) {
  const target = `${type || ''} ${subgroup || ''}`;
  for (const { pattern, severity } of SEVERITY_MAPPINGS) {
    if (pattern.test(target)) {
      return severity;
    }
  }
  return 'other';
}

function pickAudioFeed(sector = '') {
  const lowered = sector.toLowerCase();
  if (lowered.startsWith('n')) return AUDIO_FEEDS.north;
  if (lowered.startsWith('s')) return AUDIO_FEEDS.south;
  return AUDIO_FEEDS.default;
}

function buildTimeline(record) {
  const timeline = [];
  if (record.event_received_date_time) {
    timeline.push({
      code: 'received',
      label: 'Call received',
      timestamp: record.event_received_date_time
    });
  }
  if (record.event_dispatched_date_time) {
    timeline.push({
      code: 'dispatched',
      label: 'Units dispatched',
      timestamp: record.event_dispatched_date_time
    });
  }
  if (record.event_arrival_date_time) {
    timeline.push({
      code: 'arrival',
      label: 'First unit arrived',
      timestamp: record.event_arrival_date_time
    });
  }
  if (record.event_clearance_date) {
    timeline.push({
      code: 'cleared',
      label: 'Incident cleared',
      timestamp: record.event_clearance_date
    });
  }
  return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function extractUnits(record) {
  const units = [];
  if (record.district_sector) {
    units.push({ unit_id: record.district_sector, role: 'Sector' });
  }
  if (record.zone_beat) {
    units.push({ unit_id: record.zone_beat, role: 'Beat' });
  }
  if (record.event_clearance_group) {
    units.push({ unit_id: record.event_clearance_group, role: 'Response group' });
  }
  return units;
}

function normaliseRecord(record) {
  const incidentId = record.cad_event_number || record.general_offense_number;
  if (!incidentId) {
    return null;
  }

  const location = record.incident_location || {};
  const lat = parseFloat(location.latitude || record.latitude || record.lat || '0');
  const lon = parseFloat(location.longitude || record.longitude || record.long || '0');
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const severity = determineSeverity(record.event_clearance_description, record.event_clearance_subgroup);

  return {
    incident_id: incidentId,
    call_type: record.initial_type_description || record.event_clearance_description || 'Unspecified',
    summary: record.event_clearance_description || record.initial_type_description || 'No summary available',
    location: {
      latitude: lat,
      longitude: lon,
      address: record.hundred_block_location || record.district_sector || 'Unknown address'
    },
    time_received: record.event_received_date_time || record.event_clearance_date,
    status: record.event_clearance_disposition || 'Pending',
    severity,
    subgroup: record.event_clearance_subgroup || 'Uncategorised',
    units: extractUnits(record),
    timeline: buildTimeline(record),
    audio: {
      stream_url: pickAudioFeed(record.district_sector || ''),
      transcript_url: null,
      transcript: []
    },
    updated_at: new Date().toISOString()
  };
}

class IncidentService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      endpoint: options.endpoint || process.env.DATA_ENDPOINT || DEFAULT_ENDPOINT,
      limit: options.limit ?? 200,
      lookbackMinutes: options.lookbackMinutes ?? 120,
      refreshIntervalMs: options.refreshIntervalMs ?? 15000,
      appToken: options.appToken || process.env.SOCRATA_APP_TOKEN || null
    };
    this.incidents = new Map();
    this.interval = null;
  }

  start() {
    if (this.interval) return;
    this.poll().catch((error) => {
      logger.error('initial poll failure', { error: error.message });
    });
    this.interval = setInterval(() => {
      this.poll().catch((error) => {
        logger.error('poll failure', { error: error.message });
      });
    }, this.options.refreshIntervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getSnapshot() {
    return Array.from(this.incidents.values()).sort((a, b) => {
      return new Date(b.time_received).getTime() - new Date(a.time_received).getTime();
    });
  }

  async poll() {
    const now = new Date();
    const since = new Date(now.getTime() - this.options.lookbackMinutes * 60000);
    const params = new URLSearchParams();
    params.set('$limit', String(this.options.limit));
    params.set('$order', 'event_received_date_time DESC');
    params.set('$where', `event_received_date_time >= '${since.toISOString()}'`);

    const url = `${this.options.endpoint}?${params.toString()}`;
    const headers = { 'Accept': 'application/json' };
    if (this.options.appToken) {
      headers['X-App-Token'] = this.options.appToken;
    }

    logger.info('fetching incidents', { url });

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to fetch incidents: ${response.status} ${body}`);
    }

    const payload = await response.json();
    const newIncidents = new Map();
    for (const record of payload) {
      const normalised = normaliseRecord(record);
      if (!normalised) continue;
      normalised.updated_at = new Date().toISOString();
      const timeline = normalised.timeline;
      if (timeline.length > 0) {
        normalised.latest_update = timeline[timeline.length - 1];
      } else {
        normalised.latest_update = { code: 'received', label: 'Call received', timestamp: normalised.time_received };
      }
      newIncidents.set(normalised.incident_id, normalised);
    }

    this.incidents = newIncidents;
    this.emit('update', this.getSnapshot());
  }
}

module.exports = IncidentService;
