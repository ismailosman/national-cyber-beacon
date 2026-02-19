import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Loader2, Activity, RefreshCw, Zap, X } from 'lucide-react';
import { useLiveAttacks, LiveThreat, AttackType } from '@/hooks/useLiveAttacks';
import { AreaChart, Area, LineChart, Line, ResponsiveContainer } from 'recharts';

// ── Constants ──────────────────────────────────────────────────────────────────

const COUNTRY_ISO: Record<string, string> = {
  'China': 'cn', 'Russia': 'ru', 'Iran': 'ir', 'North Korea': 'kp',
  'USA': 'us', 'Netherlands': 'nl', 'Germany': 'de', 'Ukraine': 'ua',
  'Brazil': 'br', 'India': 'in', 'Nigeria': 'ng', 'Pakistan': 'pk',
  'Vietnam': 'vn', 'Romania': 'ro', 'Turkey': 'tr', 'South Korea': 'kr',
  'Indonesia': 'id', 'France': 'fr', 'UK': 'gb', 'Saudi Arabia': 'sa',
  'Egypt': 'eg', 'Singapore': 'sg', 'Canada': 'ca', 'Japan': 'jp',
  'Israel': 'il', 'Somalia': 'so',
};

const ATTACK_LABELS: Record<AttackType, string> = {
  malware: 'Malware', phishing: 'Phishing', exploit: 'Exploit',
  ddos: 'DDoS', intrusion: 'Intrusion',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#facc15',
  low: '#3b82f6',
};

const ATTACK_COLORS: Record<AttackType, string> = {
  malware:   '#ef4444',
  phishing:  '#a855f7',
  exploit:   '#f97316',
  ddos:      '#facc15',
  intrusion: '#22d3ee',
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;

const TRAVEL_DURATION  = 2.0;
const VISIBLE_DURATION = 15;
const FADE_DURATION    = 3;
const ARC_STEPS        = 50;
const RING_PERIOD      = 2000;
const FLASH_DURATION   = 600; // ms
const MAX_FEED_ENTRIES = 40;

const COUNTRY_FLAGS: Record<string, string> = {
  'China': '🇨🇳', 'Russia': '🇷🇺', 'Iran': '🇮🇷', 'North Korea': '🇰🇵',
  'USA': '🇺🇸', 'Netherlands': '🇳🇱', 'Germany': '🇩🇪', 'Ukraine': '🇺🇦',
  'Brazil': '🇧🇷', 'India': '🇮🇳', 'Nigeria': '🇳🇬', 'Pakistan': '🇵🇰',
  'Vietnam': '🇻🇳', 'Romania': '🇷🇴', 'Turkey': '🇹🇷', 'South Korea': '🇰🇷',
  'Indonesia': '🇮🇩', 'France': '🇫🇷', 'UK': '🇬🇧', 'Saudi Arabia': '🇸🇦',
  'Egypt': '🇪🇬', 'Singapore': '🇸🇬', 'Canada': '🇨🇦', 'Japan': '🇯🇵',
  'Israel': '🇮🇱',
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface MapPoint {
  lat: number;
  lng: number;
  severity: string;
  count: number;
  region?: string;
  sector?: string;
}

interface FeedEntry {
  id: string;
  timestamp: number;
  country: string;
  attack_type: AttackType;
  severity: string;
}

// ── Arc State ──────────────────────────────────────────────────────────────────

interface ArcState {
  threat:    LiveThreat;
  arcCoords: [number, number][];
  startTime: number;
  progress:  number;
  opacity:   number;
  flashed:   boolean;
}

interface FlashState {
  lng: number;
  lat: number;
  startTime: number;
}

// ── Bezier arc math ────────────────────────────────────────────────────────────

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

// ── GeoJSON builders ───────────────────────────────────────────────────────────

function buildArcsGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.progress <= 0) continue;
    const sliceEnd = Math.max(2, Math.ceil(state.progress * state.arcCoords.length));
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: state.arcCoords.slice(0, sliceEnd) },
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
    if (state.opacity <= 0) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: state.arcCoords },
      properties: {
        color:   ATTACK_COLORS[state.threat.attack_type],
        opacity: state.opacity,
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

function buildImpactGeoJSON(states: globalThis.Map<string, ArcState>): GeoJSON.FeatureCollection {
  const targetMap = new globalThis.Map<string, { lng: number; lat: number; count: number }>();
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

function buildRingsGeoJSON(states: globalThis.Map<string, ArcState>, now: number): GeoJSON.FeatureCollection {
  const seenCountries = new globalThis.Map<string, { lng: number; lat: number; color: string; firstSeen: number }>();
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
  for (const [, info] of seenCountries) {
    for (const offset of [0, RING_PERIOD / 2]) {
      const t = ((now - info.firstSeen + offset) % RING_PERIOD) / RING_PERIOD;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [info.lng, info.lat] },
        properties: {
          radius: 4 + t * 22,
          ringOpacity: (1 - t) * 0.85,
          color: info.color,
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

function buildProjectileGeoJSON(states: globalThis.Map<string, ArcState>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.progress >= 1 || state.progress <= 0.01) continue;
    const sliceEnd = Math.max(2, Math.ceil(state.progress * state.arcCoords.length));
    const tip = state.arcCoords[sliceEnd - 1];
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: tip },
      properties: { color: ATTACK_COLORS[state.threat.attack_type] },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildFlashGeoJSON(flashes: globalThis.Map<string, FlashState>, now: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const [, flash] of flashes) {
    const t = (now - flash.startTime) / FLASH_DURATION;
    if (t >= 1) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [flash.lng, flash.lat] },
      properties: {
        radius: 5 + t * 30,
        flashOpacity: (1 - t) * 0.9,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function mapPointsToGeoJSON(points: MapPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        severity: p.severity,
        count: p.count,
        region: p.region ?? 'Somalia',
        sector: p.sector ?? 'government',
      },
    })),
  };
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Seeded PRNG helpers ────────────────────────────────────────────────────────

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function genCountry30DayData(country: string) {
  let seed = 0;
  for (let i = 0; i < country.length; i++) seed = (seed * 31 + country.charCodeAt(i)) | 0;
  const rand = seededRand(Math.abs(seed) || 0xabcdef);
  return Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    value: Math.round(200 + Math.sin(i / 3.5) * 400 + rand() * 600 + (i > 15 ? rand() * 900 : 0)),
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

const ATTACK_COLORS_MAP: Record<AttackType, string> = {
  malware: '#ef4444', phishing: '#a855f7', exploit: '#f97316', ddos: '#facc15', intrusion: '#22d3ee',
};

// ── Country Panel ──────────────────────────────────────────────────────────────

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
        right: 16, top: 16, width: 300, maxHeight: 'calc(90vh)',
        background: 'rgba(10,10,20,0.96)',
        backdropFilter: 'blur(14px)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: '3px solid #f97316',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <img src={`https://flagcdn.com/w40/${iso}.png`} alt={`${country} flag`} className="w-6 h-4 object-cover rounded-sm" />
          <div>
            <span className="text-white font-bold text-sm tracking-wide">{country}</span>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">Source of Attacks</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-0.5" style={{ color: '#f97316' }}>ATTACK VOLUME</p>
        <p className="text-[10px] text-slate-500 mb-3">Last 30 days</p>
        <div style={{ height: 100, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`tmGrad-${iso}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={1.5} fill={`url(#tmGrad-${iso})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px' }} />

      <div className="px-4 pt-3 pb-4">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-0.5" style={{ color: '#f97316' }}>ATTACK TYPES</p>
        <p className="text-[10px] text-slate-500 mb-3">From this source</p>
        <div className="flex flex-col gap-3">
          {(Object.keys(ATTACK_LABELS) as AttackType[]).map((type) => (
            <div key={type} className="flex items-center gap-2">
              <span className="text-xs text-slate-300 w-20 flex-shrink-0">{ATTACK_LABELS[type]}</span>
              <div style={{ width: 60, height: 28, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklines[type]} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                    <Line type="monotone" dataKey="v" stroke={ATTACK_COLORS_MAP[type]} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <span className="text-xs font-mono font-bold ml-auto flex-shrink-0" style={{ color: ATTACK_COLORS_MAP[type] }}>
                {percentages[type].toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const ThreatMap: React.FC = () => {
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [severityCounts, setSeverityCounts] = useState<Record<string, number>>({ critical: 0, high: 0, medium: 0, low: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapboxglRef = useRef<any>(null);

  // Arc animation refs
  const arcStatesRef   = useRef<globalThis.Map<string, ArcState>>(new globalThis.Map());
  const flashStatesRef = useRef<globalThis.Map<string, FlashState>>(new globalThis.Map());
  const rafRef         = useRef<number>(0);
  const isDirtyRef     = useRef(false);
  const seenIdsRef     = useRef<globalThis.Set<string>>(new globalThis.Set());

  const { threats, todayCount } = useLiveAttacks(true);

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const geojson = useMemo(() => mapPointsToGeoJSON(mapPoints), [mapPoints]);

  // ── 1. Fetch public stats ──────────────────────────────────────────────────
  useEffect(() => {
    setMapError(null);
    setMapToken(null);
    setIsLoading(true);

    let cancelled = false;

    supabase.functions.invoke('public-stats').then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setMapError('Failed to load map data.');
        setIsLoading(false);
        return;
      }
      if (data.mapbox_token) setMapToken(data.mapbox_token);
      if (data.map_points) setMapPoints(data.map_points as MapPoint[]);
      if (data.total_open_alerts) setTotalAlerts(data.total_open_alerts);
      if (data.severity_counts) setSeverityCounts(data.severity_counts);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [retryKey]);

  // ── 2. Initialize Mapbox ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapToken || !mapContainer.current || mapRef.current) return;

    let cancelled = false;

    import('mapbox-gl').then((mod) => {
      if (cancelled || !mapContainer.current) return;
      const mapboxgl = mod.default;
      mapboxglRef.current = mapboxgl;
      mapboxgl.accessToken = mapToken;

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [46, 5.5],
        zoom: 3.5,
        projection: 'mercator',
        interactive: true,
        scrollZoom: false,
        boxZoom: false,
        dragPan: false,
        dragRotate: false,
        doubleClickZoom: false,
        touchZoomRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => {
        if (cancelled) return;

        const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

        // ── Somalia highlight (light blue) ────────────────────────────────
        map.addSource('somalia-boundaries', {
          type: 'vector',
          url: 'mapbox://mapbox.country-boundaries-v1',
        });
        map.addLayer({
          id: 'somalia-highlight',
          type: 'fill',
          source: 'somalia-boundaries',
          'source-layer': 'country_boundaries',
          filter: ['==', ['get', 'name_en'], 'Somalia'],
          paint: {
            'fill-color': '#38bdf8',
            'fill-opacity': 0.25,
          },
        });
        map.addLayer({
          id: 'somalia-outline',
          type: 'line',
          source: 'somalia-boundaries',
          'source-layer': 'country_boundaries',
          filter: ['==', ['get', 'name_en'], 'Somalia'],
          paint: {
            'line-color': '#38bdf8',
            'line-width': 1.5,
            'line-opacity': 0.8,
          },
        });

        // ── Alert dot layers ──────────────────────────────────────────────
        map.addSource('alerts-source', {
          type: 'geojson',
          data: emptyFC,
          cluster: true,
          clusterRadius: 40,
          clusterMaxZoom: 10,
        });

        map.addLayer({
          id: 'alerts-clusters',
          type: 'circle',
          source: 'alerts-source',
          filter: ['has', 'point_count'],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 14, 14, 22],
            'circle-color': '#0f172a',
            'circle-stroke-color': '#00e5ff',
            'circle-stroke-width': 1.5,
            'circle-opacity': 0.92,
          },
        });

        map.addLayer({
          id: 'alerts-cluster-count',
          type: 'symbol',
          source: 'alerts-source',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 11,
          },
          paint: { 'text-color': '#ffffff' },
        });

        map.addLayer({
          id: 'alerts-unclustered',
          type: 'circle',
          source: 'alerts-source',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 5, 10, 9, 16, 12],
            'circle-color': [
              'match', ['get', 'severity'],
              'critical', '#ef4444',
              'high',     '#f97316',
              'medium',   '#facc15',
              'low',      '#3b82f6',
              '#94a3b8',
            ],
            'circle-opacity': 0.88,
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(255,255,255,0.7)',
          },
        });

        // ── Attack arc layers ─────────────────────────────────────────────
        map.addSource('attack-arcs-source',    { type: 'geojson', data: emptyFC });
        map.addSource('attack-full-arcs-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-sources-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-impact-source',  { type: 'geojson', data: emptyFC });

        // Full arc backbone (dim dashed "rail" from source to Somalia)
        map.addLayer({
          id: 'attack-full-arcs',
          type: 'line',
          source: 'attack-full-arcs-source',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 1,
            'line-opacity': ['*', ['get', 'opacity'], 0.3],
            'line-dasharray': [3, 2],
          },
        });

        // Glow
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

        // Sharp arc
        map.addLayer({
          id: 'attack-arcs',
          type: 'line',
          source: 'attack-arcs-source',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 1.5,
            'line-opacity': ['*', ['get', 'opacity'], 0.65],
          },
        });

        // Source dots
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

        // Country labels
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

        // ── Pulsing rings ─────────────────────────────────────────────────
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

        // ── Projectile dot + glow ─────────────────────────────────────────
        map.addSource('attack-projectile-source', { type: 'geojson', data: emptyFC });

        map.addLayer({
          id: 'attack-projectile-glow',
          type: 'circle',
          source: 'attack-projectile-source',
          paint: {
            'circle-radius': 10,
            'circle-color': 'transparent',
            'circle-stroke-width': 3,
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-opacity': 0.4,
          },
        });

        map.addLayer({
          id: 'attack-projectile',
          type: 'circle',
          source: 'attack-projectile-source',
          paint: {
            'circle-radius': 4,
            'circle-color': ['get', 'color'],
            'circle-opacity': 1,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.9,
          },
        });

        // ── Impact flash ──────────────────────────────────────────────────
        map.addSource('attack-flash-source', { type: 'geojson', data: emptyFC });
        map.addLayer({
          id: 'attack-flash',
          type: 'circle',
          source: 'attack-flash-source',
          paint: {
            'circle-radius': ['get', 'radius'],
            'circle-color': 'transparent',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#f472b6',
            'circle-stroke-opacity': ['get', 'flashOpacity'],
          },
        });

        // ── Somalia bullseye impact layers ───────────────────────────────
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

        // ── Click handler on source dots ─────────────────────────────────
        map.on('click', 'attack-sources-dot', (e: any) => {
          const feature = e.features?.[0];
          if (feature?.properties?.country) {
            setSelectedCountry(feature.properties.country);
          }
        });

        map.on('mouseenter', 'attack-sources-dot', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'attack-sources-dot', () => {
          map.getCanvas().style.cursor = '';
        });

        setMapLoaded(true);
      });

      map.on('error', () => {
        if (!cancelled) setMapError('Map failed to load. Click Retry.');
      });

      mapRef.current = map;
    }).catch(() => {
      if (!cancelled) setMapError('Failed to load map library.');
    });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        mapboxglRef.current = null;
        setMapLoaded(false);
      }
    };
  }, [mapToken, retryKey]);

  // ── 3. Push alert dot GeoJSON ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    const timer = setTimeout(() => {
      const map = mapRef.current;
      if (!map || !map.getSource('alerts-source')) return;
      (map.getSource('alerts-source') as any).setData(geojson);
    }, 300);

    return () => clearTimeout(timer);
  }, [geojson, mapLoaded]);

  // ── 4. Update arc map sources ──────────────────────────────────────────────
  const updateMapSources = useCallback((nowMs?: number) => {
    const map = mapRef.current;
    if (!map) return;
    const now = nowMs ?? performance.now();

    const arcs       = map.getSource('attack-arcs-source');
    const fullArcs   = map.getSource('attack-full-arcs-source');
    const sources    = map.getSource('attack-sources-source');
    const impacts    = map.getSource('attack-impact-source');
    const rings      = map.getSource('attack-ring-source');
    const projectile = map.getSource('attack-projectile-source');
    const flash      = map.getSource('attack-flash-source');

    if (arcs)       (arcs as any).setData(buildArcsGeoJSON(arcStatesRef.current));
    if (fullArcs)   (fullArcs as any).setData(buildFullArcsGeoJSON(arcStatesRef.current));
    if (sources)    (sources as any).setData(buildSourcesGeoJSON(arcStatesRef.current));
    if (impacts)    (impacts as any).setData(buildImpactGeoJSON(arcStatesRef.current));
    if (rings)      (rings as any).setData(buildRingsGeoJSON(arcStatesRef.current, now));
    if (projectile) (projectile as any).setData(buildProjectileGeoJSON(arcStatesRef.current));
    if (flash)      (flash as any).setData(buildFlashGeoJSON(flashStatesRef.current, now));
  }, []);

  // ── 5. Sync new threats into arc state + feed ─────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const newEntries: FeedEntry[] = [];
    for (const threat of threats) {
      if (seenIdsRef.current.has(threat.id)) continue;
      seenIdsRef.current.add(threat.id);
      arcStatesRef.current.set(threat.id, {
        threat,
        arcCoords: computeBezierArc(threat.source, threat.target),
        startTime: prefersReducedMotion ? Date.now() - TRAVEL_DURATION * 1000 : Date.now(),
        progress:  prefersReducedMotion ? 1 : 0,
        opacity:   1,
        flashed:   false,
      });
      newEntries.push({
        id: threat.id,
        timestamp: threat.timestamp,
        country: threat.source.country,
        attack_type: threat.attack_type,
        severity: threat.severity,
      });
      isDirtyRef.current = true;
    }
    if (newEntries.length > 0) {
      setFeedEntries(prev => [...newEntries, ...prev].slice(0, MAX_FEED_ENTRIES));
    }
  }, [threats, mapLoaded, prefersReducedMotion]);

  // ── 6. requestAnimationFrame loop ─────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;

    const tick = () => {
      const now = performance.now();
      let changed = false;

      // Clean up expired flashes
      for (const [id, flash] of flashStatesRef.current) {
        if ((now - flash.startTime) >= FLASH_DURATION) {
          flashStatesRef.current.delete(id);
          changed = true;
        }
      }

      for (const [id, state] of arcStatesRef.current) {
        const elapsed = (now - state.startTime) / 1000;
        const newProgress = Math.min(elapsed / TRAVEL_DURATION, 1);
        const newOpacity  = elapsed > (VISIBLE_DURATION - FADE_DURATION)
          ? Math.max(0, 1 - (elapsed - (VISIBLE_DURATION - FADE_DURATION)) / FADE_DURATION)
          : 1;

        // Trigger impact flash when arc reaches target
        if (newProgress >= 0.98 && !state.flashed) {
          state.flashed = true;
          flashStatesRef.current.set(id + '-flash', {
            lng: state.threat.target.lng,
            lat: state.threat.target.lat,
            startTime: now,
          });
          changed = true;
        }

        if (newOpacity <= 0) {
          arcStatesRef.current.delete(id);
          changed = true;
          continue;
        }
        if (state.progress !== newProgress || state.opacity !== newOpacity) {
          state.progress = newProgress;
          state.opacity  = newOpacity;
          changed = true;
        }
      }

      if (changed || isDirtyRef.current) {
        isDirtyRef.current = false;
        updateMapSources(now);
      } else {
        // Always update rings + projectile + flash every frame for smooth animation
        const map = mapRef.current;
        if (map) {
          const rings      = map.getSource('attack-ring-source');
          const projectile = map.getSource('attack-projectile-source');
          const flash      = map.getSource('attack-flash-source');
          if (rings && arcStatesRef.current.size > 0) {
            (rings as any).setData(buildRingsGeoJSON(arcStatesRef.current, now));
          }
          if (projectile) {
            (projectile as any).setData(buildProjectileGeoJSON(arcStatesRef.current));
          }
          if (flash && flashStatesRef.current.size > 0) {
            (flash as any).setData(buildFlashGeoJSON(flashStatesRef.current, now));
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mapLoaded, updateMapSources]);

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 100px)', minHeight: '600px' }}>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Threat Map</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? 'Loading...' : `${totalAlerts} open alerts · ${mapPoints.length} hotspots · Live attacks`}
          </p>
        </div>
        {/* Severity counters */}
        <div className="flex gap-2 flex-wrap">
          {SEVERITY_ORDER.map((sev) => (
            <div key={sev} className="glass-card rounded-lg px-3 py-1.5 border border-border flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: SEVERITY_COLORS[sev] }} />
              <span className="text-xs font-mono font-bold" style={{ color: SEVERITY_COLORS[sev] }}>{severityCounts[sev] ?? 0}</span>
              <span className="text-xs text-muted-foreground capitalize">{sev}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map + Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 min-h-0">

        {/* Map */}
        <div
          className="relative glass-card rounded-xl border border-border overflow-hidden"
          role="application"
          aria-label="Live cyber threat map showing attacks targeting Somalia"
        >
          {!mapToken && !mapError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60">
              <Loader2 className="w-8 h-8 animate-spin text-primary opacity-70" />
              <p className="text-sm font-mono text-muted-foreground">Initializing map...</p>
            </div>
          )}

          {mapError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/80">
              <AlertTriangle className="w-10 h-10 text-destructive opacity-70" />
              <p className="text-sm text-muted-foreground">{mapError}</p>
              <button
                onClick={() => setRetryKey((k) => k + 1)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          )}

          <div ref={mapContainer} className="w-full h-full" />

          {/* Country Panel overlay */}
          {selectedCountry && (
            <CountryPanel
              country={selectedCountry}
              threats={threats}
              onClose={() => setSelectedCountry(null)}
            />
          )}

          {/* Live attacks badge */}
          {mapLoaded && (
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono"
              style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(244,114,182,0.4)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
              <span style={{ color: '#f472b6' }}>{todayCount.toLocaleString()} attacks today</span>
            </div>
          )}

          {/* Legend */}
          {mapLoaded && (
            <div className="absolute bottom-4 left-4 z-10 glass-card rounded-lg p-3 border border-border text-xs space-y-1.5">
              <p className="text-muted-foreground font-mono font-semibold text-[10px] uppercase tracking-wider mb-2">Severity</p>
              {SEVERITY_ORDER.map((sev) => (
                <div key={sev} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ background: SEVERITY_COLORS[sev] }} />
                    <span className="text-muted-foreground capitalize">{sev}</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">{severityCounts[sev] ?? 0}</span>
                </div>
              ))}
              <div className="pt-1.5 border-t border-border">
                <p className="text-muted-foreground font-mono font-semibold text-[10px] uppercase tracking-wider mb-1.5">Live Attacks</p>
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  {(['malware','phishing','exploit','ddos','intrusion'] as AttackType[]).map(type => (
                    <div key={type} className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: ATTACK_COLORS[type] }} />
                      <span className="text-[9px] text-muted-foreground capitalize">{type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">

          {/* ── Live Attack Feed ──────────────────────────────────────────── */}
          <div className="glass-card rounded-xl border border-border flex flex-col flex-1 min-h-0">
            <div className="px-3 py-2.5 border-b border-border flex items-center gap-2 flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-bold text-foreground tracking-wide">Live Attack Feed</span>
              <span className="ml-auto flex items-center gap-1 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400">LIVE</span>
              </span>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-border/40" style={{ scrollbarWidth: 'thin' }}>
              {feedEntries.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs">
                  <Activity className="w-5 h-5 mx-auto mb-2 opacity-40" />
                  Waiting for attacks...
                </div>
              ) : (
                feedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="px-3 py-2 hover:bg-muted/20 transition-colors animate-fade-in"
                    style={{ borderLeft: `2px solid ${ATTACK_COLORS[entry.attack_type]}` }}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
                        {formatTime(entry.timestamp)}
                      </span>
                      <span
                        className="ml-auto text-[9px] font-bold uppercase px-1 py-0.5 rounded font-mono"
                        style={{
                          color: SEVERITY_COLORS[entry.severity],
                          background: `${SEVERITY_COLORS[entry.severity]}18`,
                          border: `1px solid ${SEVERITY_COLORS[entry.severity]}40`,
                        }}
                      >
                        {entry.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-foreground font-medium">
                        {COUNTRY_FLAGS[entry.country] ?? '🌐'} {entry.country}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-foreground font-medium">🇸🇴 Somalia</span>
                    </div>
                    <div className="mt-0.5">
                      <span
                        className="text-[9px] px-1 py-0.5 rounded font-mono capitalize"
                        style={{
                          color: ATTACK_COLORS[entry.attack_type],
                          background: `${ATTACK_COLORS[entry.attack_type]}15`,
                        }}
                      >
                        {entry.attack_type}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Severity breakdown ────────────────────────────────────────── */}
          <div className="glass-card rounded-xl border border-border p-3 flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Severity Breakdown</p>
            <div className="space-y-2">
              {SEVERITY_ORDER.map((sev) => (
                <div key={sev}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground capitalize">{sev}</span>
                    <span className="font-mono font-bold" style={{ color: SEVERITY_COLORS[sev] }}>
                      {severityCounts[sev] ?? 0}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: totalAlerts > 0 ? `${((severityCounts[sev] ?? 0) / totalAlerts) * 100}%` : '0%',
                        background: SEVERITY_COLORS[sev],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreatMap;
