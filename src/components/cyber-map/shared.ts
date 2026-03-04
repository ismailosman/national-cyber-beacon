import type { AttackType, LiveThreat } from '@/hooks/useLiveAttacks';

// ── Country ISO codes for flag CDN ────────────────────────────────────────────

export const COUNTRY_ISO: Record<string, string> = {
  'China': 'cn', 'Russia': 'ru', 'Iran': 'ir', 'North Korea': 'kp',
  'USA': 'us', 'Netherlands': 'nl', 'Germany': 'de', 'Ukraine': 'ua',
  'Brazil': 'br', 'India': 'in', 'Nigeria': 'ng', 'Pakistan': 'pk',
  'Vietnam': 'vn', 'Romania': 'ro', 'Turkey': 'tr', 'South Korea': 'kr',
  'Indonesia': 'id', 'France': 'fr', 'UK': 'gb', 'Saudi Arabia': 'sa',
  'Egypt': 'eg', 'Singapore': 'sg', 'Canada': 'ca', 'Japan': 'jp',
  'Israel': 'il', 'Somalia': 'so', 'Kenya': 'ke', 'Ethiopia': 'et',
  'Djibouti': 'dj', 'Tanzania': 'tz', 'South Sudan': 'ss',
  'Sudan': 'sd', 'Uganda': 'ug', 'Rwanda': 'rw', 'South Africa': 'za',
  'Tunisia': 'tn', 'Libya': 'ly', 'Cameroon': 'cm', 'Qatar': 'qa',
  'Morocco': 'ma', 'DR Congo': 'cd', 'Senegal': 'sn', 'Mozambique': 'mz',
  'Angola': 'ao', 'Algeria': 'dz', 'Ghana': 'gh',
  'Belgium': 'be', 'Spain': 'es', 'Italy': 'it', 'Sweden': 'se',
  'Argentina': 'ar', 'Colombia': 'co', 'Chile': 'cl', 'Venezuela': 've',
  'Bolivia': 'bo', 'Paraguay': 'py', 'Mexico': 'mx', 'Peru': 'pe',
  'Uruguay': 'uy', 'Ecuador': 'ec', 'Cuba': 'cu', 'Jamaica': 'jm',
  'Haiti': 'ht', 'Dominican Republic': 'do', 'Honduras': 'hn',
  'Guatemala': 'gt', 'Costa Rica': 'cr', 'Panama': 'pa',
  'Nicaragua': 'ni', 'El Salvador': 'sv', 'Trinidad and Tobago': 'tt',
  'Afghanistan': 'af', 'Iraq': 'iq', 'Syria': 'sy', 'Yemen': 'ye',
  'Jordan': 'jo', 'Lebanon': 'lb', 'Oman': 'om', 'UAE': 'ae',
  'Kuwait': 'kw', 'Bahrain': 'bh', 'Kazakhstan': 'kz', 'Uzbekistan': 'uz',
  'Georgia': 'ge', 'Armenia': 'am', 'Azerbaijan': 'az',
  'Myanmar': 'mm', 'Thailand': 'th', 'Philippines': 'ph', 'Malaysia': 'my',
  'Bangladesh': 'bd', 'Sri Lanka': 'lk', 'Nepal': 'np', 'Mongolia': 'mn',
  'Taiwan': 'tw', 'Australia': 'au', 'New Zealand': 'nz',
  'Papua New Guinea': 'pg', 'Fiji': 'fj',
  'Poland': 'pl', 'Czech Republic': 'cz', 'Austria': 'at',
  'Switzerland': 'ch', 'Norway': 'no', 'Denmark': 'dk', 'Finland': 'fi',
  'Portugal': 'pt', 'Greece': 'gr', 'Ireland': 'ie', 'Hungary': 'hu',
  'Serbia': 'rs', 'Croatia': 'hr', 'Bulgaria': 'bg', 'Slovakia': 'sk',
  'Lithuania': 'lt', 'Latvia': 'lv', 'Estonia': 'ee', 'Moldova': 'md',
  'Belarus': 'by',
  'Mauritania': 'mr', 'Zambia': 'zm', 'Zimbabwe': 'zw', 'Botswana': 'bw',
  'Namibia': 'na', 'Madagascar': 'mg', 'Mali': 'ml', 'Niger': 'ne',
  'Burkina Faso': 'bf', 'Ivory Coast': 'ci', 'Benin': 'bj', 'Togo': 'tg',
  'Sierra Leone': 'sl', 'Liberia': 'lr', 'Guinea': 'gn', 'Gambia': 'gm',
  'Gabon': 'ga', 'Congo': 'cg', 'Central African Republic': 'cf',
  'Chad': 'td', 'Eritrea': 'er', 'Malawi': 'mw', 'Lesotho': 'ls',
  'Eswatini': 'sz',
  'Republic of the Congo': 'cg',
  'Democratic Republic of the Congo': 'cd',
  'United States of America': 'us',
  'United States': 'us',
  'United Kingdom': 'gb',
  'United Arab Emirates': 'ae',
  'Czechia': 'cz',
  'Côte d\'Ivoire': 'ci',
  'Korea': 'kr',
  'Dem. Rep. Korea': 'kp',
  'Rep. of Korea': 'kr',
  'Suriname': 'sr', 'Puerto Rico': 'pr', 'Bahamas': 'bs', 'Hong Kong': 'hk',
  'Cambodia': 'kh', 'Trinidad': 'tt', 'Guyana': 'gy', 'Belize': 'bz',
  'Laos': 'la', 'Brunei': 'bn', 'Timor-Leste': 'tl', 'Bhutan': 'bt',
  'Kyrgyzstan': 'kg', 'Tajikistan': 'tj', 'Turkmenistan': 'tm',
  'Albania': 'al', 'Bosnia and Herzegovina': 'ba', 'North Macedonia': 'mk',
  'Montenegro': 'me', 'Kosovo': 'xk', 'Slovenia': 'si', 'Luxembourg': 'lu',
  'Cyprus': 'cy', 'Malta': 'mt', 'Iceland': 'is',
  'Equatorial Guinea': 'gq', 'Guinea-Bissau': 'gw', 'Comoros': 'km',
  'Cabo Verde': 'cv', 'São Tomé and Príncipe': 'st', 'Seychelles': 'sc',
  'Mauritius': 'mu', 'Maldives': 'mv', 'Solomon Islands': 'sb',
  'Vanuatu': 'vu', 'Samoa': 'ws', 'Tonga': 'to',
};

// ── Constants ─────────────────────────────────────────────────────────────────

export const ATTACK_COLORS: Record<AttackType, string> = {
  malware:   '#ef4444',
  phishing:  '#a855f7',
  exploit:   '#f97316',
  ddos:      '#facc15',
  intrusion: '#22d3ee',
};

export const ATTACK_LABELS: Record<AttackType, string> = {
  malware:   'Malware',
  phishing:  'Phishing',
  exploit:   'Exploit',
  ddos:      'DDoS',
  intrusion: 'Intrusion',
};

export const TRAVEL_DURATION  = 3.0;
export const FLASH_DURATION   = 2.0;
export const ARC_STEPS        = 50;
export const RING_PERIOD      = 2000;
export const TAIL_FRACTION    = 0.18;
export const CANVAS_SEGMENTS  = 80;
export const CANVAS_TAIL      = 0.22;

// ── Seeded PRNG ──────────────────────────────────────────────────────────────

export function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Coordinate jitter (spread arcs within a country) ─────────────────────────

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 0x9e3779b9;
}

const LARGE_COUNTRY_JITTER: Record<string, { latRange: number; lngRange: number }> = {
  'USA':           { latRange: 15, lngRange: 40 },
  'United States': { latRange: 15, lngRange: 40 },
  'United States of America': { latRange: 15, lngRange: 40 },
  'Canada':        { latRange: 12, lngRange: 40 },
  'Russia':        { latRange: 15, lngRange: 60 },
  'China':         { latRange: 15, lngRange: 25 },
  'Brazil':        { latRange: 18, lngRange: 18 },
  'India':         { latRange: 12, lngRange: 10 },
  'Australia':     { latRange: 12, lngRange: 20 },
};

export function jitterCoords(lat: number, lng: number, seed: string, country?: string): { lat: number; lng: number } {
  const rand = seededRand(hashString(seed));
  const range = (country && LARGE_COUNTRY_JITTER[country]) ?? { latRange: 3, lngRange: 3 };
  const jLat = (rand() - 0.5) * range.latRange;
  const jLng = (rand() - 0.5) * range.lngRange;
  return { lat: Math.max(-85, Math.min(85, lat + jLat)), lng: lng + jLng };
}

// ── Data generators ──────────────────────────────────────────────────────────

export function genCountryDefaultPercentages(country: string): Record<AttackType, number> {
  let seed = 0;
  for (const c of country) seed = (seed * 31 + c.charCodeAt(0)) | 0;
  const rand = seededRand(Math.abs(seed) ^ 0xc0ffee);
  const types: AttackType[] = ['malware', 'phishing', 'exploit', 'ddos', 'intrusion'];
  const weights = types.map(() => 5 + rand() * 40);
  const total = weights.reduce((a, b) => a + b, 0);
  const result = {} as Record<AttackType, number>;
  types.forEach((t, i) => { result[t] = Math.round((weights[i] / total) * 1000) / 10; });
  return result;
}

export function gen30DayData() {
  const rand = seededRand(0xdeadbeef);
  return Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    value: Math.round(450 + Math.sin(i / 4) * 600 + rand() * 800 + (i > 20 ? rand() * 1200 : 0)),
  }));
}

export function genSparklineForCountry(country: string, type: string): { i: number; v: number }[] {
  let seed = 0;
  for (const c of country) seed = (seed * 31 + c.charCodeAt(0)) | 0;
  for (const c of type)    seed = (seed * 31 + c.charCodeAt(0)) | 0;
  const rand = seededRand(Math.abs(seed) || 0x9e3779b9);
  return Array.from({ length: 15 }, (_, i) => ({
    i,
    v: Math.round(20 + rand() * 80 + Math.sin(i / 2.5) * 25),
  }));
}

export function genCountrySparklines(country: string): Record<AttackType, { i: number; v: number }[]> {
  return {
    malware:   genSparklineForCountry(country, 'malware'),
    phishing:  genSparklineForCountry(country, 'phishing'),
    exploit:   genSparklineForCountry(country, 'exploit'),
    ddos:      genSparklineForCountry(country, 'ddos'),
    intrusion: genSparklineForCountry(country, 'intrusion'),
  };
}

export function genCountry30DayData(country: string) {
  let seed = 0;
  for (let i = 0; i < country.length; i++) seed = (seed * 31 + country.charCodeAt(i)) | 0;
  const rand = seededRand(Math.abs(seed) || 0xabcdef);
  return Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    value: Math.round(200 + Math.sin(i / 3.5) * 400 + rand() * 600 + (i > 15 ? rand() * 900 : 0)),
  }));
}

export const TREND_30 = gen30DayData();

// ── Bezier arc math ──────────────────────────────────────────────────────────

export function computeBezierArc(
  src: { lat: number; lng: number },
  dst: { lat: number; lng: number },
): [number, number][] {
  const cpLng = (src.lng + dst.lng) / 2;
  const dist   = Math.sqrt((dst.lng - src.lng) ** 2 + (dst.lat - src.lat) ** 2);
  const elevate = Math.min(dist * 0.4, 40);
  const cpLat  = (src.lat + dst.lat) / 2 + elevate;

  const coords: [number, number][] = [];
  for (let i = 0; i <= ARC_STEPS; i++) {
    const t   = i / ARC_STEPS;
    const tm  = 1 - t;
    const lng = tm * tm * src.lng + 2 * tm * t * cpLng + t * t * dst.lng;
    const lat = tm * tm * src.lat + 2 * tm * t * cpLat + t * t * dst.lat;
    coords.push([lng, lat]);
  }
  return coords;
}

export function bezierPt(
  sx: number, sy: number,
  cx: number, cy: number,
  ex: number, ey: number,
  t: number,
): { x: number; y: number } {
  const tm = 1 - t;
  return {
    x: tm * tm * sx + 2 * tm * t * cx + t * t * ex,
    y: tm * tm * sy + 2 * tm * t * cy + t * t * ey,
  };
}

// ── Arc & Flash state types ──────────────────────────────────────────────────

export interface ArcState {
  threat:     LiveThreat;
  arcCoords:  [number, number][];
  startTime:  number;
  progress:   number;
  opacity:    number;
  impacted?:  boolean;
}

export interface FlashState {
  id:        string;
  color:     string;
  coords:    [number, number];
  startTime: number;
}

export interface CanvasArc {
  id:           string;
  srcLng:       number;
  srcLat:       number;
  dstLng:       number;
  dstLat:       number;
  color:        string;
  progress:     number;
  phase:        'animating' | 'fading' | 'impact';
  fadeOpacity:  number;
  lastFrame:    number;
  baseAlpha:    number;
}

// ── GeoJSON builders ─────────────────────────────────────────────────────────

export function buildFlashGeoJSON(flashes: Map<string, FlashState>, now: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const [id, flash] of flashes) {
    const t = (now - flash.startTime) / (FLASH_DURATION * 1000);
    if (t > 1) { flashes.delete(id); continue; }
    const eased = 1 - Math.pow(1 - t, 3);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: flash.coords },
      properties: { color: flash.color, radius: eased * 32, opacity: (1 - t) * 0.9, strokeW: 2.5 },
    });
    const t2 = Math.max(0, t - 0.15);
    const eased2 = 1 - Math.pow(1 - t2, 3);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: flash.coords },
      properties: { color: flash.color, radius: eased2 * 60, opacity: Math.max(0, 1 - t2) * 0.5, strokeW: 1.5 },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildArcsGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.progress <= 0 || state.progress >= 1) continue;
    const sliceEnd   = Math.max(2, Math.ceil(state.progress * (state.arcCoords.length - 1)));
    const tailLength = Math.max(4, Math.floor(sliceEnd * TAIL_FRACTION));
    const sliceStart = Math.max(0, sliceEnd - tailLength);
    const coords = state.arcCoords.slice(sliceStart, sliceEnd);
    if (coords.length < 2) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { color: ATTACK_COLORS[state.threat.attack_type], opacity: state.opacity },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildProjectilesGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.progress <= 0 || state.progress >= 1) continue;
    const idx = Math.min(Math.floor(state.progress * (state.arcCoords.length - 1)), state.arcCoords.length - 1);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: state.arcCoords[idx] },
      properties: { color: ATTACK_COLORS[state.threat.attack_type], opacity: state.opacity },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildFullArcsGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.opacity <= 0 || state.progress >= 1) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: state.arcCoords },
      properties: { color: ATTACK_COLORS[state.threat.attack_type], opacity: state.opacity * 0.28 },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildSourcesGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const seen = new Set<string>();
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.opacity <= 0) continue;
    if (seen.has(state.threat.source.country)) continue;
    seen.add(state.threat.source.country);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [state.threat.source.lng, state.threat.source.lat] },
      properties: { country: state.threat.source.country, color: ATTACK_COLORS[state.threat.attack_type], opacity: state.opacity },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildImpactGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const targetMap = new Map<string, { lng: number; lat: number; count: number }>();
  for (const state of states.values()) {
    if (state.progress < 0.95 || state.opacity <= 0) continue;
    const key = `${state.threat.target.lng.toFixed(3)},${state.threat.target.lat.toFixed(3)}`;
    const existing = targetMap.get(key);
    if (existing) existing.count++;
    else targetMap.set(key, { lng: state.threat.target.lng, lat: state.threat.target.lat, count: 1 });
  }
  return {
    type: 'FeatureCollection',
    features: [...targetMap.values()].map(({ lng, lat, count }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { count },
    })),
  };
}

export function buildRingsGeoJSON(states: Map<string, ArcState>, now: number): GeoJSON.FeatureCollection {
  const seenCountries = new Map<string, { lng: number; lat: number; color: string; firstSeen: number }>();
  for (const state of states.values()) {
    if (state.opacity <= 0) continue;
    const c = state.threat.source.country;
    if (!seenCountries.has(c)) {
      seenCountries.set(c, {
        lng: state.threat.source.lng, lat: state.threat.source.lat,
        color: ATTACK_COLORS[state.threat.attack_type], firstSeen: state.startTime,
      });
    }
  }
  const features: GeoJSON.Feature[] = [];
  for (const [, info] of seenCountries) {
    for (const offset of [0, RING_PERIOD / 2]) {
      const t = ((now - info.firstSeen + offset) % RING_PERIOD) / RING_PERIOD;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [info.lng, info.lat] },
        properties: { radius: 4 + t * 22, ringOpacity: (1 - t) * 0.85, color: info.color },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}
