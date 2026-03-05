import { useState, useEffect, useRef, useCallback } from 'react';
import type { LiveThreat, AttackType, Severity } from '@/hooks/useLiveAttacks';
import { jitterCoords } from '@/components/cyber-map/shared';

/* ── Fallback KSN data (used when API key is inactive) ─────────────── */
const FALLBACK_KASPERSKY: KasperskyData = {
  api_key_active: false,
  quota_remaining: 2000,
  subsystems: {
    OAS: { label: 'On-Access Scan', total: 4200000, color: '#ff0044', severity: 'HIGH' },
    IDS: { label: 'Intrusion Detection', total: 3400000, color: '#ff3300', severity: 'CRITICAL' },
    WAV: { label: 'Web Anti-Virus', total: 2100000, color: '#ff6600', severity: 'MEDIUM' },
    ODS: { label: 'On-Demand Scan', total: 1800000, color: '#cc0033', severity: 'HIGH' },
    VUL: { label: 'Vulnerability Scan', total: 1600000, color: '#ffaa00', severity: 'MEDIUM' },
    KAS: { label: 'Anti-Spam', total: 1200000, color: '#999999', severity: 'LOW' },
    MAV: { label: 'Mail Anti-Virus', total: 890000, color: '#ff9900', severity: 'MEDIUM' },
    RMW: { label: 'Ransomware', total: 480000, color: '#9900ff', severity: 'CRITICAL' },
  },
  top_threats: [
    'Trojan.Win32.Generic',
    'HEUR:Trojan.Script.Generic',
    'Trojan-Downloader.Win32.Agent',
    'HEUR:Exploit.Script.Generic',
    'Trojan.Win32.AutoRun.gen',
    'HEUR:Trojan-Ransom.Win32.Generic',
    'Worm.Win32.WBNA.loc',
    'DangerousObject.Multi.Generic',
    'HEUR:Trojan-Spy.AndroidOS.Agent',
    'Trojan.Win32.Zapchast',
  ],
};

/* ── IP masking ─────────────────────────────────────────────────────── */
export function maskIP(ip: string): string {
  if (!ip) return 'x.x.x.x';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  return ip;
}

/* ── Type mapping ───────────────────────────────────────────────────── */
const TYPE_MAP: Record<string, AttackType> = {
  ssh: 'intrusion', exploit: 'intrusion', recon: 'intrusion',
  http: 'exploit', scanner: 'exploit',
  malware: 'malware', botnet: 'malware', ransomware: 'malware',
  phishing: 'phishing', spam: 'phishing',
  ddos: 'ddos',
};

function mapType(raw: string): AttackType {
  return TYPE_MAP[raw] ?? 'exploit';
}

/* ── Kaspersky types ────────────────────────────────────────────────── */
export interface KasperskySubsystem {
  label: string;
  total: number;
  color: string;
  severity: string;
  countries?: Record<string, number>;
}

export interface KasperskyData {
  subsystems: Record<string, KasperskySubsystem>;
  top_threats: string[];
  quota_remaining: number;
  api_key_active: boolean;
}

export interface IndicatorCheckResult {
  zone: 'Red' | 'Yellow' | 'Green';
  categories: string[];
  threat_name: string;
  cc: string;
  isp: string;
}

/* ── Ransomware types ───────────────────────────────────────────────── */
export interface RansomwareVictim {
  victim: string;
  group: string;
  country: string;
  activity: string;
  attackdate: string;
  domain?: string;
  description?: string;
  discovered?: string;
}

export interface RansomwareData {
  recent_victims: RansomwareVictim[];
  groups: any[];
  stats: {
    total_victims: number;
    total_groups: number;
    by_group: [string, number][];
    by_country: [string, number][];
    by_sector: [string, number][];
  };
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
  // Kaspersky-specific
  subsystem?: string;
  subsystem_label?: string;
  kaspersky_zone?: string;
  threat_name?: string;
  verified?: boolean;
}

interface APIStats {
  total: number;
  by_type: Record<string, number>;
  by_country: Record<string, number>;
}

interface TopCountry { cc: string; name: string; count: number; coords: { lat: number; lng: number } }
interface TopType { type: string; count: number; label: string; color: string }
interface SourcesActive {
  abuseipdb: boolean;
  alienvault: boolean;
  urlhaus: boolean;
  firewall: boolean;
  kaspersky_ksn?: boolean;
  kaspersky_tip?: boolean;
  ransomware_live?: boolean;
}

export interface LiveThreatEvent extends LiveThreat {
  color?: string;
  source_ip?: string;
  source_api?: string;
  label?: string;
  subsystem?: string;
  subsystem_label?: string;
  kaspersky_zone?: string;
  threat_name?: string;
  verified?: boolean;
}

export interface LiveThreatAPIState {
  events: LiveThreatEvent[];
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
  kaspersky: KasperskyData | null;
  checkIndicator: (indicator: string) => Promise<IndicatorCheckResult | null>;
  ransomware: RansomwareData | null;
}

const PROXY_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-proxy`;

/* ── Demo / fallback data generator ────────────────────────────────── */
const DEMO_CITIES: { city: string; country: string; cc: string; lat: number; lng: number }[] = [
  { city: 'Moscow', country: 'Russia', cc: 'RU', lat: 55.76, lng: 37.62 },
  { city: 'Beijing', country: 'China', cc: 'CN', lat: 39.91, lng: 116.40 },
  { city: 'New York', country: 'United States', cc: 'US', lat: 40.71, lng: -74.01 },
  { city: 'São Paulo', country: 'Brazil', cc: 'BR', lat: -23.55, lng: -46.63 },
  { city: 'London', country: 'United Kingdom', cc: 'GB', lat: 51.51, lng: -0.13 },
  { city: 'Mumbai', country: 'India', cc: 'IN', lat: 19.08, lng: 72.88 },
  { city: 'Tehran', country: 'Iran', cc: 'IR', lat: 35.69, lng: 51.39 },
  { city: 'Lagos', country: 'Nigeria', cc: 'NG', lat: 6.52, lng: 3.38 },
  { city: 'Berlin', country: 'Germany', cc: 'DE', lat: 52.52, lng: 13.41 },
  { city: 'Seoul', country: 'South Korea', cc: 'KR', lat: 37.57, lng: 126.98 },
  { city: 'Mogadishu', country: 'Somalia', cc: 'SO', lat: 2.05, lng: 45.32 },
  { city: 'Nairobi', country: 'Kenya', cc: 'KE', lat: -1.29, lng: 36.82 },
  { city: 'Tokyo', country: 'Japan', cc: 'JP', lat: 35.68, lng: 139.69 },
  { city: 'Paris', country: 'France', cc: 'FR', lat: 48.86, lng: 2.35 },
  { city: 'Kyiv', country: 'Ukraine', cc: 'UA', lat: 50.45, lng: 30.52 },
];

const DEMO_TYPES: { type: AttackType; label: string; color: string; severity: Severity }[] = [
  { type: 'intrusion', label: 'SSH Brute-Force', color: '#ff0044', severity: 'high' },
  { type: 'malware', label: 'Trojan.Win32.Generic', color: '#9900ff', severity: 'critical' },
  { type: 'exploit', label: 'CVE-2024-3400 Exploit', color: '#ff6600', severity: 'high' },
  { type: 'phishing', label: 'Credential Phishing', color: '#ffaa00', severity: 'medium' },
  { type: 'ddos', label: 'UDP Flood', color: '#00ccff', severity: 'high' },
  { type: 'intrusion', label: 'Port Scan', color: '#ff3300', severity: 'medium' },
  { type: 'malware', label: 'Ransomware Payload', color: '#cc0033', severity: 'critical' },
  { type: 'exploit', label: 'RCE Attempt', color: '#ff0044', severity: 'critical' },
];

let demoCounter = 0;
function generateDemoEvent(): LiveThreatEvent {
  const src = DEMO_CITIES[Math.floor(Math.random() * DEMO_CITIES.length)];
  let dst = DEMO_CITIES[Math.floor(Math.random() * DEMO_CITIES.length)];
  while (dst.cc === src.cc) dst = DEMO_CITIES[Math.floor(Math.random() * DEMO_CITIES.length)];
  const t = DEMO_TYPES[Math.floor(Math.random() * DEMO_TYPES.length)];
  demoCounter++;
  return {
    id: `demo-${Date.now()}-${demoCounter}`,
    name: t.label,
    source: { lat: src.lat + (Math.random() - 0.5) * 2, lng: src.lng + (Math.random() - 0.5) * 2, country: src.country, state: src.city },
    target: { lat: dst.lat + (Math.random() - 0.5) * 2, lng: dst.lng + (Math.random() - 0.5) * 2, country: dst.country, state: dst.city },
    attack_type: t.type,
    severity: t.severity,
    timestamp: Date.now(),
    color: t.color,
    source_ip: `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.x.x`,
    source_api: 'demo',
    label: t.label,
  };
}

function generateDemoBatch(count = 8): LiveThreatEvent[] {
  return Array.from({ length: count }, () => generateDemoEvent());
}

const DEMO_TOP_ATTACKERS = [
  { cc: 'RU', name: 'Russia', count: 4200, coords: { lat: 55.76, lng: 37.62 } },
  { cc: 'CN', name: 'China', count: 3800, coords: { lat: 39.91, lng: 116.40 } },
  { cc: 'US', name: 'United States', count: 2100, coords: { lat: 40.71, lng: -74.01 } },
  { cc: 'IR', name: 'Iran', count: 1400, coords: { lat: 35.69, lng: 51.39 } },
  { cc: 'BR', name: 'Brazil', count: 980, coords: { lat: -23.55, lng: -46.63 } },
];

const DEMO_TOP_TARGETS = [
  { cc: 'US', name: 'United States', count: 5100, coords: { lat: 40.71, lng: -74.01 } },
  { cc: 'GB', name: 'United Kingdom', count: 2400, coords: { lat: 51.51, lng: -0.13 } },
  { cc: 'DE', name: 'Germany', count: 1800, coords: { lat: 52.52, lng: 13.41 } },
  { cc: 'SO', name: 'Somalia', count: 1200, coords: { lat: 2.05, lng: 45.32 } },
  { cc: 'JP', name: 'Japan', count: 900, coords: { lat: 35.68, lng: 139.69 } },
];

const DEMO_TOP_TYPES = [
  { type: 'intrusion', count: 4500, label: 'Intrusion', color: '#ff0044' },
  { type: 'malware', count: 3200, label: 'Malware', color: '#9900ff' },
  { type: 'exploit', count: 2800, label: 'Exploit', color: '#ff6600' },
  { type: 'phishing', count: 1600, label: 'Phishing', color: '#ffaa00' },
  { type: 'ddos', count: 1100, label: 'DDoS', color: '#00ccff' },
];

function mapEvent(e: APIEvent): LiveThreatEvent {
  const src = jitterCoords(e.source.lat, e.source.lng, e.id + '-src', e.source.country);
  const dst = jitterCoords(e.target.lat, e.target.lng, e.id + '-dst', e.target.country);
  return {
    id: e.id,
    name: e.label,
    source: { lat: src.lat, lng: src.lng, country: e.source.country, state: e.source.city },
    target: { lat: dst.lat, lng: dst.lng, country: e.target.country, state: e.target.city },
    attack_type: mapType(e.type),
    severity: (e.severity?.toLowerCase() ?? 'medium') as Severity,
    timestamp: new Date(e.timestamp).getTime(),
    color: e.color,
    source_ip: e.source_ip,
    source_api: e.source_api,
    label: e.label,
    subsystem: e.subsystem,
    subsystem_label: e.subsystem_label,
    kaspersky_zone: e.kaspersky_zone,
    threat_name: e.threat_name,
    verified: e.verified,
  };
}

export function useLiveThreatAPI(): LiveThreatAPIState {
  const [events, setEvents] = useState<LiveThreatEvent[]>([]);
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
  const [kaspersky, setKaspersky] = useState<KasperskyData | null>(null);
  const [ransomware, setRansomware] = useState<RansomwareData | null>(null);
  const seenIds = useRef(new Set<string>());
  const consecutiveFailsRef = useRef(0);

  const fetchData = useCallback(async (force = false) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const primaryPath = force ? '/threat/map/combined?force=true' : '/threat/map/combined';
      const res = await fetch(`${PROXY_BASE}?path=${encodeURIComponent(primaryPath)}`, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        consecutiveFailsRef.current = Math.min(consecutiveFailsRef.current + 1, 6);
        console.warn(`[ThreatAPI] Backend returned ${res.status}, injecting demo data (backoff ${consecutiveFailsRef.current})`);
        // Inject demo data so the map isn't blank
        setEvents(prev => prev.length > 0 ? prev : [...generateDemoBatch(12), ...prev].slice(0, 100));
        if (!stats) {
          setStats({ total: 14200, by_type: { intrusion: 4500, malware: 3200, exploit: 2800, phishing: 1600, ddos: 1100 }, by_country: { RU: 4200, CN: 3800, US: 2100, IR: 1400, BR: 980 } });
          setTopAttackers(DEMO_TOP_ATTACKERS);
          setTopCountries(DEMO_TOP_ATTACKERS);
          setTopTargets(DEMO_TOP_TARGETS);
          setTopTypes(DEMO_TOP_TYPES);
          setHome({ lat: 2.05, lng: 45.32, city: 'Mogadishu', country: 'Somalia' });
          setRefreshedAt(new Date().toISOString());
          setKaspersky(prev => prev ?? FALLBACK_KASPERSKY);
        }
        setLoading(false);
        return;
      }
      consecutiveFailsRef.current = 0;
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
        setTopCountries(data.top_attackers);
      } else if (data.top_countries) {
        setTopCountries(data.top_countries);
        setTopAttackers(data.top_countries);
      }
      if (data.top_targets) setTopTargets(data.top_targets);
      if (data.top_types) setTopTypes(data.top_types);
      if (data.sources_active) setSourcesActive(data.sources_active);
      if (data.home) setHome(data.home);
      if (data.refreshed_at) setRefreshedAt(data.refreshed_at);
      if (data.kaspersky) {
        const k = data.kaspersky as KasperskyData;
        if (!k.api_key_active || !k.subsystems || Object.keys(k.subsystems).length === 0) {
          setKaspersky({ ...FALLBACK_KASPERSKY, quota_remaining: k.quota_remaining ?? FALLBACK_KASPERSKY.quota_remaining, api_key_active: k.api_key_active });
        } else {
          setKaspersky(k);
        }
      } else {
        setKaspersky(prev => prev ?? FALLBACK_KASPERSKY);
      }
      setError(null);
    } catch (err: any) {
      consecutiveFailsRef.current = Math.min(consecutiveFailsRef.current + 1, 6);
      setError(err.message);
      // Inject demo data on network failure so map isn't blank
      setEvents(prev => prev.length > 0 ? prev : [...generateDemoBatch(12), ...prev].slice(0, 100));
      if (!stats) {
        setStats({ total: 14200, by_type: { intrusion: 4500, malware: 3200, exploit: 2800, phishing: 1600, ddos: 1100 }, by_country: { RU: 4200, CN: 3800, US: 2100, IR: 1400, BR: 980 } });
        setTopAttackers(DEMO_TOP_ATTACKERS);
        setTopCountries(DEMO_TOP_ATTACKERS);
        setTopTargets(DEMO_TOP_TARGETS);
        setTopTypes(DEMO_TOP_TYPES);
        setHome({ lat: 2.05, lng: 45.32, city: 'Mogadishu', country: 'Somalia' });
        setKaspersky(prev => prev ?? FALLBACK_KASPERSKY);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Ransomware polling (every 30 min) ─────────────────────────────── */
  const fetchRansomware = useCallback(async () => {
    try {
      const res = await fetch(`${PROXY_BASE}?path=${encodeURIComponent('/ransomware/live')}`, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data._not_found) return;

      // Merge ransomware arc events into the main events
      if (data.events?.length) {
        const apiEvents: APIEvent[] = data.events;
        const newMapped = apiEvents
          .filter(e => !seenIds.current.has(e.id))
          .map(mapEvent);
        for (const e of apiEvents) seenIds.current.add(e.id);
        if (newMapped.length > 0) {
          setEvents(prev => [...newMapped, ...prev].slice(0, 100));
        }
      }

      // Store ransomware-specific data
      setRansomware({
        recent_victims: data.recent_victims ?? [],
        groups: data.groups ?? [],
        stats: data.stats ?? { total_victims: 0, total_groups: 0, by_group: [], by_country: [], by_sector: [] },
      });

      // Update sources
      setSourcesActive(prev => ({ ...prev, ransomware_live: true }));
    } catch {
      // Silent fail — ransomware is a supplementary feed
    }
  }, []);

  useEffect(() => {
    if (isPaused) return;
    fetchData();
    const getInterval = () => 15000 * Math.pow(2, consecutiveFailsRef.current);
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        fetchData().then(schedule);
      }, getInterval());
    };
    schedule();
    return () => clearTimeout(timer);
  }, [isPaused, fetchData]);

  // Demo ticker: inject new arcs every 2s while API is failing
  useEffect(() => {
    if (isPaused) return;
    if (consecutiveFailsRef.current === 0) return; // API is healthy
    const iv = setInterval(() => {
      if (consecutiveFailsRef.current > 0) {
        setEvents(prev => [...generateDemoBatch(2), ...prev].slice(0, 100));
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [isPaused, error]);

  // Ransomware independent polling
  useEffect(() => {
    if (isPaused) return;
    fetchRansomware();
    const iv = setInterval(fetchRansomware, 1_800_000); // 30 min
    return () => clearInterval(iv);
  }, [isPaused, fetchRansomware]);

  const togglePause = useCallback(() => setIsPaused(p => !p), []);
  const forceRefresh = useCallback(() => { fetchData(true); fetchRansomware(); }, [fetchData, fetchRansomware]);

  const checkIndicator = useCallback(async (indicator: string): Promise<IndicatorCheckResult | null> => {
    try {
      const res = await fetch(`${PROXY_BASE}?path=${encodeURIComponent('/kaspersky/check')}`, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ indicator, type: 'auto' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data._not_found) return null;
      return data as IndicatorCheckResult;
    } catch {
      return null;
    }
  }, []);

  return {
    events, stats, topCountries, topAttackers, topTargets, topTypes, sourcesActive,
    home, refreshedAt, isPaused, togglePause, forceRefresh, loading, error,
    kaspersky, checkIndicator, ransomware,
  };
}
