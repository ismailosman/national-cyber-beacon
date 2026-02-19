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

const DEFAULT_PERCENTAGES: Record<AttackType, number> = {
  malware:   31.2,
  phishing:  18.7,
  exploit:   14.3,
  ddos:       9.8,
  intrusion:  5.1,
};

const TRAVEL_DURATION = 2.5;
const VISIBLE_DURATION = 8;
const FADE_DURATION    = 2;
const ARC_STEPS        = 50;

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

function genSparkline(seed: number, color: string) {
  const rand = seededRand(seed);
  return Array.from({ length: 15 }, (_, i) => ({
    i,
    v: Math.round(20 + rand() * 80 + Math.sin(i / 2.5) * 25),
  }));
}

const TREND_30 = gen30DayData();
const SPARKLINES: Record<AttackType, { i: number; v: number }[]> = {
  malware:   genSparkline(111, '#ef4444'),
  phishing:  genSparkline(222, '#a855f7'),
  exploit:   genSparkline(333, '#f97316'),
  ddos:      genSparkline(444, '#facc15'),
  intrusion: genSparkline(555, '#22d3ee'),
};

// ── Somalia Panel ─────────────────────────────────────────────────────────────

interface SomaliaPanelProps {
  threats: LiveThreat[];
  onClose: () => void;
}

const SomaliaPanel: React.FC<SomaliaPanelProps> = ({ threats, onClose }) => {
  // Compute live percentages from threat stream, fall back to defaults
  const percentages = React.useMemo<Record<AttackType, number>>(() => {
    if (threats.length < 10) return DEFAULT_PERCENTAGES;
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
        width: 320,
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
          <span className="text-xl">🇸🇴</span>
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
                  <LineChart data={SPARKLINES[type]} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
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
}

// ── GeoJSON builders ──────────────────────────────────────────────────────────

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

// ── Main Component ─────────────────────────────────────────────────────────────

const CyberMap: React.FC = () => {
  const [mapToken, setMapToken]       = useState<string | null>(null);
  const [mapError, setMapError]       = useState<string | null>(null);
  const [mapLoaded, setMapLoaded]     = useState(false);
  const [liveOn, setLiveOn]           = useState(true);
  const [somaliaPanel, setSomaliaPanel] = useState(false);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const mapboxglRef  = useRef<any>(null);
  const arcStatesRef = useRef<Map<string, ArcState>>(new Map());
  const rafRef       = useRef<number>(0);
  const isDirtyRef   = useRef(false);
  const seenIdsRef   = useRef<Set<string>>(new Set());

  const { threats, todayCount } = useLiveAttacks(liveOn);

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

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [20, 10],
        zoom: 2,
        projection: 'mercator',
        pitchWithRotate: false,
        dragRotate: false,
        attributionControl: false,
        interactive: false,
      });

      map.on('load', () => {
        if (cancelled) return;

        const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

        map.addSource('attack-arcs-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-sources-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-impact-source', { type: 'geojson', data: emptyFC });

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
            'line-width': 2,
            'line-opacity': ['get', 'opacity'],
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

        // Impact circles at Somalia targets
        map.addLayer({
          id: 'attack-impact',
          type: 'circle',
          source: 'attack-impact-source',
          paint: {
            'circle-radius': ['+', 7, ['/', ['get', 'count'], 1]],
            'circle-color': 'transparent',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#f472b6',
            'circle-opacity': 0.8,
          },
        });

        // Somalia click detection (bounding box: Lat 0–12°N, Lng 41–51°E)
        map.on('click', (e: any) => {
          const { lat, lng } = e.lngLat;
          if (lat >= 0 && lat <= 12 && lng >= 41 && lng <= 51) {
            setSomaliaPanel(true);
          }
        });

        mapRef.current = map;
        setMapLoaded(true);
      });

      map.on('error', () => { if (!cancelled) setMapError('Map failed to load.'); });
    }).catch(() => { if (!cancelled) setMapError('Map library error.'); });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setMapLoaded(false); }
    };
  }, [mapToken]);

  // ── Update map source data ────────────────────────────────────────────────
  const updateMapSources = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const arcs    = map.getSource('attack-arcs-source');
    const sources = map.getSource('attack-sources-source');
    const impacts = map.getSource('attack-impact-source');
    if (arcs)    (arcs as any).setData(buildArcsGeoJSON(arcStatesRef.current));
    if (sources) (sources as any).setData(buildSourcesGeoJSON(arcStatesRef.current));
    if (impacts) (impacts as any).setData(buildImpactGeoJSON(arcStatesRef.current));
  }, []);

  // ── Toggle layer visibility ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const vis = liveOn ? 'visible' : 'none';
    ['attack-arcs-glow', 'attack-arcs', 'attack-sources-dot', 'attack-sources-label', 'attack-impact'].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    });
    if (!liveOn) {
      arcStatesRef.current.clear();
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
        startTime: prefersReducedMotion ? Date.now() - TRAVEL_DURATION * 1000 : Date.now(),
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
        const newOpacity  = elapsed > (VISIBLE_DURATION - FADE_DURATION)
          ? Math.max(0, 1 - (elapsed - (VISIBLE_DURATION - FADE_DURATION)) / FADE_DURATION)
          : 1;

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
        updateMapSources();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mapLoaded, updateMapSources]);

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">

      {/* ── Header overlay ───────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center pt-6 pb-4 pointer-events-none"
           style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>

        <div className="flex items-center gap-3 mb-2">
          <img src={logoSrc} alt="Logo" className="w-8 h-8 object-contain opacity-90" />
          <div className="text-center">
            <h1 className="text-white font-bold tracking-[0.25em] uppercase text-base sm:text-lg font-mono"
                style={{ textShadow: '0 0 20px rgba(34,211,238,0.6)' }}>
              LIVE CYBER THREAT MAP
            </h1>
            <p className="text-[10px] text-slate-400 tracking-widest uppercase">
              Somalia National Cyber Defense Observatory
            </p>
          </div>
        </div>

        <div className="text-center" aria-live="polite" aria-label={`Live attacks today: ${todayCount.toLocaleString()}`}>
          <p className="text-2xl sm:text-3xl font-mono font-bold"
             style={{ color: '#f472b6', textShadow: '0 0 20px rgba(244,114,182,0.7)' }}>
            {todayCount.toLocaleString()}
          </p>
          <p className="text-[10px] tracking-[0.3em] text-slate-400 uppercase mt-0.5">
            ATTACKS ON THIS DAY
          </p>
        </div>
      </div>

      {/* ── Nav buttons top-left ─────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
        <Link
          to="/public"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:text-white transition-colors"
          style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <Globe className="w-3 h-3" /> Public Dashboard
        </Link>
        <Link
          to="/login"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:text-white transition-colors"
          style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <Shield className="w-3 h-3" /> Analyst Login
        </Link>
      </div>

      {/* ── Live toggle top-right ────────────────────────────────────────── */}
      <div className="absolute top-4 right-16 z-20 pointer-events-auto">
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
          Live Attack Layer
          <span className={`w-1.5 h-1.5 rounded-full ${liveOn ? 'bg-[#22d3ee] animate-pulse' : 'bg-slate-600'}`} />
        </button>
      </div>

      {/* ── Click-to-open Somalia hint ───────────────────────────────────── */}
      {mapLoaded && !somaliaPanel && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          style={{
            background: 'rgba(0,0,0,0.7)',
            border: '1px solid rgba(244,114,182,0.3)',
            borderRadius: 6,
            padding: '4px 12px',
          }}
        >
          <p className="text-[10px] font-mono text-pink-300 tracking-widest uppercase">
            🇸🇴 Click Somalia for attack stats
          </p>
        </div>
      )}

      {/* ── Mapbox canvas ─────────────────────────────────────────────────── */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* ── Somalia Panel Overlay ─────────────────────────────────────────── */}
      {somaliaPanel && (
        <SomaliaPanel threats={threats} onClose={() => setSomaliaPanel(false)} />
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
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/90">
          <p className="text-sm text-slate-400 font-mono">{mapError}</p>
        </div>
      )}

      {/* ── Bottom legend ─────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pb-6 pt-8 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
      >
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {(Object.entries(ATTACK_LABELS) as [AttackType, string][]).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: ATTACK_COLORS[type], boxShadow: `0 0 6px ${ATTACK_COLORS[type]}` }}
              />
              <span className="text-xs font-mono text-slate-300 tracking-wide">{label}</span>
            </div>
          ))}
        </div>

        {liveOn && (
          <div className="mt-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">
              Live simulation active
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CyberMap;
