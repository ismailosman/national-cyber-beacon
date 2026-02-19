import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Loader2, AlertTriangle, Globe, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import logoSrc from '@/assets/logo.png';

const REGION_COORDS: Record<string, [number, number]> = {
  Banaadir:     [45.34,  2.05],
  Puntland:     [49.0,   8.4],
  Somaliland:   [44.06,  9.56],
  Jubaland:     [42.55,  0.35],
  'South West': [43.4,   2.6],
  Hirshabelle:  [45.9,   3.1],
  Galmudug:     [47.2,   5.5],
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#facc15',
  low:      '#3b82f6',
};

type PublicStats = {
  severity_counts: Record<string, number>;
  region_stats: Record<string, { count: number; dominant: string }>;
  total_orgs: number;
  total_open_alerts: number;
  updated_at: string;
};

const Landing: React.FC = () => {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapboxglRef = useRef<any>(null);

  // Fetch public stats
  useEffect(() => {
    setStatsError(false);
    supabase.functions.invoke('public-stats').then(({ data, error }) => {
      if (error || !data) { setStatsError(true); return; }
      setStats(data as PublicStats);
    });
  }, [retryKey]);

  // Fetch map token
  useEffect(() => {
    supabase.functions.invoke('get-map-token').then(({ data, error }) => {
      if (!error && data?.token) setMapToken(data.token);
      else setMapError('Map unavailable');
    });
  }, []);

  // Init Mapbox
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
        interactive: true,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        if (cancelled) return;
        setMapLoaded(true);
        mapRef.current = map;
      });

      map.on('error', () => {
        if (!cancelled) setMapError('Map failed to load.');
      });

      mapRef.current = map;
    }).catch(() => {
      if (!cancelled) setMapError('Map library error.');
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapLoaded(false);
      }
    };
  }, [mapToken]);

  // Place region markers when stats + map are ready
  useEffect(() => {
    if (!mapLoaded || !stats || !mapboxglRef.current || !mapRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const mapboxgl = mapboxglRef.current;
    const map = mapRef.current;

    for (const [region, data] of Object.entries(stats.region_stats)) {
      const coords = REGION_COORDS[region];
      if (!coords) continue;

      const color = SEVERITY_COLORS[data.dominant] ?? '#94a3b8';
      const size = Math.min(8 + data.count * 1.5, 22);

      const el = document.createElement('div');
      el.style.cssText = `
        width:${size}px;height:${size}px;border-radius:50%;
        background:${color};opacity:0.85;
        border:1.5px solid rgba(255,255,255,0.5);
        cursor:default;
      `;
      el.title = `${region}: ${data.count} open alert${data.count !== 1 ? 's' : ''}`;

      const popup = new mapboxgl.Popup({
        closeButton: false,
        offset: 10,
        className: 'threat-tooltip',
      }).setHTML(`
        <div style="background:hsl(216 28% 12%/0.97);border:1px solid hsl(216 28% 22%);color:hsl(210 40% 95%);border-radius:8px;padding:10px 12px;font-family:Inter,system-ui,sans-serif;min-width:130px;">
          <p style="margin:0 0 2px;font-size:12px;font-weight:600;">${region}</p>
          <p style="margin:0;font-size:11px;color:hsl(215 20% 55%);">${data.count} open alert${data.count !== 1 ? 's' : ''}</p>
        </div>`);

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([coords[0], coords[1]])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [mapLoaded, stats]);

  const sev = stats?.severity_counts ?? {};
  const total = stats?.total_open_alerts ?? 0;

  const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="Logo" className="w-8 h-8 object-contain" />
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-wider uppercase">Somalia National Cyber Observatory</h1>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Public Threat Dashboard</p>
          </div>
        </div>
        <Link
          to="/login"
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Shield className="w-4 h-4" /> Sign In
        </Link>
      </header>

      <main className="flex-1 flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
        {/* ── Live status bar ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Live Threat Overview
          </span>
          {stats?.updated_at && (
            <span className="text-xs text-muted-foreground ml-2">
              · updated just now
            </span>
          )}
        </div>

        {/* ── Severity stat cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SEVERITY_ORDER.map((s) => (
            <div
              key={s}
              className="glass-card rounded-xl border border-border p-4 flex flex-col items-center gap-1"
              style={{ borderColor: `${SEVERITY_COLORS[s]}30` }}
            >
              <div
                className="w-3 h-3 rounded-full mb-1"
                style={{ background: SEVERITY_COLORS[s], boxShadow: `0 0 8px ${SEVERITY_COLORS[s]}70` }}
              />
              <span
                className="text-2xl font-bold font-mono"
                style={{ color: SEVERITY_COLORS[s] }}
              >
                {stats ? (sev[s] ?? 0) : (
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: SEVERITY_COLORS[s] }} />
                )}
              </span>
              <span className="text-xs text-muted-foreground capitalize">{s}</span>
            </div>
          ))}
        </div>

        {/* ── Map ─────────────────────────────────────────────────────────── */}
        <div className="glass-card rounded-xl border border-border overflow-hidden relative" style={{ height: '380px' }}>
          {!mapToken && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
              <Loader2 className="w-7 h-7 animate-spin text-primary opacity-70" />
            </div>
          )}
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <p className="text-xs text-muted-foreground">{mapError}</p>
            </div>
          )}
          <div ref={mapContainer} className="w-full h-full" role="img" aria-label="Public threat map showing alert concentrations by region across Somalia" />

          {/* Map legend */}
          {mapLoaded && (
            <div className="absolute bottom-4 left-4 z-10 glass-card rounded-lg p-3 border border-border text-xs space-y-1.5">
              <p className="text-muted-foreground font-mono font-semibold text-[10px] uppercase tracking-wider mb-2">Severity</p>
              {SEVERITY_ORDER.map((sev) => (
                <div key={sev} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ background: SEVERITY_COLORS[sev] }} />
                  <span className="text-muted-foreground capitalize">{sev}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="glass-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold font-mono text-foreground">{stats?.total_orgs ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Organizations Monitored</p>
          </div>
          <div className="glass-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold font-mono text-foreground">{total > 0 ? total : '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Open Alerts</p>
          </div>
          <div className="glass-card rounded-xl border border-border p-4 text-center col-span-2 sm:col-span-1">
            <p className="text-2xl font-bold font-mono text-foreground">{stats ? Object.keys(stats.region_stats).length : '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Active Regions</p>
          </div>
        </div>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <div className="glass-card rounded-xl border border-border p-8 flex flex-col items-center gap-4 text-center">
          <Globe className="w-8 h-8 text-primary opacity-70" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Access the Full Platform</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Sign in to access detailed alert information, organization profiles, compliance reports, incident management, and more.
            </p>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity glow-cyan"
          >
            <Shield className="w-4 h-4" /> Sign In to Access Full Platform
          </Link>
          <p className="text-xs text-muted-foreground">🔒 Authorized personnel only</p>
        </div>

        {statsError && (
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Could not load live stats.
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        Somalia National Cyber Defense Observatory · Public read-only view · Data updated in real-time
      </footer>
    </div>
  );
};

export default Landing;
