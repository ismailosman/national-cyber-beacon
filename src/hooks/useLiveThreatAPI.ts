import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { LiveThreat, AttackType, Severity } from '@/hooks/useLiveAttacks';

/* ── IP masking ─────────────────────────────────────────────────────── */
export function maskIP(ip: string): string {
  if (!ip) return 'x.x.x.x';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  return ip; // IPv6 or other
}

/* ── Type mapping ───────────────────────────────────────────────────── */
const TYPE_MAP: Record<string, AttackType> = {
  ssh: 'intrusion', exploit: 'intrusion', recon: 'intrusion',
  http: 'exploit', scanner: 'exploit',
  malware: 'malware', botnet: 'malware',
  phishing: 'phishing', spam: 'phishing',
  ddos: 'ddos',
};

function mapType(raw: string): AttackType {
  return TYPE_MAP[raw] ?? 'exploit';
}

/* ── API event shape ────────────────────────────────────────────────── */
interface APIEvent {
  id: string;
  type: string;
  source_ip: string;
  source: { lat: number; lng: number; city: string; country: string; cc: string };
  target: { lat: number; lng: number; city: string; country: string; cc: string };
  label: string;
  color: string;
  severity: string;
  confidence: number;
  timestamp: string;
  source_api: string;
  pulse_name?: string;
  malware_url?: string;
}

interface APIStats {
  total: number;
  by_type: Record<string, number>;
  by_country: Record<string, number>;
}

interface TopCountry { cc: string; name: string; count: number; coords: { lat: number; lng: number } }
interface TopType { type: string; count: number; label: string; color: string }
interface SourcesActive { abuseipdb: boolean; alienvault: boolean; urlhaus: boolean; firewall: boolean }

export interface LiveThreatAPIState {
  events: (LiveThreat & { color?: string; source_ip?: string; source_api?: string; label?: string })[];
  stats: APIStats | null;
  topCountries: TopCountry[];
  topAttackers: TopCountry[];
  topTargets: TopCountry[];
  topTypes: TopType[];
  sourcesActive: SourcesActive;
  home: { lat: number; lng: number; city: string; country: string } | null;
  refreshedAt: string | null;
  isPaused: boolean;
  togglePause: () => void;
  forceRefresh: () => void;
  loading: boolean;
  error: string | null;
}

const PROXY_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-proxy`;

function mapEvent(e: APIEvent): LiveThreat & { color?: string; source_ip?: string; source_api?: string; label?: string } {
  return {
    id: e.id,
    name: e.label,
    source: { lat: e.source.lat, lng: e.source.lng, country: e.source.country, state: e.source.city },
    target: { lat: e.target.lat, lng: e.target.lng, country: e.target.country, state: e.target.city },
    attack_type: mapType(e.type),
    severity: (e.severity?.toLowerCase() ?? 'medium') as Severity,
    timestamp: new Date(e.timestamp).getTime(),
    color: e.color,
    source_ip: e.source_ip,
    source_api: e.source_api,
    label: e.label,
  };
}

export function useLiveThreatAPI(): LiveThreatAPIState {
  const [events, setEvents] = useState<LiveThreatAPIState['events']>([]);
  const [stats, setStats] = useState<APIStats | null>(null);
  const [topCountries, setTopCountries] = useState<TopCountry[]>([]);
  const [topAttackers, setTopAttackers] = useState<TopCountry[]>([]);
  const [topTargets, setTopTargets] = useState<TopCountry[]>([]);
  const [topTypes, setTopTypes] = useState<TopType[]>([]);
  const [sourcesActive, setSourcesActive] = useState<SourcesActive>({ abuseipdb: false, alienvault: false, urlhaus: false, firewall: false });
  const [home, setHome] = useState<LiveThreatAPIState['home']>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef(new Set<string>());

  const fetchData = useCallback(async (force = false) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const path = force ? '/threat/map/live?force=true' : '/threat/map/live';
      const res = await fetch(`${PROXY_BASE}?path=${encodeURIComponent(path)}`, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        // Don't throw on 504 — just log and keep the map visible
        console.warn(`[ThreatAPI] Backend returned ${res.status}, will retry next poll`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data._not_found || !data.events) {
        setLoading(false);
        return;
      }

      const apiEvents: APIEvent[] = data.events ?? [];
      const newMapped = apiEvents
        .filter(e => !seenIds.current.has(e.id))
        .map(mapEvent);

      for (const e of apiEvents) seenIds.current.add(e.id);

      if (newMapped.length > 0) {
        setEvents(prev => [...newMapped, ...prev].slice(0, 100));
      }

      if (data.stats) setStats(data.stats);
      if (data.top_attackers) {
        setTopAttackers(data.top_attackers);
        setTopCountries(data.top_attackers); // backward compat
      } else if (data.top_countries) {
        setTopCountries(data.top_countries);
        setTopAttackers(data.top_countries);
      }
      if (data.top_targets) setTopTargets(data.top_targets);
      if (data.top_types) setTopTypes(data.top_types);
      if (data.sources_active) setSourcesActive(data.sources_active);
      if (data.home) setHome(data.home);
      if (data.refreshed_at) setRefreshedAt(data.refreshed_at);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isPaused) return;
    fetchData();
    const iv = setInterval(() => fetchData(), 8000);
    return () => clearInterval(iv);
  }, [isPaused, fetchData]);

  const togglePause = useCallback(() => setIsPaused(p => !p), []);
  const forceRefresh = useCallback(() => fetchData(true), [fetchData]);

  return { events, stats, topCountries, topAttackers, topTargets, topTypes, sourcesActive, home, refreshedAt, isPaused, togglePause, forceRefresh, loading, error };
}
