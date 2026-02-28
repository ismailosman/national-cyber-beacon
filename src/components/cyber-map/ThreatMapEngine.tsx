import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { LiveThreat, AttackType } from '@/hooks/useLiveAttacks';
import {
  ATTACK_COLORS,
  TRAVEL_DURATION,
  FLASH_DURATION,
  CANVAS_SEGMENTS,
  CANVAS_TAIL,
  RING_PERIOD,
  computeBezierArc,
  bezierPt,
  buildArcsGeoJSON,
  buildFullArcsGeoJSON,
  buildSourcesGeoJSON,
  buildImpactGeoJSON,
  buildProjectilesGeoJSON,
  buildFlashGeoJSON,
  buildRingsGeoJSON,
  type ArcState,
  type FlashState,
  type CanvasArc,
} from './shared';

interface ThreatMapEngineProps {
  threats: LiveThreat[];
  todayCount: number;
  liveOn: boolean;
  onCountryClick?: (country: string) => void;
  onSomaliaClick?: () => void;
  className?: string;
}

const ThreatMapEngine: React.FC<ThreatMapEngineProps> = ({
  threats, liveOn, onCountryClick, onSomaliaClick, className,
}) => {
  const [mapToken, setMapToken]   = useState<string | null>(null);
  const [mapError, setMapError]   = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const mapContainer   = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<any>(null);
  const arcStatesRef   = useRef<Map<string, ArcState>>(new Map());
  const flashStatesRef = useRef<Map<string, FlashState>>(new Map());
  const rafRef         = useRef<number>(0);
  const isDirtyRef     = useRef(false);
  const seenIdsRef     = useRef<Set<string>>(new Set());

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const canvasArcsRef  = useRef<CanvasArc[]>([]);
  const canvasRafRef   = useRef<number>(0);
  const canvasSeenRef  = useRef<Set<string>>(new Set());

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Resize canvas ──────────────────────────────────────────────────────
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

  // ── Spawn canvas arcs ─────────────────────────────────────────────────
  useEffect(() => {
    if (!liveOn) { canvasArcsRef.current = []; canvasSeenRef.current.clear(); return; }
    for (const threat of threats) {
      if (canvasSeenRef.current.has(threat.id)) continue;
      canvasSeenRef.current.add(threat.id);
      if (canvasArcsRef.current.length >= 60) canvasArcsRef.current.splice(0, canvasArcsRef.current.length - 59);
      canvasArcsRef.current.push({
        id: threat.id, srcLng: threat.source.lng, srcLat: threat.source.lat,
        dstLng: threat.target.lng, dstLat: threat.target.lat,
        color: (threat as any).color || ATTACK_COLORS[threat.attack_type],
        progress: 0, phase: 'animating', fadeOpacity: 1, lastFrame: performance.now(),
      });
    }
  }, [threats, liveOn]);

  // ── Canvas draw loop ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const project = (lng: number, lat: number): { x: number; y: number } => {
      const map = mapRef.current;
      if (map) { try { const pt = map.project([lng, lat]); return { x: pt.x, y: pt.y }; } catch (_) {} }
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const x = ((lng + 180) / 360) * w;
      const latRad = (lat * Math.PI) / 180;
      const mercN  = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
      const y      = (h / 2) - (w * mercN) / (2 * Math.PI);
      return { x, y };
    };

    const SPEED = 0.005;
    const FADE_FRAMES = 60;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { canvasRafRef.current = requestAnimationFrame(draw); return; }
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const now = performance.now();
      const arcs = canvasArcsRef.current;

      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        const dt = Math.min((now - arc.lastFrame) / (1000 / 60), 3);
        arc.lastFrame = now;

        if (arc.phase === 'animating') {
          arc.progress = Math.min(arc.progress + SPEED * dt, 1);
          if (arc.progress >= 1) { arc.phase = 'impact'; arc.fadeOpacity = 0; }
        } else if (arc.phase === 'impact') {
          arc.fadeOpacity -= (1 / FADE_FRAMES) * dt;
          if (arc.fadeOpacity <= -1) { arcs.splice(i, 1); continue; }
        }

        const baseOpacity = arc.phase === 'fading' ? arc.fadeOpacity : 1;
        const src = project(arc.srcLng, arc.srcLat);
        const dst = project(arc.dstLng, arc.dstLat);
        const dx = dst.x - src.x, dy = dst.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ctrl = { x: (src.x + dst.x) / 2, y: (src.y + dst.y) / 2 - dist * 0.35 };
        const prog = arc.progress;
        const currentSeg = Math.floor(prog * CANVAS_SEGMENTS);
        const tailSeg    = Math.max(0, currentSeg - Math.ceil(CANVAS_SEGMENTS * CANVAS_TAIL));

        // Guide rail
        if (arc.phase !== 'impact') {
          ctx.save(); ctx.globalAlpha = baseOpacity * 0.25; ctx.strokeStyle = arc.color; ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let s = 0; s <= CANVAS_SEGMENTS; s++) {
            const t = s / CANVAS_SEGMENTS;
            const pt = bezierPt(src.x, src.y, ctrl.x, ctrl.y, dst.x, dst.y, t);
            s === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke(); ctx.restore();
        }

        // Glowing tail
        if (arc.phase === 'animating' && currentSeg > 0) {
          for (let s = tailSeg; s <= currentSeg; s++) {
            const t0 = s / CANVAS_SEGMENTS, t1 = (s + 1) / CANVAS_SEGMENTS;
            const p0 = bezierPt(src.x, src.y, ctrl.x, ctrl.y, dst.x, dst.y, t0);
            const p1 = bezierPt(src.x, src.y, ctrl.x, ctrl.y, dst.x, dst.y, t1);
            const segFrac = (s - tailSeg) / Math.max(1, currentSeg - tailSeg);
            ctx.save(); ctx.globalAlpha = segFrac * baseOpacity * 0.4; ctx.strokeStyle = arc.color;
            ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.shadowBlur = 20; ctx.shadowColor = arc.color;
            ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); ctx.restore();
            ctx.save(); ctx.globalAlpha = segFrac * baseOpacity * 0.9; ctx.strokeStyle = arc.color;
            ctx.lineWidth = 3.5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); ctx.restore();
          }
          const headT = currentSeg / CANVAS_SEGMENTS;
          const headPt = bezierPt(src.x, src.y, ctrl.x, ctrl.y, dst.x, dst.y, headT);
          ctx.save(); ctx.globalAlpha = baseOpacity; ctx.shadowBlur = 15; ctx.shadowColor = arc.color;
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(headPt.x, headPt.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }

        // Source dot
        if (arc.phase === 'animating') {
          ctx.save(); ctx.globalAlpha = baseOpacity * 0.9; ctx.fillStyle = arc.color;
          ctx.shadowBlur = 8; ctx.shadowColor = arc.color;
          ctx.beginPath(); ctx.arc(src.x, src.y, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }

        // Destination pulse
        if (arc.progress >= 0.8) {
          const pulseT = (arc.progress - 0.8) / 0.2;
          ctx.save(); ctx.globalAlpha = (1 - pulseT) * baseOpacity * 0.85;
          ctx.strokeStyle = arc.color; ctx.lineWidth = 2.5; ctx.shadowBlur = 10; ctx.shadowColor = arc.color;
          ctx.beginPath(); ctx.arc(dst.x, dst.y, 4 + pulseT * 18, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }

        // Impact flash
        if (arc.phase === 'impact' && arc.fadeOpacity > -0.5) {
          const flashT = Math.min(1, (-arc.fadeOpacity) / 0.5);
          const eased = 1 - Math.pow(1 - flashT, 3);
          ctx.save(); ctx.globalAlpha = (1 - flashT) * 0.9; ctx.strokeStyle = arc.color;
          ctx.lineWidth = 3.5; ctx.shadowBlur = 20; ctx.shadowColor = arc.color;
          ctx.beginPath(); ctx.arc(dst.x, dst.y, eased * 28, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
          const flashT2 = Math.max(0, flashT - 0.15);
          const eased2 = 1 - Math.pow(1 - flashT2, 3);
          ctx.save(); ctx.globalAlpha = Math.max(0, 1 - flashT2) * 0.5; ctx.strokeStyle = arc.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(dst.x, dst.y, eased2 * 52, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      }
      canvasRafRef.current = requestAnimationFrame(draw);
    };
    canvasRafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(canvasRafRef.current);
  }, []);

  // ── Fetch Mapbox token ────────────────────────────────────────────────
  useEffect(() => {
    supabase.functions.invoke('public-stats').then(({ data, error }) => {
      if (!error && data?.mapbox_token) setMapToken(data.mapbox_token);
      else setMapError('Map token unavailable');
    });
  }, []);

  // ── Init Mapbox ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapToken || !mapContainer.current || mapRef.current) return;
    let cancelled = false;

    import('mapbox-gl').then((mod) => {
      if (cancelled || !mapContainer.current) return;
      const mapboxgl = mod.default;
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
        if (!cancelled) setMapError(e?.message?.includes('WebGL') ? 'Map requires WebGL.' : `Map init error: ${e?.message || 'Unknown'}`);
        return;
      }

      map.on('load', () => {
        if (cancelled) return;
        if (isMobile) map.fitBounds([[-180, -70], [180, 80]], { padding: 0, animate: false });

        // Brighten base layers
        try {
          if (map.getLayer('background')) map.setPaintProperty('background', 'background-color', '#141824');
          if (map.getLayer('water')) map.setPaintProperty('water', 'fill-color', '#1a2540');
          for (const layerId of ['land', 'landcover', 'land-structure-polygon', 'landuse']) {
            if (map.getLayer(layerId)) map.setPaintProperty(layerId, 'fill-color', '#1c2030');
          }
        } catch (_) {}

        // Country boundaries
        map.addSource('country-boundaries', {
          type: 'vector', url: 'mapbox://mapbox.country-boundaries-v1',
          promoteId: { 'country_boundaries': 'iso_3166_1' },
        });

        map.addLayer({ id: 'country-boundary-lines', type: 'line', source: 'country-boundaries', 'source-layer': 'country_boundaries', paint: { 'line-color': 'rgba(148,163,184,0.45)', 'line-width': 0.8 } });
        map.addLayer({ id: 'country-hover-target', type: 'fill', source: 'country-boundaries', 'source-layer': 'country_boundaries', paint: { 'fill-color': 'rgba(0,0,0,0.01)', 'fill-opacity': 1 } });

        // Continent fills
        map.addLayer({
          id: 'continent-fills', type: 'fill', source: 'country-boundaries', 'source-layer': 'country_boundaries',
          paint: {
            'fill-color': [
              'case',
              ['in', ['get', 'iso_3166_1'], ['literal', ['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW']]], 'rgba(245,158,11,0.25)',
              ['in', ['get', 'iso_3166_1'], ['literal', ['AL','AD','AT','BY','BE','BA','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','XK','LV','LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL','PT','RO','RU','SM','RS','SK','SI','ES','SE','CH','UA','GB','VA']]], 'rgba(59,130,246,0.25)',
              ['in', ['get', 'iso_3166_1'], ['literal', ['AF','AM','AZ','BH','BD','BT','BN','KH','CN','GE','IN','ID','IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MY','MV','MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK','SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE']]], 'rgba(20,184,166,0.25)',
              ['in', ['get', 'iso_3166_1'], ['literal', ['AG','BS','BB','BZ','CA','CR','CU','DM','DO','SV','GD','GT','HT','HN','JM','MX','NI','PA','KN','LC','VC','TT','US']]], 'rgba(168,85,247,0.25)',
              ['in', ['get', 'iso_3166_1'], ['literal', ['AR','BO','BR','CL','CO','EC','GY','PY','PE','SR','UY','VE']]], 'rgba(34,197,94,0.25)',
              ['in', ['get', 'iso_3166_1'], ['literal', ['AU','FJ','KI','MH','FM','NR','NZ','PW','PG','WS','SB','TO','TV','VU']]], 'rgba(244,63,94,0.25)',
              'rgba(0,0,0,0)',
            ],
            'fill-opacity': 1,
          },
        });

        // Somalia highlight
        map.addLayer({ id: 'somalia-fill', type: 'fill', source: 'country-boundaries', 'source-layer': 'country_boundaries', filter: ['==', ['get', 'iso_3166_1'], 'SO'], paint: { 'fill-color': 'rgba(56, 189, 248, 0.35)' } });
        map.addLayer({ id: 'somalia-border', type: 'line', source: 'country-boundaries', 'source-layer': 'country_boundaries', filter: ['==', ['get', 'iso_3166_1'], 'SO'], paint: { 'line-color': 'rgba(56, 189, 248, 0.8)', 'line-width': 2 } });

        const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
        map.addSource('attack-arcs-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-full-arcs-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-sources-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-impact-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-projectiles-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-flash-source', { type: 'geojson', data: emptyFC });
        map.addSource('attack-ring-source', { type: 'geojson', data: emptyFC });

        // Layers (same as CyberMap)
        map.addLayer({ id: 'attack-full-arcs', type: 'line', source: 'attack-full-arcs-source', paint: { 'line-color': ['get', 'color'], 'line-width': 1.2, 'line-opacity': ['get', 'opacity'] } });
        map.addLayer({ id: 'attack-arcs-glow', type: 'line', source: 'attack-arcs-source', paint: { 'line-color': ['get', 'color'], 'line-width': 8, 'line-opacity': ['*', ['get', 'opacity'], 0.22], 'line-blur': 6 } });
        map.addLayer({ id: 'attack-arcs', type: 'line', source: 'attack-arcs-source', paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': ['*', ['get', 'opacity'], 0.65] } });
        map.addLayer({ id: 'attack-sources-dot', type: 'circle', source: 'attack-sources-source', paint: { 'circle-radius': 4, 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': 1, 'circle-stroke-color': 'rgba(255,255,255,0.5)' } });
        map.addLayer({ id: 'attack-sources-label', type: 'symbol', source: 'attack-sources-source', layout: { 'text-field': ['get', 'country'], 'text-size': 9, 'text-anchor': 'bottom', 'text-offset': [0, -0.8], 'text-allow-overlap': false, 'text-optional': true }, paint: { 'text-color': '#ffffff', 'text-opacity': ['get', 'opacity'], 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.2 } });
        map.addLayer({ id: 'attack-ring', type: 'circle', source: 'attack-ring-source', paint: { 'circle-radius': ['get', 'radius'], 'circle-color': 'transparent', 'circle-stroke-width': 1.5, 'circle-stroke-color': ['get', 'color'], 'circle-stroke-opacity': ['get', 'ringOpacity'] } });
        map.addLayer({ id: 'attack-impact-solid', type: 'circle', source: 'attack-impact-source', paint: { 'circle-radius': 5, 'circle-color': '#f472b6', 'circle-opacity': 0.9 } });
        map.addLayer({ id: 'attack-impact', type: 'circle', source: 'attack-impact-source', paint: { 'circle-radius': ['+', 10, ['/', ['get', 'count'], 2]], 'circle-color': 'transparent', 'circle-stroke-width': 2, 'circle-stroke-color': '#f472b6', 'circle-opacity': 0.85 } });
        map.addLayer({ id: 'attack-impact-outer', type: 'circle', source: 'attack-impact-source', paint: { 'circle-radius': ['+', 20, ['/', ['get', 'count'], 1]], 'circle-color': 'transparent', 'circle-stroke-width': 1, 'circle-stroke-color': '#f472b6', 'circle-stroke-opacity': 0.35 } });
        map.addLayer({ id: 'attack-projectiles-glow', type: 'circle', source: 'attack-projectiles-source', paint: { 'circle-radius': 14, 'circle-color': ['get', 'color'], 'circle-opacity': ['*', ['get', 'opacity'], 0.28], 'circle-blur': 1 } });
        map.addLayer({ id: 'attack-projectiles-core', type: 'circle', source: 'attack-projectiles-source', paint: { 'circle-radius': 4, 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': 1.5, 'circle-stroke-color': 'rgba(255,255,255,0.95)', 'circle-stroke-opacity': ['get', 'opacity'] } });
        map.addLayer({ id: 'attack-flash', type: 'circle', source: 'attack-flash-source', paint: { 'circle-radius': ['get', 'radius'], 'circle-color': 'transparent', 'circle-stroke-width': ['get', 'strokeW'], 'circle-stroke-color': ['get', 'color'], 'circle-stroke-opacity': ['get', 'opacity'] } });

        // Click handlers
        map.on('click', 'attack-sources-dot', (e: any) => {
          const props = e.features?.[0]?.properties;
          if (props?.country && onCountryClick) onCountryClick(props.country);
        });
        map.on('click', 'country-hover-target', (e: any) => {
          const name = e.features?.[0]?.properties?.name_en;
          if (!name) return;
          if (name === 'Somalia') { onSomaliaClick?.(); }
          else { onCountryClick?.(name); }
        });
        map.on('mouseenter', 'attack-sources-dot', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'attack-sources-dot', () => map.getCanvas().style.cursor = '');

        // Hover tooltip
        const hoveredRef = { current: null as string | null };
        const hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: 'country-hover-popup', offset: 12 });
        map.addLayer({ id: 'country-hover-fill', type: 'fill', source: 'country-boundaries', 'source-layer': 'country_boundaries', paint: { 'fill-color': 'rgba(255,255,255,0.08)', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0] } });
        map.on('mousemove', 'country-hover-target', (e: any) => {
          if (!e.features?.length) return;
          map.getCanvas().style.cursor = 'pointer';
          const feature = e.features[0];
          const fid = feature.properties?.iso_3166_1 || feature.id;
          if (hoveredRef.current && hoveredRef.current !== fid) map.setFeatureState({ source: 'country-boundaries', sourceLayer: 'country_boundaries', id: hoveredRef.current }, { hover: false });
          hoveredRef.current = fid ?? null;
          if (fid !== undefined) map.setFeatureState({ source: 'country-boundaries', sourceLayer: 'country_boundaries', id: fid }, { hover: true });
          const cn = feature.properties?.name_en || feature.properties?.name || '';
          if (cn) hoverPopup.setLngLat(e.lngLat).setHTML(`<span style="font-size:12px;font-weight:600;color:#ffffff;letter-spacing:0.02em">${cn}</span>`).addTo(map);
        });
        map.on('mouseleave', 'country-hover-target', () => {
          map.getCanvas().style.cursor = '';
          if (hoveredRef.current) { map.setFeatureState({ source: 'country-boundaries', sourceLayer: 'country_boundaries', id: hoveredRef.current }, { hover: false }); hoveredRef.current = null; }
          hoverPopup.remove();
        });

        mapRef.current = map;
        setMapLoaded(true);
      });
      map.on('error', (e: any) => { if (!cancelled) setMapError(e?.error?.message?.includes('WebGL') ? 'Map requires WebGL.' : 'Map failed to load.'); });
    }).catch((e: any) => { if (!cancelled) setMapError(`Failed to load map library: ${e?.message || 'Unknown error'}`); });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setMapLoaded(false); }
    };
  }, [mapToken, retryCount]);

  // ── Update map sources ────────────────────────────────────────────────
  const updateMapSources = useCallback((nowMs?: number) => {
    const map = mapRef.current;
    if (!map) return;
    const now = nowMs ?? performance.now();
    const s = (id: string) => map.getSource(id);
    s('attack-arcs-source')?.setData(buildArcsGeoJSON(arcStatesRef.current));
    s('attack-full-arcs-source')?.setData(buildFullArcsGeoJSON(arcStatesRef.current));
    s('attack-sources-source')?.setData(buildSourcesGeoJSON(arcStatesRef.current));
    s('attack-impact-source')?.setData(buildImpactGeoJSON(arcStatesRef.current));
    s('attack-ring-source')?.setData(buildRingsGeoJSON(arcStatesRef.current, now));
    s('attack-projectiles-source')?.setData(buildProjectilesGeoJSON(arcStatesRef.current));
    s('attack-flash-source')?.setData(buildFlashGeoJSON(flashStatesRef.current, now));
  }, []);

  // ── Toggle visibility ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const vis = liveOn ? 'visible' : 'none';
    ['attack-full-arcs','attack-arcs-glow','attack-arcs','attack-sources-dot','attack-sources-label','attack-ring','attack-impact-solid','attack-impact','attack-impact-outer','attack-projectiles-glow','attack-projectiles-core','attack-flash'].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    });
    if (!liveOn) { arcStatesRef.current.clear(); flashStatesRef.current.clear(); seenIdsRef.current.clear(); updateMapSources(); }
  }, [liveOn, mapLoaded, updateMapSources]);

  // ── Sync threats → arc state ──────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !liveOn) return;
    for (const threat of threats) {
      if (seenIdsRef.current.has(threat.id)) continue;
      seenIdsRef.current.add(threat.id);
      arcStatesRef.current.set(threat.id, {
        threat, arcCoords: computeBezierArc(threat.source, threat.target),
        startTime: prefersReducedMotion ? performance.now() - TRAVEL_DURATION * 1000 : performance.now(),
        progress: prefersReducedMotion ? 1 : 0, opacity: 1,
      });
      isDirtyRef.current = true;
    }
  }, [threats, mapLoaded, liveOn, prefersReducedMotion]);

  // ── RAF loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const tick = () => {
      const now = performance.now();
      let changed = false;
      for (const [id, state] of arcStatesRef.current) {
        const elapsed = (now - state.startTime) / 1000;
        const newProgress = Math.min(elapsed / TRAVEL_DURATION, 1);
        if (newProgress >= 1) {
          if (!state.impacted) flashStatesRef.current.set(id, { id, color: ATTACK_COLORS[state.threat.attack_type], coords: [state.threat.target.lng, state.threat.target.lat], startTime: now });
          arcStatesRef.current.delete(id); changed = true; continue;
        }
        if (state.progress !== newProgress) { state.progress = newProgress; changed = true; }
      }
      if (changed || isDirtyRef.current || flashStatesRef.current.size > 0) { isDirtyRef.current = false; updateMapSources(now); }
      else {
        const map = mapRef.current;
        if (map) { const rings = map.getSource('attack-ring-source'); if (rings && arcStatesRef.current.size > 0) (rings as any).setData(buildRingsGeoJSON(arcStatesRef.current, now)); }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mapLoaded, updateMapSources]);

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen', zIndex: 5 }} />
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
          <button onClick={() => { setMapError(null); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } setMapLoaded(false); setRetryCount(c => c + 1); }}
            className="px-4 py-2 text-xs font-mono rounded border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 transition-colors">Retry</button>
        </div>
      )}
    </div>
  );
};

export default ThreatMapEngine;
