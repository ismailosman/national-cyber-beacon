import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Loader2, Map, Activity, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useAlerts, type SeverityFilter, type StatusFilter, type AlertWithOrg } from '@/hooks/useAlerts';
import { alertsToGeoJSON, getAlertCoords } from '@/lib/regionCoords';

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

const ThreatMap: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Filters
  const [sevFilter, setSevFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Map state
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Refs — stable across renders
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const hovPopupRef = useRef<any>(null);
  const clickPopupRef = useRef<any>(null);
  const pulseMarkersRef = useRef<any[]>([]);
  const mapboxglRef = useRef<any>(null);

  // Data
  const { data: alerts = [], isLoading } = useAlerts({ severity: sevFilter, status: statusFilter });

  // Memoize GeoJSON — only recompute when alerts change
  const geojson = useMemo(() => alertsToGeoJSON(alerts), [alerts]);

  // Live severity counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const a of alerts) c[a.severity] = (c[a.severity] || 0) + 1;
    return c;
  }, [alerts]);

  // ── 1. Fetch map token ──────────────────────────────────────────────────────
  useEffect(() => {
    setMapError(null);
    setMapToken(null);

    let cancelled = false;

    (async () => {
      // Ensure we have a valid session before calling the authenticated edge function
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        if (!cancelled) setMapError('Session expired. Please refresh the page.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-map-token', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (cancelled) return;
      if (error || !data?.token) {
        setMapError('Failed to load map token. Check configuration.');
        return;
      }
      setMapToken(data.token);
    })();

    return () => { cancelled = true; };
  }, [retryKey]);

  // ── 2. Initialize Mapbox once ───────────────────────────────────────────────
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

        // ── Source ───────────────────────────────────────────────────────────
        map.addSource('alerts-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterRadius: 40,
          clusterMaxZoom: 10,
        });

        // ── Layer 1: Cluster circles ─────────────────────────────────────────
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

        // ── Layer 2: Cluster count labels ────────────────────────────────────
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

        // ── Layer 3: Unclustered dots ────────────────────────────────────────
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

        // ── Cluster click → zoom in ──────────────────────────────────────────
        map.on('click', 'alerts-clusters', (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['alerts-clusters'] });
          if (!features.length) return;
          const clusterId = features[0].properties.cluster_id;
          (map.getSource('alerts-source') as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) return;
            map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: zoom + 1 });
          });
        });

        // ── Unclustered dot click → popup ────────────────────────────────────
        map.on('click', 'alerts-unclustered', (e: any) => {
          const feat = e.features?.[0];
          if (!feat) return;
          const p = feat.properties;
          clickPopupRef.current?.remove();

          const ts = p.createdAt
            ? formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })
            : '';

          const html = `
            <div style="${POPUP_STYLE}">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                ${severityBadge(p.severity)}
                <span style="font-size:10px;color:hsl(215 20% 55%);font-family:monospace;">${p.status?.toUpperCase()}</span>
              </div>
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;line-height:1.35;">${p.title}</p>
              <p style="margin:0 0 2px;font-size:11px;color:hsl(215 20% 55%);">${p.orgName} · ${p.region}</p>
              <p style="margin:0 0 8px;font-size:10px;color:hsl(215 20% 45%);font-family:monospace;">${ts}</p>
              <button
                data-alert-id="${p.id}"
                style="width:100%;padding:6px 0;background:hsl(190 100% 50% / 0.12);border:1px solid hsl(190 100% 50% / 0.3);border-radius:6px;color:#00e5ff;font-size:11px;font-weight:700;cursor:pointer;font-family:monospace;letter-spacing:0.05em;"
              >View Details →</button>
            </div>`;

          clickPopupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: '300px', className: 'threat-popup' })
            .setLngLat((feat.geometry as any).coordinates.slice())
            .setHTML(html)
            .addTo(map);
        });

        // ── Hover tooltip ────────────────────────────────────────────────────
        map.on('mouseenter', 'alerts-unclustered', (e: any) => {
          map.getCanvas().style.cursor = 'pointer';
          const feat = e.features?.[0];
          if (!feat) return;
          const p = feat.properties;
          const ts = p.createdAt
            ? formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })
            : '';
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
                <p style="margin:0 0 2px;font-size:12px;font-weight:600;">${p.title}</p>
                <p style="margin:0;font-size:10px;color:hsl(215 20% 55%);">${p.orgName} · ${ts}</p>
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

  // ── Delegated click handler for popup "View Details →" buttons ────────────
  useEffect(() => {
    const container = mapContainer.current;
    if (!container) return;
    const handler = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('[data-alert-id]') as HTMLElement | null;
      if (btn) {
        const alertId = btn.getAttribute('data-alert-id');
        if (alertId) navigate(`/alerts/${alertId}`);
      }
    };
    container.addEventListener('click', handler);
    return () => container.removeEventListener('click', handler);
  }, [navigate]);

  // ── 3. Push data to map whenever alerts or filters change (debounced) ───────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    const timer = setTimeout(() => {
      const map = mapRef.current;
      if (!map || !map.getSource('alerts-source')) return;

      // Update GeoJSON source
      (map.getSource('alerts-source') as any).setData(geojson);

      // Fit bounds
      if (geojson.features.length > 0) {
        const mapboxgl = mapboxglRef.current;
        if (!mapboxgl) return;
        const bounds = new mapboxgl.LngLatBounds();
        geojson.features.forEach((f) =>
          bounds.extend((f.geometry as any).coordinates)
        );
        map.fitBounds(bounds, { padding: 80, maxZoom: 9, duration: 600 });
      } else {
        map.flyTo({ center: [46, 5.5], zoom: 5, duration: 600 });
      }

      // Pulse markers for critical alerts (cap at 15)
      pulseMarkersRef.current.forEach((m) => m.remove());
      pulseMarkersRef.current = [];

      const mapboxgl = mapboxglRef.current;
      if (!mapboxgl) return;

      const criticals = alerts.filter((a) => a.severity === 'critical').slice(0, 15);
      for (const alert of criticals) {
        const coords = getAlertCoords(alert);
        if (!coords) continue;
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative;width:12px;height:12px;pointer-events:none;';
        const ring = document.createElement('div');
        ring.className = 'critical-pulse-ring';
        wrapper.appendChild(ring);
        const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'center' })
          .setLngLat(coords)
          .addTo(map);
        pulseMarkersRef.current.push(marker);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [geojson, mapLoaded, alerts]);

  // ── 4. Realtime subscription ─────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('threat-map-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['alerts'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ── Sidebar click → fly to alert on map ──────────────────────────────────
  const flyToAlert = useCallback((alert: AlertWithOrg) => {
    const coords = getAlertCoords(alert);
    if (!coords || !mapRef.current) return;
    mapRef.current.flyTo({ center: coords, zoom: 10, duration: 800 });
  }, []);

  const sidebarAlerts = alerts.slice(0, 8);
  const hasAlerts = geojson.features.length > 0;

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 100px)', minHeight: '600px' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Threat Map</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? 'Loading...' : `${alerts.length} alerts · ${geojson.features.length} mapped`}
          </p>
        </div>
        {/* Live severity counters */}
        <div className="flex gap-2 flex-wrap">
          {SEVERITY_ORDER.map((sev) => (
            <div key={sev} className="glass-card rounded-lg px-3 py-1.5 border border-border flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: SEVERITY_COLORS[sev] }} />
              <span className="text-xs font-mono font-bold" style={{ color: SEVERITY_COLORS[sev] }}>{counts[sev]}</span>
              <span className="text-xs text-muted-foreground capitalize">{sev}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 flex-shrink-0" role="group" aria-label="Alert filters">
        <div className="flex gap-1 p-1 bg-muted rounded-lg" role="radiogroup" aria-label="Status filter">
          {(['all', 'open', 'ack', 'closed'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              aria-pressed={statusFilter === f}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded transition-all capitalize',
                statusFilter === f
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f}
            </button>
          ))}
        </div>
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
        {(sevFilter !== 'all' || statusFilter !== 'all') && (
          <button
            onClick={() => { setSevFilter('all'); setStatusFilter('all'); }}
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
                  <span className="font-mono font-bold text-foreground">{counts[sev]}</span>
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
          {/* Alert feed */}
          <div className="glass-card rounded-xl border border-border flex flex-col flex-1 min-h-0">
            <div className="p-3 border-b border-border flex items-center gap-2 flex-shrink-0">
              <Activity className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-semibold">Alert Feed</h3>
              {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
              {!isLoading && (
                <span className="ml-auto text-xs font-mono text-muted-foreground">{alerts.length} total</span>
              )}
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-border/50">
              {sidebarAlerts.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs">
                  No alerts for current filters
                </div>
              ) : (
                sidebarAlerts.map((alert) => {
                  const coords = getAlertCoords(alert);
                  const canFly = !!coords;
                  return (
                    <div
                      key={alert.id}
                      role="listitem"
                      aria-label={`${alert.severity} alert in ${alert.organizations?.region ?? 'unknown'} — ${alert.title}`}
                      className={cn(
                        'p-3 transition-colors',
                        canFly && 'cursor-pointer hover:bg-accent/30',
                      )}
                      onClick={() => canFly && flyToAlert(alert)}
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded font-mono border"
                          style={{
                            color: SEVERITY_COLORS[alert.severity],
                            borderColor: `${SEVERITY_COLORS[alert.severity]}40`,
                            background: `${SEVERITY_COLORS[alert.severity]}18`,
                          }}
                        >
                          {alert.severity}
                        </span>
                        <span className={cn(
                          'text-[10px] font-mono px-1.5 py-0.5 rounded',
                          alert.status === 'open'
                            ? 'bg-destructive/10 text-destructive'
                            : alert.status === 'ack'
                            ? 'text-amber-400 bg-amber-400/10'
                            : 'text-muted-foreground bg-muted',
                        )}>
                          {alert.status}
                        </span>
                        {!canFly && (
                          <span className="ml-auto text-[10px] text-muted-foreground/50 font-mono">no coords</span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">{alert.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {alert.organizations?.name ?? '—'} · {alert.organizations?.region ?? '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {alert.created_at
                          ? formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })
                          : ''}
                      </p>
                    </div>
                  );
                })
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
                      {counts[sev]}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: alerts.length > 0 ? `${(counts[sev] / alerts.length) * 100}%` : '0%',
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
