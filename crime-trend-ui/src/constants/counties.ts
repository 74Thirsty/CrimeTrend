import { ALL_STATE_OPTION } from './states';

export const ALL_COUNTY_OPTION = 'ALL_COUNTIES';

type CountyMap = Record<string, readonly string[]>;

const COUNTY_DATA: CountyMap = {
  AL: ['Autauga County', 'Jefferson County', 'Mobile County'],
  AK: ['Anchorage Municipality', 'Matanuska-Susitna Borough', 'Fairbanks North Star Borough'],
  AZ: ['Maricopa County', 'Pima County', 'Yavapai County'],
  CA: ['Los Angeles County', 'San Diego County', 'Orange County', 'San Francisco County'],
  CO: ['Denver County', 'El Paso County', 'Arapahoe County'],
  FL: ['Miami-Dade County', 'Broward County', 'Orange County'],
  GA: ['Fulton County', 'DeKalb County', 'Cobb County'],
  IL: ['Cook County', 'DuPage County', 'Lake County'],
  MA: ['Suffolk County', 'Middlesex County', 'Worcester County'],
  MD: ['Baltimore County', 'Montgomery County', 'Prince George\'s County'],
  MI: ['Wayne County', 'Oakland County', 'Macomb County'],
  MN: ['Hennepin County', 'Ramsey County', 'Dakota County'],
  NC: ['Mecklenburg County', 'Wake County', 'Guilford County'],
  NJ: ['Essex County', 'Bergen County', 'Hudson County'],
  NV: ['Clark County', 'Washoe County', 'Carson City'],
  NY: ['New York County', 'Kings County', 'Queens County', 'Bronx County', 'Richmond County'],
  OH: ['Franklin County', 'Cuyahoga County', 'Hamilton County'],
  OR: ['Multnomah County', 'Washington County', 'Lane County'],
  PA: ['Philadelphia County', 'Allegheny County', 'Montgomery County'],
  TN: ['Shelby County', 'Davidson County', 'Knox County'],
  TX: ['Harris County', 'Dallas County', 'Tarrant County', 'Bexar County', 'Travis County'],
  VA: ['Fairfax County', 'Arlington County', 'Henrico County'],
  WA: ['King County', 'Pierce County', 'Snohomish County'],
  WI: ['Milwaukee County', 'Dane County', 'Waukesha County']
};

export function getCountiesForState(stateCode: string | typeof ALL_STATE_OPTION): readonly string[] {
  if (!stateCode || stateCode === ALL_STATE_OPTION) {
    return [];
  }
  const upper = stateCode.toUpperCase();
  return COUNTY_DATA[upper] ?? [];
}

export function isValidCountySelection(stateCode: string, county: unknown): county is string {
  if (typeof county !== 'string' || county.length === 0) {
    return false;
  }
  if (county === ALL_COUNTY_OPTION) {
    return true;
  }
  if (stateCode === ALL_STATE_OPTION) {
    return county === ALL_COUNTY_OPTION;
  }
  const upper = stateCode.toUpperCase();
  const counties = COUNTY_DATA[upper];
  if (!counties || counties.length === 0) {
    return true;
  }
  return counties.includes(county);
}

export function normaliseCountySelection(stateCode: string, county: unknown): string {
  return isValidCountySelection(stateCode, county) ? (county as string) : ALL_COUNTY_OPTION;
}
