import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Loader2, Map, Activity, RefreshCw, X } from 'lucide-react';
import { useLiveAttacks, LiveThreat, AttackType } from '@/hooks/useLiveAttacks';

// ── Constants ──────────────────────────────────────────────────────────────────

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

const TRAVEL_DURATION = 2.5;
const VISIBLE_DURATION = 8;
const FADE_DURATION    = 2;
const ARC_STEPS        = 50;

const POPUP_STYLE = `
  background: hsl(216 28% 12% / 0.97);
  border: 1px solid hsl(216 28% 22%);
  color: hsl(210 40% 95%);
  border-radius: 8px;
  padding: 12px 14px;
  font-family: Inter, system-ui, sans-serif;
  min-width: 200px;
  max-width: 280px;
`;

// ── Types ──────────────────────────────────────────────────────────────────────

interface MapPoint {
  lat: number;
  lng: number;
  severity: string;
  count: number;
  region?: string;
  sector?: string;
}

// ── Arc State ──────────────────────────────────────────────────────────────────

interface ArcState {
  threat:    LiveThreat;
  arcCoords: [number, number][];
  startTime: number;
  progress:  number;
  opacity:   number;
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

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapboxglRef = useRef<any>(null);

  // Arc animation refs
  const arcStatesRef = useRef<globalThis.Map<string, ArcState>>(new globalThis.Map());
  const rafRef       = useRef<number>(0);
  const isDirtyRef   = useRef(false);
  const seenIdsRef   = useRef<globalThis.Set<string>>(new globalThis.Set());

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

  // ── 2. Initialize Mapbox (static, locked) ─────────────────────────────────
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
        interactive: false,       // ← static map, no pan/zoom
        pitchWithRotate: false,
        dragRotate: false,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => {
        if (cancelled) return;

        const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

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

        // ── Attack arc layers (on top of alert dots) ──────────────────────
        map.addSource('attack-arcs-source',    { type: 'geojson', data: emptyFC });
        map.addSource('attack-sources-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-impact-source',  { type: 'geojson', data: emptyFC });

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
            'line-width': 2,
            'line-opacity': ['get', 'opacity'],
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

        // Impact rings at Somalia targets
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

  // ── 5. Sync new threats into arc state ────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
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
  }, [threats, mapLoaded, prefersReducedMotion]);

  // ── 6. requestAnimationFrame loop ─────────────────────────────────────────
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
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-4 min-h-0">

        {/* Map */}
        <div
          className="relative glass-card rounded-xl border border-border overflow-hidden"
          role="application"
          aria-label="Live cyber threat map showing attacks targeting Somalia"
        >
          {/* Loading */}
          {!mapToken && !mapError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60">
              <Loader2 className="w-8 h-8 animate-spin text-primary opacity-70" />
              <p className="text-sm font-mono text-muted-foreground">Initializing map...</p>
            </div>
          )}

          {/* Error */}
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
          {/* Alert hotspots feed */}
          <div className="glass-card rounded-xl border border-border flex flex-col flex-1 min-h-0">
            <div className="p-3 border-b border-border flex items-center gap-2 flex-shrink-0">
              <Activity className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-semibold">Alert Hotspots</h3>
              {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
              {!isLoading && (
                <span className="ml-auto text-xs font-mono text-muted-foreground">{totalAlerts} total</span>
              )}
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-border/50">
              {mapPoints.length === 0 && !isLoading ? (
                <div className="p-6 text-center text-muted-foreground text-xs">No alert data available</div>
              ) : (
                mapPoints.slice(0, 12).map((point, idx) => (
                  <div key={idx} className="p-3">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded font-mono border"
                        style={{
                          color: SEVERITY_COLORS[point.severity],
                          borderColor: `${SEVERITY_COLORS[point.severity]}40`,
                          background: `${SEVERITY_COLORS[point.severity]}18`,
                        }}
                      >
                        {point.severity}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {point.count} alert{point.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground">{point.region ?? 'Somalia'}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{point.sector ?? 'government'}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Severity breakdown */}
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
