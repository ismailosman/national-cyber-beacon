import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, AlertTriangle, Shield, Activity, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Region → default lat/lng for orgs without coordinates
const regionDefaults: Record<string, [number, number]> = {
  Banaadir: [2.05, 45.34],
  Puntland: [8.4, 49.0],
  Somaliland: [9.56, 44.06],
  Jubaland: [0.35, 42.55],
  'South West': [2.6, 43.4],
  Hirshabelle: [3.1, 45.9],
  Galmudug: [5.5, 47.2],
};

const getOrgCoords = (org: any): [number, number] | null => {
  if (org.lat != null && org.lng != null) return [org.lng, org.lat];
  const def = regionDefaults[org.region];
  if (def) return [def[1], def[0]]; // [lng, lat]
  return [45.34, 2.05]; // default Mogadishu
};

const statusColors: Record<string, string> = {
  Secure: '#22c55e',
  Warning: '#f59e0b',
  Critical: '#ef4444',
};

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#22d3ee',
};

const ThreatMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);

  const { data: orgs = [] } = useQuery({
    queryKey: ['orgs-map'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('*').order('name');
      return data || [];
    },
  });

  const { data: threats = [] } = useQuery({
    queryKey: ['threats-map'],
    queryFn: async () => {
      const { data } = await supabase
        .from('threat_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // Fetch mapbox token from edge function
  useEffect(() => {
    supabase.functions.invoke('get-map-token').then(({ data, error }) => {
      if (error || !data?.token) {
        setMapError('Failed to load map token. Please check configuration.');
        return;
      }
      setMapToken(data.token);
    });
  }, []);

  // Init map
  useEffect(() => {
    if (!mapToken || !mapContainer.current || mapRef.current) return;

    let mapboxgl: any;
    import('mapbox-gl').then((m) => {
      mapboxgl = m.default;
      mapboxgl.accessToken = mapToken;

      const map = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [46, 5.5],
        zoom: 5,
        projection: 'mercator',
      });

      map.on('load', () => {
        setMapLoaded(true);
      });

      mapRef.current = map;
    }).catch(() => {
      setMapError('Failed to load map library.');
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapToken]);

  // Add org markers when map is loaded and orgs are available
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || orgs.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    import('mapbox-gl').then((m) => {
      const mapboxgl = m.default;
      orgs.forEach((org: any) => {
        const coords = getOrgCoords(org);
        if (!coords) return;
        const color = statusColors[org.status] || '#f59e0b';

        // Create marker element
        const el = document.createElement('div');
        el.style.cssText = `
          width: 14px; height: 14px; border-radius: 50%;
          background: ${color}; border: 2px solid rgba(255,255,255,0.4);
          cursor: pointer; box-shadow: 0 0 8px ${color}80;
          transition: transform 0.15s;
        `;
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.5)'; });
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
        el.addEventListener('click', () => setSelectedOrg(org));

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(coords)
          .addTo(mapRef.current);

        markersRef.current.push(marker);
      });
    });
  }, [mapLoaded, orgs]);

  // Add threat event circles as source/layer
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || threats.length === 0) return;
    const map = mapRef.current;

    const geojson = {
      type: 'FeatureCollection',
      features: threats
        .filter((t: any) => t.lat != null && t.lng != null)
        .map((t: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
          properties: { severity: t.severity, count: t.count, event_type: t.event_type },
        })),
    };

    if (map.getSource('threats')) {
      (map.getSource('threats') as any).setData(geojson);
    } else {
      map.addSource('threats', { type: 'geojson', data: geojson as any });
      map.addLayer({
        id: 'threats-heat',
        type: 'circle',
        source: 'threats',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 12, 10, 30],
          'circle-color': [
            'match', ['get', 'severity'],
            'critical', '#ef4444',
            'high', '#f97316',
            'medium', '#f59e0b',
            '#22d3ee'
          ],
          'circle-opacity': 0.35,
          'circle-stroke-color': [
            'match', ['get', 'severity'],
            'critical', '#ef4444',
            'high', '#f97316',
            'medium', '#f59e0b',
            '#22d3ee'
          ],
          'circle-stroke-width': 1,
          'circle-stroke-opacity': 0.6,
        },
      });
    }
  }, [mapLoaded, threats]);

  const secureCount = orgs.filter((o: any) => o.status === 'Secure').length;
  const warningCount = orgs.filter((o: any) => o.status === 'Warning').length;
  const criticalCount = orgs.filter((o: any) => o.status === 'Critical').length;
  const recentThreats = threats.slice(0, 5);

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Threat Map</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {orgs.length} organizations · {threats.length} threat events
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'Secure', count: secureCount, color: 'text-neon-green', dot: 'bg-neon-green' },
            { label: 'Warning', count: warningCount, color: 'text-neon-amber', dot: 'bg-neon-amber' },
            { label: 'Critical', count: criticalCount, color: 'text-neon-red', dot: 'bg-neon-red' },
          ].map(({ label, count, color, dot }) => (
            <div key={label} className="glass-card rounded-lg px-3 py-2 border border-border flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', dot)} />
              <span className={cn('text-sm font-bold font-mono', color)}>{count}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map + Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4" style={{ minHeight: '480px' }}>
        {/* Map */}
        <div className="relative glass-card rounded-xl border border-border overflow-hidden" style={{ minHeight: '480px' }}>
          {mapError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <AlertTriangle className="w-10 h-10 text-neon-amber opacity-60" />
              <p className="text-sm">{mapError}</p>
            </div>
          ) : !mapToken ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-neon-cyan opacity-60" />
              <p className="text-sm font-mono">Loading map...</p>
            </div>
          ) : null}

          <div ref={mapContainer} className="w-full h-full" style={{ minHeight: '480px' }} />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 glass-card rounded-lg p-3 border border-border text-xs space-y-1.5">
            <p className="text-muted-foreground font-mono font-semibold mb-2">Legend</p>
            {[
              { label: 'Secure', color: '#22c55e' },
              { label: 'Warning', color: '#f59e0b' },
              { label: 'Critical', color: '#ef4444' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-white/30" style={{ background: color }} />
                <span className="text-muted-foreground">{label} org</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <div className="w-4 h-4 rounded-full opacity-40" style={{ background: '#f97316' }} />
              <span className="text-muted-foreground">Threat event</span>
            </div>
          </div>

          {/* Selected org popup */}
          {selectedOrg && (
            <div className="absolute top-4 left-4 glass-card rounded-xl p-4 border border-border max-w-xs">
              <button
                onClick={() => setSelectedOrg(null)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground text-xs"
              >✕</button>
              <h4 className="font-semibold text-foreground text-sm">{selectedOrg.name}</h4>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedOrg.domain}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded border font-mono',
                  selectedOrg.status === 'Secure' ? 'text-neon-green border-neon-green/30 bg-neon-green/10' :
                  selectedOrg.status === 'Critical' ? 'text-neon-red border-neon-red/30 bg-neon-red/10' :
                  'text-neon-amber border-neon-amber/30 bg-neon-amber/10'
                )}>{selectedOrg.status}</span>
                <span className="text-sm font-bold font-mono text-neon-cyan">{selectedOrg.risk_score}</span>
                <span className="text-xs text-muted-foreground">risk score</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{selectedOrg.region} · {selectedOrg.sector}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 flex flex-col">
          {/* Recent threats */}
          <div className="glass-card rounded-xl border border-border overflow-hidden flex-1">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <Activity className="w-4 h-4 text-neon-red" />
              <h3 className="text-sm font-semibold">Recent Threats</h3>
            </div>
            <div className="divide-y divide-border/50">
              {recentThreats.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs">No threat events</div>
              ) : recentThreats.map((t: any) => (
                <div key={t.id} className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: severityColors[t.severity] || '#f59e0b' }}
                    />
                    <span className="text-xs font-mono font-semibold uppercase text-foreground">{t.event_type}</span>
                    <span className="ml-auto text-xs text-muted-foreground font-mono capitalize">{t.severity}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.target_region}</p>
                  {t.source_country && (
                    <p className="text-xs text-muted-foreground">From: {t.source_country}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {t.created_at ? formatDistanceToNow(new Date(t.created_at), { addSuffix: true }) : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Org status summary */}
          <div className="glass-card rounded-xl border border-border overflow-hidden">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <Shield className="w-4 h-4 text-neon-cyan" />
              <h3 className="text-sm font-semibold">Org Status</h3>
            </div>
            <div className="p-3 space-y-2">
              {[
                { label: 'Secure', count: secureCount, total: orgs.length, color: 'bg-neon-green' },
                { label: 'Warning', count: warningCount, total: orgs.length, color: 'bg-neon-amber' },
                { label: 'Critical', count: criticalCount, total: orgs.length, color: 'bg-neon-red' },
              ].map(({ label, count, total, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-bold text-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', color)}
                      style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
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
