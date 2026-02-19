import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Loader2, Map, Activity, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#facc15',
  low: '#3b82f6',
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;

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

function severityBadge(sev: string) {
  const colorMap: Record<string, string> = {
    critical: 'background:#ef444422;color:#ef4444;border:1px solid #ef444440',
    high:     'background:#f9731622;color:#f97316;border:1px solid #f9731640',
    medium:   'background:#facc1522;color:#facc15;border:1px solid #facc1540',
    low:      'background:#3b82f622;color:#3b82f6;border:1px solid #3b82f640',
  };
  const style = colorMap[sev] || colorMap.low;
  return `<span style="font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:4px;font-family:monospace;${style}">${sev}</span>`;
}

interface MapPoint {
  lat: number;
  lng: number;
  severity: string;
  count: number;
  region?: string;
  sector?: string;
}

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

function mapPointsToGeoJSON(points: MapPoint[], sevFilter: SeverityFilter): GeoJSON.FeatureCollection {
  const filtered = sevFilter === 'all' ? points : points.filter(p => p.severity === sevFilter);
  return {
    type: 'FeatureCollection',
    features: filtered.map(p => ({
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

const ThreatMap: React.FC = () => {
  const [sevFilter, setSevFilter] = useState<SeverityFilter>('all');

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
  const hovPopupRef = useRef<any>(null);
  const clickPopupRef = useRef<any>(null);
  const pulseMarkersRef = useRef<any[]>([]);
  const mapboxglRef = useRef<any>(null);

  const geojson = useMemo(() => mapPointsToGeoJSON(mapPoints, sevFilter), [mapPoints, sevFilter]);

  // ── 1. Fetch public stats (token + map points) ──────────────────────────
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

  // ── 2. Initialize Mapbox once ───────────────────────────────────────────
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
        zoom: 5,
        projection: 'mercator',
        pitchWithRotate: false,
        dragRotate: false,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => {
        if (cancelled) return;

        map.addSource('alerts-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
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

        map.on('click', 'alerts-clusters', (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['alerts-clusters'] });
          if (!features.length) return;
          const clusterId = features[0].properties.cluster_id;
          (map.getSource('alerts-source') as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) return;
            map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: zoom + 1 });
          });
        });

        map.on('click', 'alerts-unclustered', (e: any) => {
          const feat = e.features?.[0];
          if (!feat) return;
          const p = feat.properties;
          clickPopupRef.current?.remove();

          const html = `
            <div style="${POPUP_STYLE}">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                ${severityBadge(p.severity)}
                <span style="font-size:10px;color:hsl(215 20% 55%);font-family:monospace;">OPEN</span>
              </div>
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;line-height:1.35;">${p.count} active alert${p.count !== 1 ? 's' : ''} in this area</p>
              <p style="margin:0 0 2px;font-size:11px;color:hsl(215 20% 55%);">📍 ${p.region} · ${p.sector}</p>
              <p style="margin:0;font-size:10px;color:hsl(215 20% 40%);font-family:monospace;">Public read-only view</p>
            </div>`;

          clickPopupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: '300px', className: 'threat-popup' })
            .setLngLat((feat.geometry as any).coordinates.slice())
            .setHTML(html)
            .addTo(map);
        });

        map.on('mouseenter', 'alerts-unclustered', (e: any) => {
          map.getCanvas().style.cursor = 'pointer';
          const feat = e.features?.[0];
          if (!feat) return;
          const p = feat.properties;
          hovPopupRef.current?.remove();
          hovPopupRef.current = new mapboxgl.Popup({
            closeButton: false,
            className: 'threat-tooltip',
            offset: 10,
          })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="${POPUP_STYLE}padding:8px 10px;min-width:160px;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                  ${severityBadge(p.severity)}
                </div>
                <p style="margin:0 0 2px;font-size:12px;font-weight:600;">${p.count} alert${p.count !== 1 ? 's' : ''}</p>
                <p style="margin:0;font-size:10px;color:hsl(215 20% 55%);">${p.region} · ${p.sector}</p>
              </div>`)
            .addTo(map);
        });

        map.on('mouseleave', 'alerts-unclustered', () => {
          map.getCanvas().style.cursor = '';
          hovPopupRef.current?.remove();
          hovPopupRef.current = null;
        });

        map.on('mouseenter', 'alerts-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'alerts-clusters', () => { map.getCanvas().style.cursor = ''; });

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
      hovPopupRef.current?.remove();
      clickPopupRef.current?.remove();
      pulseMarkersRef.current.forEach((m) => m.remove());
      pulseMarkersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        mapboxglRef.current = null;
        setMapLoaded(false);
      }
    };
  }, [mapToken, retryKey]);

  // ── 3. Push GeoJSON data to map ──────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    const timer = setTimeout(() => {
      const map = mapRef.current;
      if (!map || !map.getSource('alerts-source')) return;

      (map.getSource('alerts-source') as any).setData(geojson);

      if (geojson.features.length > 0) {
        const mapboxgl = mapboxglRef.current;
        if (!mapboxgl) return;
        const bounds = new mapboxgl.LngLatBounds();
        geojson.features.forEach((f: any) => bounds.extend(f.geometry.coordinates));
        map.fitBounds(bounds, { padding: 80, maxZoom: 9, duration: 600 });
      } else {
        map.flyTo({ center: [46, 5.5], zoom: 5, duration: 600 });
      }

      // Pulse markers for critical alerts (cap at 15)
      pulseMarkersRef.current.forEach((m) => m.remove());
      pulseMarkersRef.current = [];

      const mapboxgl = mapboxglRef.current;
      if (!mapboxgl) return;

      const criticals = mapPoints.filter(p => p.severity === 'critical').slice(0, 15);
      for (const point of criticals) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative;width:12px;height:12px;pointer-events:none;';
        const ring = document.createElement('div');
        ring.className = 'critical-pulse-ring';
        wrapper.appendChild(ring);
        const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'center' })
          .setLngLat([point.lng, point.lat])
          .addTo(map);
        pulseMarkersRef.current.push(marker);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [geojson, mapLoaded, mapPoints]);

  const hasAlerts = geojson.features.length > 0;

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 100px)', minHeight: '600px' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Threat Map</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? 'Loading...' : `${totalAlerts} open alerts · ${geojson.features.length} mapped · Public view`}
          </p>
        </div>
        {/* Live severity counters */}
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

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 flex-shrink-0" role="group" aria-label="Alert filters">
        <div className="flex gap-1 p-1 bg-muted rounded-lg" role="radiogroup" aria-label="Severity filter">
          {(['all', 'critical', 'high', 'medium', 'low'] as SeverityFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setSevFilter(s)}
              aria-pressed={sevFilter === s}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded transition-all capitalize',
                sevFilter === s
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {sevFilter !== 'all' && (
          <button
            onClick={() => setSevFilter('all')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg border border-border bg-muted transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* ── Map + Sidebar ──────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-4 min-h-0">
        {/* Map container */}
        <div
          className="relative glass-card rounded-xl border border-border overflow-hidden"
          role="application"
          aria-label="Interactive threat map showing alert locations across Somalia"
        >
          {/* Loading state */}
          {!mapToken && !mapError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60">
              <Loader2 className="w-8 h-8 animate-spin text-primary opacity-70" />
              <p className="text-sm font-mono text-muted-foreground">Initializing map...</p>
            </div>
          )}

          {/* Error state */}
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

          {/* Empty state overlay */}
          {mapLoaded && !hasAlerts && !isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <Map className="w-10 h-10 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground opacity-60">No alerts match current filters</p>
            </div>
          )}

          <div ref={mapContainer} className="w-full h-full" />

          {/* Legend — floating bottom-left */}
          {mapLoaded && (
            <div className="absolute bottom-4 left-4 z-10 glass-card rounded-lg p-3 border border-border text-xs space-y-1.5">
              <p className="text-muted-foreground font-mono font-semibold text-[10px] uppercase tracking-wider mb-2">Legend</p>
              {SEVERITY_ORDER.map((sev) => (
                <div key={sev} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full border border-white/30"
                      style={{ background: SEVERITY_COLORS[sev] }}
                    />
                    <span className="text-muted-foreground capitalize">{sev}</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">{severityCounts[sev] ?? 0}</span>
                </div>
              ))}
              <div className="pt-1.5 border-t border-border flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full border border-primary/60 bg-background/50 flex items-center justify-center">
                  <span className="text-primary font-mono text-[8px] font-bold">N</span>
                </div>
                <span className="text-muted-foreground">Cluster (tap to expand)</span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          {/* Alert summary feed */}
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
                <div className="p-6 text-center text-muted-foreground text-xs">
                  No alert data available
                </div>
              ) : (
                mapPoints.slice(0, 12).map((point, idx) => (
                  <div
                    key={idx}
                    className="p-3"
                  >
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
                    <p className="text-xs font-medium text-foreground">
                      {point.region ?? 'Somalia'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                      {point.sector ?? 'government'}
                    </p>
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
