const { EventEmitter } = require('events');
const logger = require('./logger');

const DEFAULT_ENDPOINT = 'https://data.seattle.gov/resource/kzjm-xkqj.json';
const SEVERITY_MAPPINGS = [
  { pattern: /ASSAULT|SHOOT|WEAPON|FIREARM|ROBBERY|THREAT|HOMICIDE|STABBING/i, severity: 'violent' },
  { pattern: /BURGLARY|THEFT|PROWL|PROPERTY|TRESPASS|VANDAL/i, severity: 'property' },
  { pattern: /MEDICAL|AID|EMS|INJURY|OVERDOSE|RESCUE/i, severity: 'medical' }
];

const SOURCE_NAME = 'Seattle Police Department CAD (Socrata)';

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

function safeTimestamp(value) {
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }
  return value || null;
}

function buildIncidentSignature(incident) {
  const timelineFingerprint = (incident.timeline || [])
    .map((step) => `${step.code || ''}:${safeTimestamp(step.timestamp) || ''}`)
    .join('|');
  const unitsFingerprint = (incident.units || [])
    .map((unit) => `${unit.role || ''}:${unit.unit_id || ''}`)
    .join('|');
  return [
    incident.status || '',
    incident.summary || '',
    incident.severity || '',
    incident.subgroup || '',
    timelineFingerprint,
    unitsFingerprint,
    incident.confidence ?? ''
  ].join('||');
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
  const timeline = buildTimeline(record);

  const confidence = calculateConfidence(record, severity, timeline);

  return {
    incident_id: incidentId,
    call_type: record.initial_type_description || record.event_clearance_description || 'Unspecified',
    summary: record.event_clearance_description || record.initial_type_description || 'No summary available',
    location: {
      latitude: lat,
      longitude: lon,
      address: record.hundred_block_location || record.district_sector || 'Unknown address'
    },
    time_received: record.event_received_date_time || record.event_clearance_date || record.datetime,
    status: record.event_clearance_disposition || 'Pending',
    severity,
    subgroup: record.event_clearance_subgroup || 'Uncategorised',
    units: extractUnits(record),
    timeline,
    audio: {
      stream_url: pickAudioFeed(record.district_sector || ''),
      transcript_url: null,
      transcript: []
    },
    updated_at: null,
    confidence,
    source: {
      name: SOURCE_NAME,
      feed: null,
      sector: record.district_sector || null
    }
  };
}

function calculateConfidence(record, severity, timeline) {
  let score = 55;

  if (severity === 'violent') {
    score += 12;
  } else if (severity === 'medical') {
    score += 8;
  } else if (severity === 'property') {
    score += 6;
  }

  if (Array.isArray(timeline) && timeline.length > 0) {
    score += 6;
    if (timeline.length >= 2) score += 4;
    if (timeline.length >= 3) score += 3;
  }

  if (record.event_clearance_disposition && record.event_clearance_disposition !== 'Pending') {
    score += 8;
  }

  if (record.event_clearance_group) {
    score += 4;
  }

  if (record.event_clearance_code) {
    score += 3;
  }

  return Math.max(40, Math.min(95, Math.round(score)));
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
    this.signatures = new Map();
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
    const primaryTimeField = 'event_received_date_time';
    params.set('$order', `${primaryTimeField} DESC`);
    params.set('$where', `${primaryTimeField} >= '${since.toISOString()}'`);

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
    if (!Array.isArray(payload)) {
      throw new Error('Unexpected response shape from data feed');
    }
    const fetchedAt = new Date().toISOString();
    const newIncidents = new Map();
    const newSignatures = new Map();
    let changed = false;
    for (const record of payload) {
      const normalised = normaliseRecord(record);
      if (!normalised) continue;
      normalised.source.feed = this.options.endpoint;
      const previous = this.incidents.get(normalised.incident_id);
      const previousSignature = this.signatures.get(normalised.incident_id);
      normalised.ingested_at = previous?.ingested_at || fetchedAt;
      normalised.provenance = {
        feed: this.options.endpoint,
        fetched_at: fetchedAt,
        lookback_minutes: this.options.lookbackMinutes,
        limit: this.options.limit
      };
      const timeline = normalised.timeline;
      if (timeline.length > 0) {
        normalised.latest_update = timeline[timeline.length - 1];
      } else {
        normalised.latest_update = { code: 'received', label: 'Call received', timestamp: normalised.time_received };
      }
      normalised.updated_at = normalised.latest_update?.timestamp || normalised.time_received;
      const signature = buildIncidentSignature(normalised);
      newSignatures.set(normalised.incident_id, signature);
      if (previous && previousSignature === signature) {
        normalised.updated_at = previous.updated_at;
        normalised.confidence_updated_at = previous.confidence_updated_at || fetchedAt;
        normalised.latest_update = previous.latest_update;
      } else {
        normalised.confidence_updated_at = fetchedAt;
        if (!previous || previousSignature !== signature) {
          changed = true;
        }
      }
      newIncidents.set(normalised.incident_id, normalised);
    }

    if (this.incidents.size !== newIncidents.size) {
      changed = true;
    }

    this.incidents = newIncidents;
    this.signatures = newSignatures;

    if (changed) {
      this.emit('update', this.getSnapshot());
    }
  }
}

module.exports = IncidentService;
