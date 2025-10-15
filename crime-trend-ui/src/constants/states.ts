export interface StateInfo {
  code: string;
  name: string;
  aliases?: string[];
}

export const US_STATES: readonly StateInfo[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  {
    code: 'DC',
    name: 'District of Columbia',
    aliases: ['Washington DC', 'Washington D C', 'Washington D.C', 'Washington, D.C.', 'Washington, DC', 'D.C.', 'D.C']
  },
  { code: 'PR', name: 'Puerto Rico', aliases: ['Commonwealth of Puerto Rico'] },
  { code: 'GU', name: 'Guam' },
  { code: 'VI', name: 'U.S. Virgin Islands', aliases: ['United States Virgin Islands', 'Virgin Islands'] },
  { code: 'AS', name: 'American Samoa' },
  { code: 'MP', name: 'Northern Mariana Islands', aliases: ['CNMI'] }
];

export const US_STATE_CODES = new Set(US_STATES.map((state) => state.code));

const STATE_NAME_LOOKUP = new Map<string, string>();
for (const state of US_STATES) {
  STATE_NAME_LOOKUP.set(state.name.toUpperCase(), state.code);
  if (state.aliases) {
    for (const alias of state.aliases) {
      STATE_NAME_LOOKUP.set(alias.toUpperCase(), state.code);
    }
  }
}

const STATE_SEPARATOR_REGEX = /[\/,;|-]/;

export function normaliseStateCode(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const raw = String(value).trim();
  if (!raw) {
    return null;
  }
  const collapsed = raw.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  if (US_STATE_CODES.has(collapsed)) {
    return collapsed;
  }

  const withoutDecorators = collapsed.replace(/^STATE OF\s+/, '').replace(/\s+STATE$/, '');
  if (US_STATE_CODES.has(withoutDecorators)) {
    return withoutDecorators;
  }

  const mapped =
    STATE_NAME_LOOKUP.get(withoutDecorators) ||
    STATE_NAME_LOOKUP.get(collapsed) ||
    STATE_NAME_LOOKUP.get(withoutDecorators.replace(/\s+/g, ' '));
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
        const code = normaliseStateCode(part);
        if (code) {
          return code;
        }
      }
    }
  }

  return null;
}

export const ALL_STATE_OPTION = 'ALL';

export function isValidStateFilter(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  if (value === ALL_STATE_OPTION) {
    return true;
  }
  return US_STATE_CODES.has(value.toUpperCase());
}

