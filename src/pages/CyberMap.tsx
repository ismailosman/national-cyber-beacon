import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Loader2, Zap, Globe, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLiveAttacks, LiveThreat, AttackType } from '@/hooks/useLiveAttacks';
import logoSrc from '@/assets/logo.png';
import {
  AreaChart, Area, LineChart, Line, ResponsiveContainer,
  XAxis, YAxis, Tooltip,
} from 'recharts';

// ── Country ISO codes for flag CDN ────────────────────────────────────────────

const COUNTRY_ISO: Record<string, string> = {
  'China': 'cn', 'Russia': 'ru', 'Iran': 'ir', 'North Korea': 'kp',
  'USA': 'us', 'Netherlands': 'nl', 'Germany': 'de', 'Ukraine': 'ua',
  'Brazil': 'br', 'India': 'in', 'Nigeria': 'ng', 'Pakistan': 'pk',
  'Vietnam': 'vn', 'Romania': 'ro', 'Turkey': 'tr', 'South Korea': 'kr',
  'Indonesia': 'id', 'France': 'fr', 'UK': 'gb', 'Saudi Arabia': 'sa',
  'Egypt': 'eg', 'Singapore': 'sg', 'Canada': 'ca', 'Japan': 'jp',
  'Israel': 'il', 'Somalia': 'so', 'Kenya': 'ke', 'Ethiopia': 'et',
};

// ── Constants ─────────────────────────────────────────────────────────────────

const ATTACK_COLORS: Record<AttackType, string> = {
  malware:   '#ef4444',
  phishing:  '#a855f7',
  exploit:   '#f97316',
  ddos:      '#facc15',
  intrusion: '#22d3ee',
};

const ATTACK_LABELS: Record<AttackType, string> = {
  malware:   'Malware',
  phishing:  'Phishing',
  exploit:   'Exploit',
  ddos:      'DDoS',
  intrusion: 'Intrusion',
};

// Per-country default percentages generated from a seeded PRNG — unique per country
function genCountryDefaultPercentages(country: string): Record<AttackType, number> {
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

const TRAVEL_DURATION  = 3.0;   // slower, cinematic travel
const FLASH_DURATION   = 2.0;   // impact flash ring expansion (seconds)
const VISIBLE_DURATION = 12;   // arcs fade before next burst arrives
const FADE_DURATION    = 2;
const ARC_STEPS        = 50;
const RING_PERIOD      = 2000; // ms per ring cycle

// ── Seeded PRNG (no real API needed) ─────────────────────────────────────────

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function gen30DayData() {
  const rand = seededRand(0xdeadbeef);
  return Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    value: Math.round(450 + Math.sin(i / 4) * 600 + rand() * 800 + (i > 20 ? rand() * 1200 : 0)),
  }));
}

function genSparklineForCountry(country: string, type: string): { i: number; v: number }[] {
  let seed = 0;
  for (const c of country) seed = (seed * 31 + c.charCodeAt(0)) | 0;
  for (const c of type)    seed = (seed * 31 + c.charCodeAt(0)) | 0;
  const rand = seededRand(Math.abs(seed) || 0x9e3779b9);
  return Array.from({ length: 15 }, (_, i) => ({
    i,
    v: Math.round(20 + rand() * 80 + Math.sin(i / 2.5) * 25),
  }));
}

function genCountrySparklines(country: string): Record<AttackType, { i: number; v: number }[]> {
  return {
    malware:   genSparklineForCountry(country, 'malware'),
    phishing:  genSparklineForCountry(country, 'phishing'),
    exploit:   genSparklineForCountry(country, 'exploit'),
    ddos:      genSparklineForCountry(country, 'ddos'),
    intrusion: genSparklineForCountry(country, 'intrusion'),
  };
}

const TREND_30 = gen30DayData();

// ── Somalia Panel ─────────────────────────────────────────────────────────────

interface SomaliaPanelProps {
  threats: LiveThreat[];
  onClose: () => void;
}

const SomaliaPanel: React.FC<SomaliaPanelProps> = ({ threats, onClose }) => {
  const somaliDefaults = React.useMemo(() => genCountryDefaultPercentages('Somalia'), []);
  const somaliaSparklines = React.useMemo(() => genCountrySparklines('Somalia'), []);
  const percentages = React.useMemo<Record<AttackType, number>>(() => {
    if (threats.length < 10) return somaliDefaults;
    const counts: Record<string, number> = {};
    for (const t of threats) counts[t.attack_type] = (counts[t.attack_type] || 0) + 1;
    const total = threats.length;
    const result = {} as Record<AttackType, number>;
    for (const type of Object.keys(ATTACK_LABELS) as AttackType[]) {
      result[type] = Math.round(((counts[type] || 0) / total) * 100 * 10) / 10;
    }
    return result;
  }, [threats]);

  return (
    <div
      className="absolute z-30 flex flex-col overflow-y-auto"
      style={{
        right: 16,
        top: 80,
        width: 'min(320px, calc(100vw - 32px))',
        maxHeight: 'calc(80vh)',
        background: 'rgba(10,10,20,0.96)',
        backdropFilter: 'blur(14px)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: '3px solid #f472b6',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <img src="https://flagcdn.com/w40/so.png" alt="Somalia flag" className="w-6 h-4 object-cover rounded-sm" />
          <span className="text-white font-bold text-sm tracking-wide">Somalia</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Attack Trend */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-0.5" style={{ color: '#f472b6' }}>
          ATTACK TREND
        </p>
        <p className="text-[10px] text-slate-500 mb-3">Last 30 days</p>
        <div style={{ height: 120, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={TREND_30} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="pinkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f472b6" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#f472b6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#f472b6"
                strokeWidth={1.5}
                fill="url(#pinkGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px' }} />

      {/* Malware Type Trends */}
      <div className="px-4 pt-3 pb-4">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-0.5" style={{ color: '#f472b6' }}>
          MALWARE TYPE TRENDS
        </p>
        <p className="text-[10px] text-slate-500 mb-3">% of affected systems</p>

        <div className="flex flex-col gap-3">
          {(Object.keys(ATTACK_LABELS) as AttackType[]).map((type) => (
            <div key={type} className="flex items-center gap-2">
              {/* Label */}
              <span className="text-xs text-slate-300 w-20 flex-shrink-0">{ATTACK_LABELS[type]}</span>

              {/* Sparkline */}
              <div style={{ width: 60, height: 28, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={somaliaSparklines[type]} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={ATTACK_COLORS[type]}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Percentage */}
              <span className="text-xs font-mono font-bold ml-auto flex-shrink-0" style={{ color: ATTACK_COLORS[type] }}>
                {percentages[type].toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Country Panel (Source of Attacks) ─────────────────────────────────────────

function genCountry30DayData(country: string) {
  // Use a unique seed per country name
  let seed = 0;
  for (let i = 0; i < country.length; i++) seed = (seed * 31 + country.charCodeAt(i)) | 0;
  const rand = seededRand(Math.abs(seed) || 0xabcdef);
  return Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    value: Math.round(200 + Math.sin(i / 3.5) * 400 + rand() * 600 + (i > 15 ? rand() * 900 : 0)),
  }));
}

interface CountryPanelProps {
  country: string;
  threats: LiveThreat[];
  onClose: () => void;
}

const CountryPanel: React.FC<CountryPanelProps> = ({ country, threats, onClose }) => {
  const iso = COUNTRY_ISO[country] ?? 'un';
  const trendData = React.useMemo(() => genCountry30DayData(country), [country]);
  const sparklines = React.useMemo(() => genCountrySparklines(country), [country]);
  const defaultPercentages = React.useMemo(() => genCountryDefaultPercentages(country), [country]);

  const countryThreats = threats.filter(t => t.source.country === country);

  const percentages = React.useMemo<Record<AttackType, number>>(() => {
    if (countryThreats.length < 5) return defaultPercentages;
    const counts: Record<string, number> = {};
    for (const t of countryThreats) counts[t.attack_type] = (counts[t.attack_type] || 0) + 1;
    const total = countryThreats.length;
    const result = {} as Record<AttackType, number>;
    for (const type of Object.keys(ATTACK_LABELS) as AttackType[]) {
      result[type] = Math.round(((counts[type] || 0) / total) * 100 * 10) / 10;
    }
    return result;
  }, [countryThreats, defaultPercentages]);

  return (
    <div
      className="absolute z-30 flex flex-col overflow-y-auto"
      style={{
        right: 16,
        top: 80,
        width: 'min(320px, calc(100vw - 32px))',
        maxHeight: 'calc(80vh)',
        background: 'rgba(10,10,20,0.96)',
        backdropFilter: 'blur(14px)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: '3px solid #f97316',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <img
            src={`https://flagcdn.com/w40/${iso}.png`}
            alt={`${country} flag`}
            className="w-6 h-4 object-cover rounded-sm"
          />
          <div>
            <span className="text-white font-bold text-sm tracking-wide">{country}</span>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">Source of Attacks</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Attack Volume Trend */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-0.5" style={{ color: '#f97316' }}>
          ATTACK VOLUME
        </p>
        <p className="text-[10px] text-slate-500 mb-3">Last 30 days</p>
        <div style={{ height: 120, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`countryGrad-${iso}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#f97316"
                strokeWidth={1.5}
                fill={`url(#countryGrad-${iso})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px' }} />

      {/* Attack Types */}
      <div className="px-4 pt-3 pb-4">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-0.5" style={{ color: '#f97316' }}>
          ATTACK TYPES FROM THIS COUNTRY
        </p>
        <p className="text-[10px] text-slate-500 mb-3">Live from this source</p>

        <div className="flex flex-col gap-3">
          {(Object.keys(ATTACK_LABELS) as AttackType[]).map((type) => (
            <div key={type} className="flex items-center gap-2">
              <span className="text-xs text-slate-300 w-20 flex-shrink-0">{ATTACK_LABELS[type]}</span>
              <div style={{ width: 60, height: 28, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklines[type]} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={ATTACK_COLORS[type]}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <span className="text-xs font-mono font-bold ml-auto flex-shrink-0" style={{ color: ATTACK_COLORS[type] }}>
                {percentages[type].toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Bezier arc math ───────────────────────────────────────────────────────────

function computeBezierArc(
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

// ── Arc state tracking ────────────────────────────────────────────────────────

interface ArcState {
  threat:     LiveThreat;
  arcCoords:  [number, number][];
  startTime:  number;
  progress:   number;
  opacity:    number;
  impacted?:  boolean; // true once progress first reached 1 (for flash trigger)
}

// ── Flash/explosion state ─────────────────────────────────────────────────────

interface FlashState {
  id:        string;
  color:     string;
  coords:    [number, number];
  startTime: number;
}

function buildFlashGeoJSON(flashes: Map<string, FlashState>, now: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const [id, flash] of flashes) {
    const t = (now - flash.startTime) / (FLASH_DURATION * 1000); // 0→1
    if (t > 1) { flashes.delete(id); continue; }
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    // Inner ring: expands 0→32px, fades 1→0
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: flash.coords },
      properties: { color: flash.color, radius: eased * 32, opacity: (1 - t) * 0.9, strokeW: 2.5 },
    });
    // Outer ring: delayed start, expands 0→60px, fades faster
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

// ── GeoJSON builders ──────────────────────────────────────────────────────────

const TAIL_FRACTION = 0.18;

function buildArcsGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.progress <= 0 || state.progress >= 1) continue; // no line after arrival

    // During travel: show only a short moving tail segment (traveling beam effect)
    const sliceEnd   = Math.max(2, Math.ceil(state.progress * (state.arcCoords.length - 1)));
    const tailLength = Math.max(4, Math.floor(sliceEnd * TAIL_FRACTION));
    const sliceStart = Math.max(0, sliceEnd - tailLength);
    const coords = state.arcCoords.slice(sliceStart, sliceEnd);

    if (coords.length < 2) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {
        color:   ATTACK_COLORS[state.threat.attack_type],
        opacity: state.opacity,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildProjectilesGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.progress <= 0 || state.progress >= 1) continue;
    const idx = Math.min(
      Math.floor(state.progress * (state.arcCoords.length - 1)),
      state.arcCoords.length - 1,
    );
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: state.arcCoords[idx] },
      properties: {
        color:   ATTACK_COLORS[state.threat.attack_type],
        opacity: state.opacity,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildFullArcsGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.opacity <= 0 || state.progress >= 1) continue; // no guide rail after arrival
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: state.arcCoords },
      properties: {
        color: ATTACK_COLORS[state.threat.attack_type],
        opacity: state.opacity * 0.28,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildSourcesGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const seen = new Set<string>();
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.opacity <= 0) continue;
    if (seen.has(state.threat.source.country)) continue;
    seen.add(state.threat.source.country);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [state.threat.source.lng, state.threat.source.lat] },
      properties: {
        country: state.threat.source.country,
        color:   ATTACK_COLORS[state.threat.attack_type],
        opacity: state.opacity,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildImpactGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
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

function buildRingsGeoJSON(states: Map<string, ArcState>, now: number): GeoJSON.FeatureCollection {
  // Collect unique active source countries
  const seenCountries = new Map<string, { lng: number; lat: number; color: string; firstSeen: number }>();
  for (const state of states.values()) {
    if (state.opacity <= 0) continue;
    const c = state.threat.source.country;
    if (!seenCountries.has(c)) {
      seenCountries.set(c, {
        lng: state.threat.source.lng,
        lat: state.threat.source.lat,
        color: ATTACK_COLORS[state.threat.attack_type],
        firstSeen: state.startTime,
      });
    }
  }

  const features: GeoJSON.Feature[] = [];
  // Two staggered rings per source — as one expands/fades the next begins
  for (const [, info] of seenCountries) {
    for (const offset of [0, RING_PERIOD / 2]) {
      const t = ((now - info.firstSeen + offset) % RING_PERIOD) / RING_PERIOD;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [info.lng, info.lat] },
        properties: {
          radius: 4 + t * 22,           // expands 4→26px
          ringOpacity: (1 - t) * 0.85,  // fades 0.85→0
          color: info.color,
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

// ── Canvas arc types ──────────────────────────────────────────────────────────

interface CanvasArc {
  id:           string;
  srcLng:       number;
  srcLat:       number;
  dstLng:       number;
  dstLat:       number;
  color:        string;
  progress:     number;      // 0→1 while animating
  phase:        'animating' | 'fading' | 'impact';
  fadeOpacity:  number;      // 1→0 while fading
  lastFrame:    number;      // timestamp of last RAF tick (ms)
}

// ── Canvas drawing helpers ────────────────────────────────────────────────────

function bezierPt(
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

function hexA(opacity: number): string {
  return Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16).padStart(2, '0');
}

const CANVAS_SEGMENTS = 80;
const CANVAS_TAIL     = 0.22;  // tail length as fraction of progress

// ── Main Component ─────────────────────────────────────────────────────────────

const CyberMap: React.FC = () => {
  const [mapToken, setMapToken]           = useState<string | null>(null);
  const [mapError, setMapError]           = useState<string | null>(null);
  const [mapLoaded, setMapLoaded]         = useState(false);
  const [liveOn, setLiveOn]               = useState(true);
  const [somaliaPanel, setSomaliaPanel]   = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [mobileFeedOpen, setMobileFeedOpen] = useState(false);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const mapboxglRef  = useRef<any>(null);
  const arcStatesRef   = useRef<Map<string, ArcState>>(new Map());
  const flashStatesRef = useRef<Map<string, FlashState>>(new Map());
  const rafRef         = useRef<number>(0);
  const isDirtyRef     = useRef(false);
  const seenIdsRef     = useRef<Set<string>>(new Set());

  // Canvas overlay refs
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const canvasArcsRef = useRef<CanvasArc[]>([]);
  const canvasRafRef  = useRef<number>(0);
  const canvasSeenRef = useRef<Set<string>>(new Set());

  const { threats, todayCount } = useLiveAttacks(liveOn);

  // ── Resize canvas to match its container ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = mapContainer.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Spawn canvas arcs from new threats ─────────────────────────────────
  useEffect(() => {
    if (!liveOn) {
      canvasArcsRef.current = [];
      canvasSeenRef.current.clear();
      return;
    }
    for (const threat of threats) {
      if (canvasSeenRef.current.has(threat.id)) continue;
      canvasSeenRef.current.add(threat.id);

      // Cap at 60 concurrent arcs
      if (canvasArcsRef.current.length >= 60) {
        canvasArcsRef.current.splice(0, canvasArcsRef.current.length - 59);
      }

      canvasArcsRef.current.push({
        id:          threat.id,
        srcLng:      threat.source.lng,
        srcLat:      threat.source.lat,
        dstLng:      threat.target.lng,
        dstLat:      threat.target.lat,
        color:       ATTACK_COLORS[threat.attack_type],
        progress:    0,
        phase:       'animating',
        fadeOpacity: 1,
        lastFrame:   performance.now(),
      });
    }
  }, [threats, liveOn]);

  // ── Canvas draw loop ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Helper: project lat/lng → canvas pixel coords
    const project = (lng: number, lat: number): { x: number; y: number } => {
      const map = mapRef.current;
      if (map) {
        try {
          const pt = map.project([lng, lat]);
          return { x: pt.x, y: pt.y };
        } catch (_) { /* fall through */ }
      }
      // Fallback mercator projection (used before map loads or on error)
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const x = ((lng + 180) / 360) * w;
      const latRad = (lat * Math.PI) / 180;
      const mercN  = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
      const y      = (h / 2) - (w * mercN) / (2 * Math.PI);
      return { x, y };
    };

    const SPEED = 0.005; // progress per frame at 60fps (≈3.3s travel)
    const FADE_FRAMES = 60;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { canvasRafRef.current = requestAnimationFrame(draw); return; }

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const now = performance.now();
      const arcs = canvasArcsRef.current;

      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        const dt = Math.min((now - arc.lastFrame) / (1000 / 60), 3); // frame delta (capped at 3x)
        arc.lastFrame = now;

        // Advance progress / fade
        if (arc.phase === 'animating') {
          arc.progress = Math.min(arc.progress + SPEED * dt, 1);
          if (arc.progress >= 1) {
            arc.phase       = 'impact';
            arc.fadeOpacity = 0;
          }
        } else if (arc.phase === 'impact') {
          arc.fadeOpacity -= (1 / FADE_FRAMES) * dt;
          if (arc.fadeOpacity <= -1) {
            arcs.splice(i, 1);
            continue;
          }
        }

        const baseOpacity = arc.phase === 'fading' ? arc.fadeOpacity : 1;

        // ── Project coordinates ──────────────────────────────────────────
        const src = project(arc.srcLng, arc.srcLat);
        const dst = project(arc.dstLng, arc.dstLat);

        // Control point: raised midpoint, higher for distant pairs
        const dx   = dst.x - src.x;
        const dy   = dst.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ctrl = {
          x: (src.x + dst.x) / 2,
          y: (src.y + dst.y) / 2 - dist * 0.35,
        };

        const prog = arc.progress;
        const currentSeg = Math.floor(prog * CANVAS_SEGMENTS);
        const tailSeg    = Math.max(0, currentSeg - Math.ceil(CANVAS_SEGMENTS * CANVAS_TAIL));

        // ── Full solid arc line (guide rail, dim) ───────────────────────
        if (arc.phase !== 'impact') {
          ctx.save();
          ctx.globalAlpha = baseOpacity * 0.25;
          ctx.strokeStyle = arc.color;
          ctx.lineWidth   = 2.5;
          ctx.beginPath();
          for (let s = 0; s <= CANVAS_SEGMENTS; s++) {
            const t  = s / CANVAS_SEGMENTS;
            const pt = bezierPt(src.x, src.y, ctrl.x, ctrl.y, dst.x, dst.y, t);
            s === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
          ctx.restore();
        }

        // ── Glowing tail arc (bright head → fading tail) ─────────────────
        if (arc.phase === 'animating' && currentSeg > 0) {
          for (let s = tailSeg; s <= currentSeg; s++) {
            const t0 = s / CANVAS_SEGMENTS;
            const t1 = (s + 1) / CANVAS_SEGMENTS;
            const p0 = bezierPt(src.x, src.y, ctrl.x, ctrl.y, dst.x, dst.y, t0);
            const p1 = bezierPt(src.x, src.y, ctrl.x, ctrl.y, dst.x, dst.y, t1);

            const segFrac = (s - tailSeg) / Math.max(1, currentSeg - tailSeg);

            // Glow layer
            ctx.save();
            ctx.globalAlpha = segFrac * baseOpacity * 0.4;
            ctx.strokeStyle = arc.color;
            ctx.lineWidth   = 14;
            ctx.lineCap     = 'round';
            ctx.shadowBlur  = 20;
            ctx.shadowColor = arc.color;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.restore();

            // Sharp bright line
            ctx.save();
            ctx.globalAlpha = segFrac * baseOpacity * 0.9;
            ctx.strokeStyle = arc.color;
            ctx.lineWidth   = 3.5;
            ctx.lineCap     = 'round';
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.restore();
          }

          // ── Glowing head dot ──────────────────────────────────────────
          const headT  = currentSeg / CANVAS_SEGMENTS;
          const headPt = bezierPt(src.x, src.y, ctrl.x, ctrl.y, dst.x, dst.y, headT);
          ctx.save();
          ctx.globalAlpha  = baseOpacity;
          ctx.shadowBlur   = 15;
          ctx.shadowColor  = arc.color;
          ctx.fillStyle    = '#ffffff';
          ctx.beginPath();
          ctx.arc(headPt.x, headPt.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // ── Source origin dot ─────────────────────────────────────────────
        if (arc.phase === 'animating') {
          ctx.save();
          ctx.globalAlpha = baseOpacity * 0.9;
          ctx.fillStyle   = arc.color;
          ctx.shadowBlur  = 8;
          ctx.shadowColor = arc.color;
          ctx.beginPath();
          ctx.arc(src.x, src.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // ── Destination pulse ring (at 80%+ progress) ────────────────────
        if (arc.progress >= 0.8) {
          const pulseT = (arc.progress - 0.8) / 0.2; // 0→1 as progress 0.8→1
          const ringR  = 4 + pulseT * 18;
          const ringOpacity = (1 - pulseT) * baseOpacity * 0.85;
          ctx.save();
          ctx.globalAlpha    = ringOpacity;
          ctx.strokeStyle    = arc.color;
          ctx.lineWidth      = 2.5;
          ctx.shadowBlur     = 10;
          ctx.shadowColor    = arc.color;
          ctx.beginPath();
          ctx.arc(dst.x, dst.y, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // ── Impact flash rings (on arrival) ─────────────────────────────
        if (arc.phase === 'impact' && arc.fadeOpacity > -0.5) {
          const flashT = Math.min(1, (-arc.fadeOpacity) / 0.5); // 0→1 over impact phase
          const eased  = 1 - Math.pow(1 - flashT, 3);
          // Inner burst ring
          ctx.save();
          ctx.globalAlpha = (1 - flashT) * 0.9;
          ctx.strokeStyle = arc.color;
          ctx.lineWidth   = 3.5;
          ctx.shadowBlur  = 20;
          ctx.shadowColor = arc.color;
          ctx.beginPath();
          ctx.arc(dst.x, dst.y, eased * 28, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          // Outer burst ring (delayed)
          const flashT2 = Math.max(0, flashT - 0.15);
          const eased2  = 1 - Math.pow(1 - flashT2, 3);
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - flashT2) * 0.5;
          ctx.strokeStyle = arc.color;
          ctx.lineWidth   = 2.5;
          ctx.beginPath();
          ctx.arc(dst.x, dst.y, eased2 * 52, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      canvasRafRef.current = requestAnimationFrame(draw);
    };

    canvasRafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(canvasRafRef.current);
  }, []);

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Fetch Mapbox token from public-stats (no auth required) ──────────────
  useEffect(() => {
    supabase.functions.invoke('public-stats').then(({ data, error }) => {
      if (!error && data?.mapbox_token) {
        setMapToken(data.mapbox_token);
      } else {
        setMapError('Map token unavailable');
      }
    });
  }, []);

  // ── Init Mapbox ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapToken || !mapContainer.current || mapRef.current) return;
    let cancelled = false;

    import('mapbox-gl').then((mod) => {
      if (cancelled || !mapContainer.current) return;
      const mapboxgl = mod.default;
      mapboxglRef.current = mapboxgl;
      mapboxgl.accessToken = mapToken;

      const isMobile = window.innerWidth < 768;
      let map: any;
      try {
        map = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: isMobile ? [45, 5] as [number, number] : [20, 10] as [number, number],
          zoom: isMobile ? 0.1 : 2,
          minZoom: isMobile ? 0.1 : 1,
          projection: 'mercator',
          pitchWithRotate: false,
          attributionControl: false,
          interactive: true,
          scrollZoom: false,
          boxZoom: false,
          dragPan: isMobile,
          dragRotate: false,
          doubleClickZoom: false,
          touchZoomRotate: isMobile,
          touchPitch: false,
        });
      } catch (e: any) {
        if (!cancelled) setMapError(e?.message?.includes('WebGL') ? 'Map requires WebGL. Please use a supported browser.' : `Map init error: ${e?.message || 'Unknown'}`);
        return;
      }

      map.on('load', () => {
        if (cancelled) return;

        // On mobile, fit the entire world into the viewport
        if (isMobile) {
          map.fitBounds([[-180, -70], [180, 80]], { padding: 0, animate: false });
        }

        // ── Brighten map base layers for visibility ───────────────────
        try {
          if (map.getLayer('background')) map.setPaintProperty('background', 'background-color', '#141824');
          if (map.getLayer('water')) map.setPaintProperty('water', 'fill-color', '#1a2540');
          if (map.getLayer('land')) map.setPaintProperty('land', 'background-color', '#1c2030');
          // Try alternate land layer names
          for (const layerId of ['landcover', 'land-structure-polygon', 'landuse']) {
            if (map.getLayer(layerId)) map.setPaintProperty(layerId, 'fill-color', '#1c2030');
          }
        } catch (_e) { /* some layers may not exist */ }

        // ── Somalia highlight + country boundaries ─────────────────────
        map.addSource('country-boundaries', {
          type: 'vector',
          url: 'mapbox://mapbox.country-boundaries-v1',
        });

        // All country boundary outlines (thin lines for visibility)
        map.addLayer({
          id: 'country-boundary-lines',
          type: 'line',
          source: 'country-boundaries',
          'source-layer': 'country_boundaries',
          paint: {
            'line-color': 'rgba(148,163,184,0.45)',
            'line-width': 0.8,
          },
        });

        // Continent fill colors for visibility
        map.addLayer({
          id: 'continent-fills',
          type: 'fill',
          source: 'country-boundaries',
          'source-layer': 'country_boundaries',
          paint: {
            'fill-color': [
              'case',
              // Africa (amber)
              ['in', ['get', 'iso_3166_1'], ['literal', ['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW']]],
              'rgba(245,158,11,0.25)',
              // Europe (blue)
              ['in', ['get', 'iso_3166_1'], ['literal', ['AL','AD','AT','BY','BE','BA','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','XK','LV','LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL','PT','RO','RU','SM','RS','SK','SI','ES','SE','CH','UA','GB','VA']]],
              'rgba(59,130,246,0.25)',
              // Asia (teal)
              ['in', ['get', 'iso_3166_1'], ['literal', ['AF','AM','AZ','BH','BD','BT','BN','KH','CN','GE','IN','ID','IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MY','MV','MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK','SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE']]],
              'rgba(20,184,166,0.25)',
              // North America (purple)
              ['in', ['get', 'iso_3166_1'], ['literal', ['AG','BS','BB','BZ','CA','CR','CU','DM','DO','SV','GD','GT','HT','HN','JM','MX','NI','PA','KN','LC','VC','TT','US']]],
              'rgba(168,85,247,0.25)',
              // South America (green)
              ['in', ['get', 'iso_3166_1'], ['literal', ['AR','BO','BR','CL','CO','EC','GY','PY','PE','SR','UY','VE']]],
              'rgba(34,197,94,0.25)',
              // Oceania (rose)
              ['in', ['get', 'iso_3166_1'], ['literal', ['AU','FJ','KI','MH','FM','NR','NZ','PW','PG','WS','SB','TO','TV','VU']]],
              'rgba(244,63,94,0.25)',
              // Default (transparent)
              'rgba(0,0,0,0)'
            ],
            'fill-opacity': 1,
          },
        });

        // Somalia fill highlight
        map.addLayer({
          id: 'somalia-fill',
          type: 'fill',
          source: 'country-boundaries',
          'source-layer': 'country_boundaries',
          filter: ['==', ['get', 'iso_3166_1'], 'SO'],
          paint: {
            'fill-color': 'rgba(56, 189, 248, 0.35)',
          },
        });

        // Somalia border highlight
        map.addLayer({
          id: 'somalia-border',
          type: 'line',
          source: 'country-boundaries',
          'source-layer': 'country_boundaries',
          filter: ['==', ['get', 'iso_3166_1'], 'SO'],
          paint: {
            'line-color': 'rgba(56, 189, 248, 0.8)',
            'line-width': 2,
          },
        });

        const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

        map.addSource('attack-arcs-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-full-arcs-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-sources-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-impact-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-projectiles-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-flash-source', { type: 'geojson', data: emptyFC });

        // ── Solid persistent full arc (background rail, always visible) ───
        map.addLayer({
          id: 'attack-full-arcs',
          type: 'line',
          source: 'attack-full-arcs-source',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 1.2,
            'line-opacity': ['get', 'opacity'],
          },
        });

        // Glow (fat translucent line)
        map.addLayer({
          id: 'attack-arcs-glow',
          type: 'line',
          source: 'attack-arcs-source',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 8,
            'line-opacity': ['*', ['get', 'opacity'], 0.22],
            'line-blur': 6,
          },
        });

        // Sharp arc line
        map.addLayer({
          id: 'attack-arcs',
          type: 'line',
          source: 'attack-arcs-source',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 1.5,
            'line-opacity': ['*', ['get', 'opacity'], 0.65], // semi-transparent for stacking density
          },
        });

        // Source origin dots
        map.addLayer({
          id: 'attack-sources-dot',
          type: 'circle',
          source: 'attack-sources-source',
          paint: {
            'circle-radius': 4,
            'circle-color': ['get', 'color'],
            'circle-opacity': ['get', 'opacity'],
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(255,255,255,0.5)',
          },
        });

        // Source country labels
        map.addLayer({
          id: 'attack-sources-label',
          type: 'symbol',
          source: 'attack-sources-source',
          layout: {
            'text-field': ['get', 'country'],
            'text-size': 9,
            'text-anchor': 'bottom',
            'text-offset': [0, -0.8],
            'text-allow-overlap': false,
            'text-optional': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-opacity': ['get', 'opacity'],
            'text-halo-color': 'rgba(0,0,0,0.9)',
            'text-halo-width': 1.2,
          },
        });

        // ── Pulsing rings at source countries (radius driven by RAF) ──────
        map.addSource('attack-ring-source', { type: 'geojson', data: emptyFC });
        map.addLayer({
          id: 'attack-ring',
          type: 'circle',
          source: 'attack-ring-source',
          paint: {
            'circle-radius': ['get', 'radius'],
            'circle-color': 'transparent',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-opacity': ['get', 'ringOpacity'],
          },
        });

        // ── Somalia bullseye impact layers ───────────────────────────────

        // Solid center dot
        map.addLayer({
          id: 'attack-impact-solid',
          type: 'circle',
          source: 'attack-impact-source',
          paint: {
            'circle-radius': 5,
            'circle-color': '#f472b6',
            'circle-opacity': 0.9,
          },
        });

        // Inner ring
        map.addLayer({
          id: 'attack-impact',
          type: 'circle',
          source: 'attack-impact-source',
          paint: {
            'circle-radius': ['+', 10, ['/', ['get', 'count'], 2]],
            'circle-color': 'transparent',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#f472b6',
            'circle-opacity': 0.85,
          },
        });

        // Outer ring (larger, more transparent)
        map.addLayer({
          id: 'attack-impact-outer',
          type: 'circle',
          source: 'attack-impact-source',
          paint: {
            'circle-radius': ['+', 20, ['/', ['get', 'count'], 1]],
            'circle-color': 'transparent',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#f472b6',
            'circle-stroke-opacity': 0.35,
          },
        });

        // ── Traveling projectile dot layers ──────────────────────────────

        // Outer glow halo
        map.addLayer({
          id: 'attack-projectiles-glow',
          type: 'circle',
          source: 'attack-projectiles-source',
          paint: {
            'circle-radius': 14,
            'circle-color': ['get', 'color'],
            'circle-opacity': ['*', ['get', 'opacity'], 0.28],
            'circle-blur': 1,
          },
        });

        // Core bright dot with white stroke
        map.addLayer({
          id: 'attack-projectiles-core',
          type: 'circle',
          source: 'attack-projectiles-source',
          paint: {
            'circle-radius': 4,
            'circle-color': ['get', 'color'],
            'circle-opacity': ['get', 'opacity'],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(255,255,255,0.95)',
            'circle-stroke-opacity': ['get', 'opacity'],
          },
        });

        // ── Impact flash/explosion rings at target on hit ────────────────
        map.addLayer({
          id: 'attack-flash',
          type: 'circle',
          source: 'attack-flash-source',
          paint: {
            'circle-radius': ['get', 'radius'],
            'circle-color': 'transparent',
            'circle-stroke-width': ['get', 'strokeW'],
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-opacity': ['get', 'opacity'],
          },
        });

        // Source country dot click → open CountryPanel
        map.on('click', 'attack-sources-dot', (e: any) => {
          const props = e.features?.[0]?.properties;
          if (!props?.country) return;
          setSelectedCountry(props.country);
          setSomaliaPanel(false);
        });

        // Cursor affordance on source dots
        map.on('mouseenter', 'attack-sources-dot', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'attack-sources-dot', () => {
          map.getCanvas().style.cursor = '';
        });

        // Somalia click detection (bounding box: Lat 0–12°N, Lng 41–51°E)
        map.on('click', (e: any) => {
          const { lat, lng } = e.lngLat;
          if (lat >= 0 && lat <= 12 && lng >= 41 && lng <= 51) {
            setSelectedCountry(null);
            setSomaliaPanel(true);
          }
        });

        // ── Country hover tooltip ──────────────────────────────────────
        const hoveredCountryIdRef = { current: null as number | null };
        const hoverPopup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'country-hover-popup',
          offset: 12,
        });

        // Hover highlight layer
        map.addLayer({
          id: 'country-hover-fill',
          type: 'fill',
          source: 'country-boundaries',
          'source-layer': 'country_boundaries',
          paint: {
            'fill-color': 'rgba(255,255,255,0.08)',
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0],
          },
        });

        map.on('mousemove', 'continent-fills', (e: any) => {
          if (!e.features || e.features.length === 0) return;
          map.getCanvas().style.cursor = 'pointer';

          // Clear previous hover
          if (hoveredCountryIdRef.current !== null) {
            map.setFeatureState(
              { source: 'country-boundaries', sourceLayer: 'country_boundaries', id: hoveredCountryIdRef.current },
              { hover: false }
            );
          }

          const feature = e.features[0];
          hoveredCountryIdRef.current = feature.id ?? null;

          if (feature.id !== undefined) {
            map.setFeatureState(
              { source: 'country-boundaries', sourceLayer: 'country_boundaries', id: feature.id },
              { hover: true }
            );
          }

          const countryName = feature.properties?.name_en || feature.properties?.name || '';
          if (countryName) {
            hoverPopup.setLngLat(e.lngLat).setHTML(
              `<span style="font-size:12px;font-weight:600;color:#e2e8f0;letter-spacing:0.02em">${countryName}</span>`
            ).addTo(map);
          }
        });

        map.on('mouseleave', 'continent-fills', () => {
          map.getCanvas().style.cursor = '';
          if (hoveredCountryIdRef.current !== null) {
            map.setFeatureState(
              { source: 'country-boundaries', sourceLayer: 'country_boundaries', id: hoveredCountryIdRef.current },
              { hover: false }
            );
            hoveredCountryIdRef.current = null;
          }
          hoverPopup.remove();
        });

        mapRef.current = map;
        setMapLoaded(true);
      });

      map.on('error', (e: any) => { if (!cancelled) setMapError(e?.error?.message?.includes('WebGL') ? 'Map requires WebGL. Please use a supported browser.' : 'Map failed to load.'); });
    }).catch((e: any) => { if (!cancelled) setMapError(`Failed to load map library: ${e?.message || 'Unknown error'}`); });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setMapLoaded(false); }
    };
  }, [mapToken]);

  // ── Update map source data ────────────────────────────────────────────────
  const updateMapSources = useCallback((nowMs?: number) => {
    const map = mapRef.current;
    if (!map) return;
    const now         = nowMs ?? performance.now();
    const arcs        = map.getSource('attack-arcs-source');
    const fullArcs    = map.getSource('attack-full-arcs-source');
    const sources     = map.getSource('attack-sources-source');
    const impacts     = map.getSource('attack-impact-source');
    const rings       = map.getSource('attack-ring-source');
    const projectiles = map.getSource('attack-projectiles-source');
    const flash       = map.getSource('attack-flash-source');
    if (arcs)        (arcs as any).setData(buildArcsGeoJSON(arcStatesRef.current));
    if (fullArcs)    (fullArcs as any).setData(buildFullArcsGeoJSON(arcStatesRef.current));
    if (sources)     (sources as any).setData(buildSourcesGeoJSON(arcStatesRef.current));
    if (impacts)     (impacts as any).setData(buildImpactGeoJSON(arcStatesRef.current));
    if (rings)       (rings as any).setData(buildRingsGeoJSON(arcStatesRef.current, now));
    if (projectiles) (projectiles as any).setData(buildProjectilesGeoJSON(arcStatesRef.current));
    if (flash)       (flash as any).setData(buildFlashGeoJSON(flashStatesRef.current, now));
  }, []);

  // ── Toggle layer visibility ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const vis = liveOn ? 'visible' : 'none';
    [
      'attack-full-arcs',
      'attack-arcs-glow', 'attack-arcs',
      'attack-sources-dot', 'attack-sources-label',
      'attack-ring',
      'attack-impact-solid', 'attack-impact', 'attack-impact-outer',
      'attack-projectiles-glow', 'attack-projectiles-core',
      'attack-flash',
    ].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    });
    if (!liveOn) {
      arcStatesRef.current.clear();
      flashStatesRef.current.clear();
      seenIdsRef.current.clear();
      updateMapSources();
    }
  }, [liveOn, mapLoaded, updateMapSources]);

  // ── Sync new threats into arc state ──────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !liveOn) return;
    for (const threat of threats) {
      if (seenIdsRef.current.has(threat.id)) continue;
      seenIdsRef.current.add(threat.id);
      arcStatesRef.current.set(threat.id, {
        threat,
        arcCoords: computeBezierArc(threat.source, threat.target),
        startTime: prefersReducedMotion ? performance.now() - TRAVEL_DURATION * 1000 : performance.now(),
        progress:  prefersReducedMotion ? 1 : 0,
        opacity:   1,
      });
      isDirtyRef.current = true;
    }
  }, [threats, mapLoaded, liveOn, prefersReducedMotion]);

  // ── requestAnimationFrame loop ────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;

    const tick = () => {
      const now = performance.now();
      let changed = false;

      for (const [id, state] of arcStatesRef.current) {
        const elapsed = (now - state.startTime) / 1000;
        const newProgress = Math.min(elapsed / TRAVEL_DURATION, 1);
        // On arrival: trigger flash, then immediately remove arc (no fade/linger)
        if (newProgress >= 1) {
          if (!state.impacted) {
            flashStatesRef.current.set(id, {
              id,
              color:     ATTACK_COLORS[state.threat.attack_type],
              coords:    [state.threat.target.lng, state.threat.target.lat],
              startTime: now,
            });
          }
          arcStatesRef.current.delete(id);
          changed = true;
          continue;
        }

        if (state.progress !== newProgress) {
          state.progress = newProgress;
          changed = true;
        }
      }

      const hasFlashes = flashStatesRef.current.size > 0;

      // Always update rings + flash (they animate every frame) + other sources when dirty
      if (changed || isDirtyRef.current || hasFlashes) {
        isDirtyRef.current = false;
        updateMapSources(now);
      } else {
        // Still need to update rings every frame for smooth pulsing
        const map = mapRef.current;
        if (map) {
          const rings = map.getSource('attack-ring-source');
          if (rings && arcStatesRef.current.size > 0) {
            (rings as any).setData(buildRingsGeoJSON(arcStatesRef.current, now));
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mapLoaded, updateMapSources]);

  // ── Time ago helper ──────────────────────────────────────────────────────
  const timeAgo = (ts: number) => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 5)  return 'just now';
    if (sec < 60) return `${sec}s ago`;
    return `${Math.floor(sec / 60)}m ago`;
  };

  const SEV_COLORS: Record<string, string> = {
    critical: '#ef4444',
    high:     '#f97316',
    medium:   '#facc15',
    low:      '#22d3ee',
  };

  const severityCounts = {
    critical: threats.filter(t => t.severity === 'critical').length,
    high:     threats.filter(t => t.severity === 'high').length,
    medium:   threats.filter(t => t.severity === 'medium').length,
    low:      threats.filter(t => t.severity === 'low').length,
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden">

      {/* ── Top row: map + sidebar ───────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Map container ─────────────────────────────────────────────── */}
        <div className="relative flex-1 min-w-0">

          {/* ── Mobile dot-grid background for contrast ─────────────────── */}
          <div className="absolute inset-0 z-[1] lg:hidden pointer-events-none"
               style={{
                 backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.18) 1px, transparent 1px)',
                 backgroundSize: '14px 14px',
               }} />

          {/* ── Header overlay ──────────────────────────────────────────── */}
          <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center pt-4 sm:pt-6 pb-3 sm:pb-4 pointer-events-none"
               style={{ background: window.innerWidth < 768 ? 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)' : 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
              <img src={logoSrc} alt="Logo" className="w-6 h-6 sm:w-8 sm:h-8 object-contain opacity-90 hidden sm:block" />
              <div className="text-center">
                <h1 className="text-white font-bold tracking-[0.15em] sm:tracking-[0.25em] uppercase text-xs sm:text-base font-mono"
                    style={{ textShadow: '0 0 20px rgba(34,211,238,0.6)' }}>
                  LIVE CYBER THREAT MAP
                </h1>
                <p className="hidden sm:block text-[10px] text-slate-400 tracking-widest uppercase">
                  Somalia National Cyber Defense Observatory
                </p>
              </div>
            </div>
            <div className="text-center" aria-live="polite">
              <p className="text-xl sm:text-3xl font-mono font-bold"
                 style={{ color: '#f472b6', textShadow: '0 0 20px rgba(244,114,182,0.7)' }}>
                {todayCount.toLocaleString()}
              </p>
              <p className="text-[9px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.3em] text-slate-400 uppercase mt-0.5">
                ATTACKS ON THIS DAY
              </p>
            </div>
          </div>


          {/* ── Live toggle top-right (desktop only) ─────────────────────── */}
          <div className="absolute top-4 right-4 z-20 pointer-events-auto hidden sm:block">
            <button
              onClick={() => setLiveOn(v => !v)}
              aria-pressed={liveOn}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
              style={{
                background: liveOn ? 'rgba(34,211,238,0.15)' : 'rgba(0,0,0,0.7)',
                border: `1px solid ${liveOn ? '#22d3ee' : 'rgba(255,255,255,0.15)'}`,
                color: liveOn ? '#22d3ee' : '#94a3b8',
              }}
            >
              <Zap className={`w-3 h-3 ${liveOn ? 'text-[#22d3ee]' : 'text-slate-500'}`} />
              Live
              <span className={`w-1.5 h-1.5 rounded-full ${liveOn ? 'bg-[#22d3ee] animate-pulse' : 'bg-slate-600'}`} />
            </button>
          </div>

          {/* ── Click-to-open hint ────────────────────────────────────────── */}
          {mapLoaded && !somaliaPanel && !selectedCountry && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
              style={{
                background: 'rgba(0,0,0,0.7)',
                border: '1px solid rgba(244,114,182,0.3)',
                borderRadius: 6,
                padding: '4px 12px',
              }}
            >
              <p className="text-[10px] font-mono text-pink-300 tracking-widest uppercase">
                🌐 Click Somalia or any source for stats
              </p>
            </div>
          )}

          {/* ── Mapbox canvas ─────────────────────────────────────────────── */}
          <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

          {/* ── Canvas arc overlay (drawn on top of Mapbox, pointer-events-none) ── */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ mixBlendMode: 'screen', zIndex: 5 }}
          />

          {/* ── Somalia Panel Overlay ─────────────────────────────────────── */}
          {somaliaPanel && !selectedCountry && (
            <SomaliaPanel threats={threats} onClose={() => setSomaliaPanel(false)} />
          )}

          {/* ── Country Panel Overlay ─────────────────────────────────────── */}
          {selectedCountry && (
            <CountryPanel
              country={selectedCountry}
              threats={threats}
              onClose={() => setSelectedCountry(null)}
            />
          )}

          {/* Loading overlay */}
          {!mapToken && !mapError && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#22d3ee' }} />
                <p className="text-sm font-mono text-slate-400 tracking-widest">INITIALIZING MAP...</p>
              </div>
            </div>
          )}
          {mapError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 gap-4">
              <p className="text-sm text-slate-400 font-mono">{mapError}</p>
              <button
                onClick={() => {
                  setMapError(null);
                  if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
                  setMapLoaded(false);
                }}
                className="px-4 py-2 text-xs font-mono rounded border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* ── Mobile Feed Toggle (inside map container so absolute works) ── */}
          <button
            onClick={() => setMobileFeedOpen(true)}
            className="lg:hidden absolute bottom-4 right-4 z-20 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-bold pointer-events-auto"
            style={{ background: 'rgba(10,10,20,0.9)', border: '1px solid rgba(34,211,238,0.5)', color: '#22d3ee', boxShadow: '0 0 16px rgba(34,211,238,0.2)' }}
          >
            <Zap className="w-4 h-4" />
            Feed
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.35)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}>
              {threats.length}
            </span>
          </button>
        </div>

        {/* ── Live Attack Feed Sidebar (desktop only) ───────────────────── */}
        <div
          className="hidden lg:flex w-64 xl:w-72 flex-shrink-0 flex-col overflow-hidden"
          style={{ background: '#07070f', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Sidebar header */}
          <div
            className="flex items-center justify-between px-3 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-xs font-bold font-mono tracking-widest uppercase text-white">
              ATTACKS
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 font-mono">Current rate</span>
              <span className="text-[10px] font-mono font-bold" style={{ color: '#22d3ee' }}>— {threats.length} —</span>
            </div>
          </div>

          {/* Feed entries */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {threats.slice(0, 50).map((t) => {
              const sevColor = SEV_COLORS[t.severity];
              const ts = new Date(t.timestamp);
              const timeStr = `${ts.getHours().toString().padStart(2,'0')}:${ts.getMinutes().toString().padStart(2,'0')}:${ts.getSeconds().toString().padStart(2,'0')}`;
              return (
                <div
                  key={t.id}
                  className="flex items-start gap-2 px-3 py-2 cursor-default"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  {/* Colored ring */}
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                    style={{ border: `2px solid ${sevColor}`, background: 'transparent' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white font-mono truncate">{t.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      {timeStr} {t.source.state}, {t.source.country} → {t.target.state}, {t.target.country}
                    </p>
                  </div>
                </div>
              );
            })}
            {threats.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <span className="text-slate-600 text-xs font-mono">Awaiting threats...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile Feed Drawer ─────────────────────────────────────────────── */}
      {mobileFeedOpen && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
          <div
            className="relative flex flex-col rounded-t-2xl overflow-hidden"
            style={{ height: '45vh', background: 'rgba(5, 7, 15, 0.72)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderBottom: 'none' }}
          >
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)' }}>
              <span className="text-sm font-bold font-mono tracking-widest uppercase text-white">ATTACKS</span>
              <button onClick={() => setMobileFeedOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Severity summary pills */}
            <div className="flex gap-2 px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {([
                { label: 'Crit',   key: 'critical' as const, color: '#ef4444' },
                { label: 'High',   key: 'high'     as const, color: '#f97316' },
                { label: 'Med',    key: 'medium'   as const, color: '#facc15' },
                { label: 'Low',    key: 'low'      as const, color: '#22d3ee' },
              ]).map(({ label, key, color }) => (
                <div key={key} className="flex-1 flex flex-col items-center py-1.5 rounded-lg"
                  style={{ background: `${color}0d`, border: `1px solid ${color}33` }}>
                  <span className="text-sm font-mono font-bold" style={{ color }}>{severityCounts[key]}</span>
                  <span className="text-[9px] uppercase font-mono" style={{ color: `${color}99` }}>{label}</span>
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {threats.slice(0, 30).map((t) => {
                const sevColor = SEV_COLORS[t.severity];
                const ts = new Date(t.timestamp);
                const timeStr = `${ts.getHours().toString().padStart(2,'0')}:${ts.getMinutes().toString().padStart(2,'0')}:${ts.getSeconds().toString().padStart(2,'0')}`;
                return (
                  <div
                    key={t.id}
                    className="flex items-start gap-2 px-4 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                      style={{ border: `2px solid ${sevColor}`, background: 'transparent' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-mono truncate">{t.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">
                        {timeStr} {t.source.state}, {t.source.country} → {t.target.state}, {t.target.country}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom bar: severity cards + legend (desktop only) ───────────── */}
      <div
        className="hidden lg:flex flex-shrink-0 px-4 py-2 items-center gap-2"
        style={{ background: '#050508', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
        {([
          { label: 'Critical', key: 'critical' as const },
          { label: 'High',     key: 'high'     as const },
          { label: 'Medium',   key: 'medium'   as const },
          { label: 'Low',      key: 'low'       as const },
        ]).map(({ label, key }) => (
          <div
            key={key}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg"
            style={{
              background: `${SEV_COLORS[key]}0d`,
              border: `1px solid ${SEV_COLORS[key]}33`,
            }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SEV_COLORS[key], boxShadow: `0 0 5px ${SEV_COLORS[key]}` }} />
            <span className="text-base sm:text-lg font-mono font-bold tabular-nums" style={{ color: SEV_COLORS[key] }}>
              {severityCounts[key]}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wide" style={{ color: `${SEV_COLORS[key]}99` }}>
              {label}
            </span>
          </div>
        ))}

        {/* Divider + legend (desktop only) */}
        <div className="hidden lg:block w-px h-6 mx-2 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="hidden lg:flex flex-wrap gap-x-4 gap-y-1 flex-1">
          {(Object.entries(ATTACK_LABELS) as [AttackType, string][]).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: ATTACK_COLORS[type] }} />
              <span className="text-[10px] font-mono text-slate-400">{label}</span>
            </div>
          ))}
        </div>

        {/* Live indicator */}
        {liveOn && (
          <div className="hidden lg:flex items-center gap-1.5 ml-auto flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Live</span>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default CyberMap;
