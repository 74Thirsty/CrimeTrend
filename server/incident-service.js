const { EventEmitter } = require('events');
const logger = require('./logger');

const DEFAULT_ENDPOINT = 'https://data.seattle.gov/resource/kzjm-xkqj.json';
const DEFAULT_FALLBACK_STATE = 'IA';

const STATE_NAME_TO_CODE = {
  ALABAMA: 'AL',
  ALASKA: 'AK',
  ARIZONA: 'AZ',
  ARKANSAS: 'AR',
  CALIFORNIA: 'CA',
  COLORADO: 'CO',
  CONNECTICUT: 'CT',
  DELAWARE: 'DE',
  FLORIDA: 'FL',
  GEORGIA: 'GA',
  HAWAII: 'HI',
  IDAHO: 'ID',
  ILLINOIS: 'IL',
  INDIANA: 'IN',
  IOWA: 'IA',
  KANSAS: 'KS',
  KENTUCKY: 'KY',
  LOUISIANA: 'LA',
  MAINE: 'ME',
  MARYLAND: 'MD',
  MASSACHUSETTS: 'MA',
  MICHIGAN: 'MI',
  MINNESOTA: 'MN',
  MISSISSIPPI: 'MS',
  MISSOURI: 'MO',
  MONTANA: 'MT',
  NEBRASKA: 'NE',
  NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM',
  'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND',
  OHIO: 'OH',
  OKLAHOMA: 'OK',
  OREGON: 'OR',
  PENNSYLVANIA: 'PA',
  'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD',
  TENNESSEE: 'TN',
  TEXAS: 'TX',
  UTAH: 'UT',
  VERMONT: 'VT',
  VIRGINIA: 'VA',
  WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI',
  WYOMING: 'WY',
  'DISTRICT OF COLUMBIA': 'DC',
  'WASHINGTON DC': 'DC',
  'WASHINGTON D C': 'DC',
  'WASHINGTON D.C': 'DC',
  'WASHINGTON, D.C': 'DC',
  'WASHINGTON, D.C.': 'DC',
  'WASHINGTON, DC': 'DC',
  'WASHINGTON D.C.': 'DC',
  'D.C': 'DC',
  'D.C.': 'DC',
  'PUERTO RICO': 'PR',
  'NORTHERN MARIANA ISLANDS': 'MP',
  'AMERICAN SAMOA': 'AS',
  GUAM: 'GU',
  'UNITED STATES VIRGIN ISLANDS': 'VI',
  'U.S. VIRGIN ISLANDS': 'VI',
  'US VIRGIN ISLANDS': 'VI',
  'VIRGIN ISLANDS': 'VI'
};

const STATE_CODE_SET = new Set(Object.values(STATE_NAME_TO_CODE));
STATE_CODE_SET.add('DC');
STATE_CODE_SET.add('PR');
STATE_CODE_SET.add('MP');
STATE_CODE_SET.add('AS');
STATE_CODE_SET.add('GU');
STATE_CODE_SET.add('VI');

const STATE_SEPARATOR_REGEX = /[\/,;|-]/;

function normaliseStateValue(value) {
  if (!value) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  const collapsed = trimmed.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  if (collapsed.length === 2 && STATE_CODE_SET.has(collapsed)) {
    return collapsed;
  }

  const withoutDecorators = collapsed.replace(/^STATE OF\s+/, '').replace(/\s+STATE$/, '');
  if (withoutDecorators.length === 2 && STATE_CODE_SET.has(withoutDecorators)) {
    return withoutDecorators;
  }

  const mapped =
    STATE_NAME_TO_CODE[withoutDecorators] ||
    STATE_NAME_TO_CODE[collapsed] ||
    STATE_NAME_TO_CODE[withoutDecorators.replace(/\s+/g, ' ')];
  if (mapped) {
    return mapped;
  }

  if (STATE_SEPARATOR_REGEX.test(withoutDecorators)) {
    const parts = withoutDecorators
      .split(STATE_SEPARATOR_REGEX)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      for (const part of parts) {
        const code = normaliseStateValue(part);
        if (code) {
          return code;
        }
      }
    }
  }

  return null;
}

function resolveState(record, fallbackState) {
  const location = record.incident_location || {};
  const candidates = [
    location.state,
    location.state_code,
    location.state_abbr,
    location.state_name,
    record.state,
    record.state_code,
    record.state_abbr,
    record.state_name,
    record.jurisdiction_state,
    record.geo_state,
    record.us_state,
    record.jurisdiction,
    location.address,
    record.hundred_block_location
  ];

  for (const candidate of candidates) {
    const code = normaliseStateValue(candidate);
    if (code) {
      return code;
    }
  }

  const fallbackCode = normaliseStateValue(fallbackState || DEFAULT_FALLBACK_STATE);
  return fallbackCode;
}
const PRIMARY_TIME_FIELDS = [
  'event_received_date_time',
  'event_dispatched_date_time',
  'event_arrival_date_time',
  'event_clearance_date',
  'datetime'
];
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
    incident.location?.state || '',
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

function normaliseRecord(record, fallbackState) {
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

  const stateCode = resolveState(record, fallbackState);

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
      address: record.hundred_block_location || record.district_sector || 'Unknown address',
      state: stateCode
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
    state: stateCode,
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
      appToken: options.appToken || process.env.SOCRATA_APP_TOKEN || null,
      defaultState:
        normaliseStateValue(options.defaultState || process.env.DEFAULT_STATE) ||
        normaliseStateValue(DEFAULT_FALLBACK_STATE)
    };
    this.incidents = new Map();
    this.interval = null;
    this.signatures = new Map();
    this.primaryTimeField = this.resolveInitialTimeField(options.primaryTimeField);
  }

  resolveInitialTimeField(explicitField) {
    if (explicitField && PRIMARY_TIME_FIELDS.includes(explicitField)) {
      return explicitField;
    }
    if (explicitField) {
      logger.warn('unknown primary time field provided, falling back to defaults', {
        field: explicitField
      });
    }
    return PRIMARY_TIME_FIELDS[0];
  }

  advanceTimeField(currentField) {
    const currentIndex = PRIMARY_TIME_FIELDS.indexOf(currentField);
    if (currentIndex === -1 || currentIndex === PRIMARY_TIME_FIELDS.length - 1) {
      return null;
    }
    return PRIMARY_TIME_FIELDS[currentIndex + 1];
  }

  detectMissingColumn(body, columnName) {
    if (!body || !columnName) return false;
    try {
      const parsed = JSON.parse(body);
      if (parsed?.errorCode === 'query.soql.no-such-column') {
        return parsed?.data?.column === columnName;
      }
    } catch (_) {
      // Body wasn't JSON – fall through to string matching below.
    }
    return body.includes('No such column') && body.includes(columnName);
  }

  detectIncompatibleColumn(body, columnName) {
    if (!body || !columnName) return false;
    try {
      const parsed = JSON.parse(body);
      if (parsed?.errorCode === 'query.soql.type-mismatch') {
        const positionLine = parsed?.data?.position?.line || '';
        const serializedColumn = `\`${columnName}\``;
        if (positionLine.includes(serializedColumn)) {
          return true;
        }
        const message = parsed?.message || '';
        if (message.includes(serializedColumn)) {
          return true;
        }
      }
    } catch (_) {
      // Body wasn't JSON – fall through to string matching below.
    }
    return (
      body.includes('query.soql.type-mismatch') &&
      body.includes(columnName) &&
      body.includes('Type mismatch')
    );
  }

  async fetchIncidents(primaryTimeField, since) {
    const params = new URLSearchParams();
    params.set('$limit', String(this.options.limit));
    params.set('$order', `${primaryTimeField} DESC`);
    const sinceIso = since.toISOString();
    params.set('$where', `${primaryTimeField} >= datetime '${sinceIso}'`);

    const url = `${this.options.endpoint}?${params.toString()}`;
    const headers = { Accept: 'application/json' };
    if (this.options.appToken) {
      headers['X-App-Token'] = this.options.appToken;
    }

    logger.info('fetching incidents', { url });

    const response = await fetch(url, { headers });
    const body = await response.text();
    if (!response.ok) {
      const missingColumn =
        response.status === 400 &&
        (this.detectMissingColumn(body, primaryTimeField) ||
          this.detectIncompatibleColumn(body, primaryTimeField));
      const error = new Error(`Failed to fetch incidents: ${response.status} ${body}`);
      error.missingColumn = missingColumn;
      throw error;
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      throw new Error('Unexpected response shape from data feed');
    }
    if (!Array.isArray(payload)) {
      throw new Error('Unexpected response shape from data feed');
    }
    return payload;
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
    let primaryTimeField = this.primaryTimeField;
    const attempted = new Set();
    let payload;
    while (primaryTimeField) {
      try {
        payload = await this.fetchIncidents(primaryTimeField, since);
        this.primaryTimeField = primaryTimeField;
        break;
      } catch (error) {
        if (error.missingColumn) {
          attempted.add(primaryTimeField);
          const nextField = this.advanceTimeField(primaryTimeField);
          if (!nextField || attempted.has(nextField)) {
            throw new Error(
              `Failed to fetch incidents: unsupported primary time field ${primaryTimeField}`
            );
          }
          logger.warn('primary time field missing, falling back', {
            previous: primaryTimeField,
            next: nextField
          });
          primaryTimeField = nextField;
          continue;
        }
        throw error;
      }
    }

    if (!payload) {
      throw new Error('Failed to fetch incidents: unable to determine a valid time field');
    }
    const fetchedAt = new Date().toISOString();
    const newIncidents = new Map();
    const newSignatures = new Map();
    let changed = false;
    for (const record of payload) {
      const normalised = normaliseRecord(record, this.options.defaultState);
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
