import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ShieldAlert, ShieldCheck, Shield, ShieldX, RefreshCw, ExternalLink,
  ChevronDown, Search, Globe, Activity, ArrowUp, ArrowDown, Minus, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toETLocaleTimeString } from '@/lib/dateUtils';

/* ─── Types (backend response shapes) ─── */
interface MonitoredOrg {
  id: string;
  name: string;
  url: string;
  sector: string;
  is_active: boolean;
}

interface RiskFactor {
  factor: string;
  weight: number;
  severity: string;
}

interface ResponseTime {
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  trend: 'stable' | 'degrading' | 'improving';
  status: 'normal' | 'slow' | 'degraded' | 'unreachable';
}

interface ExposedPort {
  port: number;
  service: string;
  risk: string;
}

interface DdosScanResult {
  org_name: string;
  url: string;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  risk_score: number;
  risk_factors: RiskFactor[];
  waf_cdn: string[];
  protected: boolean;
  primary_cdn: string | null;
  rate_limited: boolean;
  origin_exposed: boolean;
  waf_evidence: string[];
  response_time: ResponseTime;
  exposed_ports: ExposedPort[];
  reachable: boolean;
  checked_at: string;
}

interface BulkSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  protected: number;
  unprotected: number;
}

interface ScanState {
  results: Map<string, DdosScanResult>;
  summary: BulkSummary | null;
}

/* ─── Constants ─── */
const SECTORS = ['All', 'Government', 'Bank', 'Telecom', 'Health', 'Education', 'Other'];
const RISK_LEVELS = ['All', 'Low', 'Medium', 'High', 'Critical'];
const PROTECTION_FILTERS = ['All', 'CDN Protected', 'Unprotected'];
const LS_KEY = 'ddos_last_scan';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const riskColors: Record<string, string> = {
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const sectorColors: Record<string, string> = {
  government: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  bank: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  telecom: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  health: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  education: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/* ─── Proxy helper ─── */
function proxyUrl(path: string): string {
  return `${SUPABASE_URL}/functions/v1/security-scanner-proxy?path=${encodeURIComponent(path)}`;
}

async function proxyFetch<T>(path: string, method = 'GET', body?: any): Promise<T> {
  const res = await fetch(proxyUrl(path), {
    method,
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) throw new Error(json?.detail || json?.error || res.statusText || 'API Error');
  return json as T;
}

/* ─── Persistence helpers ─── */
function saveScanToLS(results: Map<string, DdosScanResult>, summary: BulkSummary | null) {
  try {
    const obj = { results: Object.fromEntries(results), summary, savedAt: new Date().toISOString() };
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
  } catch { /* quota exceeded */ }
}

function loadScanFromLS(): ScanState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      results: new Map(Object.entries(parsed.results || {})),
      summary: parsed.summary || null,
    };
  } catch { return null; }
}

/* ─── Component ─── */
const DdosMonitor: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [orgs, setOrgs] = useState<MonitoredOrg[]>([]);
  const [scanResults, setScanResults] = useState<Map<string, DdosScanResult>>(new Map());
  const [summary, setSummary] = useState<BulkSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [recheckingOrg, setRecheckingOrg] = useState<string | null>(null);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [drawerOrg, setDrawerOrg] = useState<{ org: MonitoredOrg; result: DdosScanResult } | null>(null);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [protectionFilter, setProtectionFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'risk' | 'name' | 'responseTime' | 'flaps'>('risk');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Load orgs ── */
  const loadOrgs = useCallback(async () => {
    const { data } = await supabase
      .from('organizations')
      .select('id, name, domain, sector')
      .order('name');
    if (data) {
      setOrgs(data.map(o => ({
        id: o.id,
        name: o.name,
        url: o.domain.startsWith('http') ? o.domain : `https://${o.domain}`,
        sector: o.sector,
        is_active: true,
      })));
    }
    // Load cached results
    const cached = loadScanFromLS();
    if (cached) {
      setScanResults(cached.results);
      setSummary(cached.summary);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  /* cleanup polling on unmount */
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  /* ── Match scan result to org by name/url ── */
  const matchResultToOrg = useCallback((result: DdosScanResult, orgList: MonitoredOrg[]): string | null => {
    const match = orgList.find(o =>
      o.name.toLowerCase() === (result.org_name || '').toLowerCase() ||
      o.url.replace(/\/$/, '') === (result.url || '').replace(/\/$/, '')
    );
    return match?.id || null;
  }, []);

  /* ── Poll scan ── */
  const pollScan = useCallback((scanId: string, orgList: MonitoredOrg[], isBulk: boolean): Promise<void> => {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const data = await proxyFetch<any>(`/ddos/scan/${scanId}`);
          if (data.status === 'done') {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

            if (isBulk && data.result) {
              const newResults = new Map(scanResults);
              const orgResults: DdosScanResult[] = data.result.organizations || [];
              for (const r of orgResults) {
                const orgId = matchResultToOrg(r, orgList);
                if (orgId) newResults.set(orgId, r);
              }
              setScanResults(newResults);
              setSummary(data.result.summary || null);
              saveScanToLS(newResults, data.result.summary || null);
            } else if (!isBulk && data.result) {
              const r = data.result as DdosScanResult;
              const orgId = matchResultToOrg(r, orgList);
              if (orgId) {
                setScanResults(prev => {
                  const next = new Map(prev);
                  next.set(orgId, r);
                  saveScanToLS(next, summary);
                  return next;
                });
              }
            }
            resolve();
          } else if (data.status === 'error') {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            reject(new Error(data.error || 'Scan failed'));
          }
          // else still running, keep polling
        } catch (err) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          reject(err);
        }
      };

      pollRef.current = setInterval(poll, 5000);
      // also run immediately
      poll();
    });
  }, [scanResults, summary, matchResultToOrg]);

  /* ── Check All Now ── */
  const checkAll = useCallback(async () => {
    if (orgs.length === 0) return;
    setScanning(true);
    setScanProgress(`Scanning ${orgs.length} organizations...`);
    try {
      const payload = {
        organizations: orgs.map(o => ({ name: o.name, url: o.url, sector: o.sector })),
      };
      const { scan_id } = await proxyFetch<{ scan_id: string; status: string; total: number }>('/ddos/scan/bulk', 'POST', payload);
      await pollScan(scan_id, orgs, true);
      toast({ title: 'DDoS Scan Complete', description: `Scanned ${orgs.length} organizations.` });
    } catch (err: any) {
      toast({ title: 'DDoS Scan Failed', description: err.message, variant: 'destructive' });
    } finally {
      setScanning(false);
      setScanProgress('');
    }
  }, [orgs, pollScan, toast]);

  /* ── Re-check single ── */
  const recheckSingle = useCallback(async (org: MonitoredOrg) => {
    setRecheckingOrg(org.id);
    try {
      const { scan_id } = await proxyFetch<{ scan_id: string; status: string }>('/ddos/scan/single', 'POST', {
        name: org.name, url: org.url, sector: org.sector,
      });
      await pollScan(scan_id, orgs, false);
      toast({ title: 'Re-check Complete', description: `${org.name} updated.` });
    } catch (err: any) {
      toast({ title: 'Re-check Failed', description: err.message, variant: 'destructive' });
    } finally {
      setRecheckingOrg(null);
    }
  }, [orgs, pollScan, toast]);

  /* ── Build display rows ── */
  const riskEntries = orgs.map(org => ({ org, result: scanResults.get(org.id) || null }));

  const filtered = riskEntries.filter(({ org, result }) => {
    if (search && !org.name.toLowerCase().includes(search.toLowerCase()) && !org.url.toLowerCase().includes(search.toLowerCase())) return false;
    if (riskFilter !== 'All' && (result?.risk_level || '').toLowerCase() !== riskFilter.toLowerCase()) return false;
    if (sectorFilter !== 'All' && org.sector.toLowerCase() !== sectorFilter.toLowerCase()) return false;
    if (protectionFilter === 'CDN Protected' && !result?.protected) return false;
    if (protectionFilter === 'Unprotected' && result?.protected) return false;
    return true;
  });

  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'risk': return (riskOrder[(a.result?.risk_level || 'LOW').toLowerCase()] ?? 3) - (riskOrder[(b.result?.risk_level || 'LOW').toLowerCase()] ?? 3);
      case 'name': return a.org.name.localeCompare(b.org.name);
      case 'responseTime': return (a.result?.response_time?.avg_ms || 99999) - (b.result?.response_time?.avg_ms || 99999);
      case 'flaps': return (b.result?.exposed_ports?.length || 0) - (a.result?.exposed_ports?.length || 0);
      default: return 0;
    }
  });

  /* ── Stats ── */
  const stats = summary || {
    total: orgs.length,
    critical: riskEntries.filter(e => e.result?.risk_level === 'CRITICAL').length,
    high: riskEntries.filter(e => e.result?.risk_level === 'HIGH').length,
    medium: riskEntries.filter(e => e.result?.risk_level === 'MEDIUM').length,
    low: riskEntries.filter(e => e.result?.risk_level === 'LOW').length,
    protected: riskEntries.filter(e => e.result?.protected).length,
    unprotected: riskEntries.filter(e => e.result && !e.result.protected).length,
  };

  const criticalOrgs = riskEntries.filter(e => e.result?.risk_level === 'CRITICAL').map(e => e.org.name);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-orange-400" /> DDoS Risk Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time DDoS risk assessment for monitored organizations</p>
        </div>
        <Button onClick={checkAll} disabled={scanning} className="gap-2">
          <RefreshCw className={cn('w-4 h-4', scanning && 'animate-spin')} />
          {scanning ? scanProgress || 'Scanning...' : 'Check All Now'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-6')}>
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4 text-center">
            <Globe className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-blue-400">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Monitored</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 text-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-emerald-400">{stats.low}</div>
            <div className="text-xs text-muted-foreground">Low Risk</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 text-center">
            <Shield className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-yellow-400">{stats.medium}</div>
            <div className="text-xs text-muted-foreground">Medium Risk</div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="p-4 text-center">
            <ShieldAlert className="w-5 h-5 text-orange-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-orange-400">{stats.high}</div>
            <div className="text-xs text-muted-foreground">High Risk</div>
          </CardContent>
        </Card>
        <Card className={cn('border-red-500/30 bg-red-500/5', stats.critical > 0 && 'animate-pulse')}>
          <CardContent className="p-4 text-center">
            <ShieldX className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-red-400">{stats.critical}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </CardContent>
        </Card>
        <Card className="border-cyan-500/30 bg-cyan-500/5">
          <CardContent className="p-4 text-center">
            <ShieldCheck className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-cyan-400">{stats.protected}</div>
            <div className="text-xs text-muted-foreground">CDN Protected</div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Banners */}
      {criticalOrgs.length > 0 && (
        <Alert className="border-red-500/50 bg-red-500/10 animate-pulse">
          <ShieldX className="w-4 h-4 text-red-400" />
          <AlertTitle className="text-red-400">⚠ CRITICAL</AlertTitle>
          <AlertDescription className="text-red-300">
            {criticalOrgs.join(', ')} — Critical DDoS risk detected
          </AlertDescription>
        </Alert>
      )}
      {criticalOrgs.length === 0 && stats.high > 0 && (
        <Alert className="border-orange-500/50 bg-orange-500/10">
          <ShieldAlert className="w-4 h-4 text-orange-400" />
          <AlertTitle className="text-orange-400">⚠ HIGH RISK</AlertTitle>
          <AlertDescription className="text-orange-300">
            {stats.high} organization{stats.high > 1 ? 's have' : ' has'} elevated DDoS risk
          </AlertDescription>
        </Alert>
      )}
      {criticalOrgs.length === 0 && stats.high === 0 && scanResults.size > 0 && (
        <Alert className="border-emerald-500/50 bg-emerald-500/10">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <AlertTitle className="text-emerald-400">✓ All Clear</AlertTitle>
          <AlertDescription className="text-emerald-300">No active DDoS threats detected</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or URL..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>{RISK_LEVELS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={protectionFilter} onValueChange={setProtectionFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>{PROTECTION_FILTERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="risk">Sort: Risk Level</SelectItem>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="responseTime">Sort: Response Time</SelectItem>
            <SelectItem value="flaps">Sort: Exposed Ports</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Table / Cards */}
      {isMobile ? (
        <div className="space-y-3">
          {filtered.map(({ org, result }) => (
            <MobileCard
              key={org.id}
              org={org}
              result={result}
              expanded={expandedOrg === org.id}
              onToggle={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
              onRecheck={() => recheckSingle(org)}
              rechecking={recheckingOrg === org.id}
              onOpenDrawer={() => result && setDrawerOrg({ org, result })}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Risk</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Organization</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">URL</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sector</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">DDoS Protection</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">WAF</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rate Limit</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Origin</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Resp. Trend</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">1h Avg</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Exposed Ports</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Risk Factors</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ org, result }) => {
                    const rl = (result?.risk_level || 'LOW').toLowerCase();
                    return (
                      <React.Fragment key={org.id}>
                        <tr
                          className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                          onClick={() => result ? setDrawerOrg({ org, result }) : undefined}
                        >
                          <td className="px-4 py-3">
                            <Badge className={cn('text-xs font-mono', riskColors[rl], rl === 'critical' && 'animate-pulse')}>
                              {result?.risk_level || '—'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-medium">{org.name}</td>
                          <td className="px-4 py-3">
                            <a href={org.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:underline" onClick={e => e.stopPropagation()}>
                              {new URL(org.url).hostname} <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn('text-xs', sectorColors[org.sector.toLowerCase()])}>{org.sector}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {result?.protected ? (
                              <span className="text-emerald-400 text-xs">✓ {result.primary_cdn || result.waf_cdn?.[0] || 'Protected'}</span>
                            ) : result ? (
                              <span className="text-red-400 text-xs">✗ No Protection</span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {result?.waf_cdn && result.waf_cdn.length > 0 ? (
                              <span className="text-emerald-400 text-xs">✓ {result.waf_cdn[0]}</span>
                            ) : result ? (
                              <span className="text-red-400 text-xs">✗ None</span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {result ? (
                              result.rate_limited ? <span className="text-emerald-400 text-xs">✓</span> : <span className="text-red-400 text-xs">✗ None</span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {result ? (
                              result.origin_exposed ? <span className="text-red-400 text-xs">⚠ Exposed</span> : <span className="text-emerald-400 text-xs">✓ Hidden</span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <TrendIndicator trend={result?.response_time?.trend} />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {result?.response_time?.avg_ms != null ? `${Math.round(result.response_time.avg_ms)}ms` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('font-mono text-xs', (result?.exposed_ports?.length || 0) === 0 ? 'text-emerald-400' : 'text-red-400')}>
                              {result ? result.exposed_ports?.length || 0 : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {(result?.risk_factors || []).slice(0, 2).map((f, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{f.factor}</Badge>
                              ))}
                              {(result?.risk_factors?.length || 0) > 2 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{result!.risk_factors.length - 2}</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm" variant="outline" className="text-xs h-7"
                              disabled={recheckingOrg === org.id}
                              onClick={e => { e.stopPropagation(); recheckSingle(org); }}
                            >
                              {recheckingOrg === org.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                              Re-check
                            </Button>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={13} className="px-4 py-12 text-center text-muted-foreground">No organizations match the current filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Drawer */}
      <Sheet open={!!drawerOrg} onOpenChange={open => !open && setDrawerOrg(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {drawerOrg && <DetailDrawer org={drawerOrg.org} result={drawerOrg.result} />}
        </SheetContent>
      </Sheet>
    </div>
  );
};

/* ─── Trend Indicator ─── */
const TrendIndicator: React.FC<{ trend?: string }> = ({ trend }) => {
  if (!trend) return <span className="text-muted-foreground text-xs">—</span>;
  switch (trend) {
    case 'improving': return <span className="text-emerald-400 text-xs flex items-center gap-1"><ArrowDown className="w-3 h-3" /> Improving</span>;
    case 'degrading': return <span className="text-red-400 text-xs flex items-center gap-1"><ArrowUp className="w-3 h-3" /> Degrading</span>;
    default: return <span className="text-yellow-400 text-xs flex items-center gap-1"><Minus className="w-3 h-3" /> Stable</span>;
  }
};

/* ─── Detail Drawer ─── */
const DetailDrawer: React.FC<{ org: MonitoredOrg; result: DdosScanResult }> = ({ org, result }) => {
  const rl = result.risk_level.toLowerCase();
  const scoreColor = rl === 'critical' ? 'text-red-400' : rl === 'high' ? 'text-orange-400' : rl === 'medium' ? 'text-yellow-400' : 'text-emerald-400';

  return (
    <div className="space-y-6 py-4">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-orange-400" /> {org.name}
        </SheetTitle>
        <SheetDescription>{org.url}</SheetDescription>
      </SheetHeader>

      {/* Risk Score */}
      <div className="text-center">
        <div className={cn('text-6xl font-black', scoreColor)}>{result.risk_score}</div>
        <Badge className={cn('mt-2 text-sm', riskColors[rl])}>{result.risk_level}</Badge>
        <p className="text-xs text-muted-foreground mt-2">Checked: {new Date(result.checked_at).toLocaleString()}</p>
      </div>

      {/* Risk Factors */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Risk Factors</h4>
        <div className="space-y-2">
          {result.risk_factors.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-sm border border-border/50 rounded-lg px-3 py-2">
              <span>{f.factor}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('text-[10px]', riskColors[f.severity?.toLowerCase() || 'low'])}>{f.severity}</Badge>
                <span className="text-xs text-muted-foreground font-mono">w:{f.weight}</span>
              </div>
            </div>
          ))}
          {result.risk_factors.length === 0 && <span className="text-muted-foreground text-sm">No risk factors</span>}
        </div>
      </div>

      {/* WAF Evidence */}
      {result.waf_evidence && result.waf_evidence.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">WAF Evidence</h4>
          <div className="space-y-1">
            {result.waf_evidence.map((e, i) => (
              <div key={i} className="text-xs font-mono text-muted-foreground bg-muted/30 px-3 py-1.5 rounded">{e}</div>
            ))}
          </div>
        </div>
      )}

      {/* Response Time */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Response Time</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-border/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{Math.round(result.response_time?.avg_ms || 0)}ms</div>
            <div className="text-xs text-muted-foreground">Average</div>
          </div>
          <div className="border border-border/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{Math.round(result.response_time?.min_ms || 0)}ms</div>
            <div className="text-xs text-muted-foreground">Min</div>
          </div>
          <div className="border border-border/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{Math.round(result.response_time?.max_ms || 0)}ms</div>
            <div className="text-xs text-muted-foreground">Max</div>
          </div>
          <div className="border border-border/50 rounded-lg p-3 text-center">
            <TrendIndicator trend={result.response_time?.trend} />
            <div className="text-xs text-muted-foreground mt-1">Status: {result.response_time?.status || '—'}</div>
          </div>
        </div>
      </div>

      {/* Exposed Ports */}
      {result.exposed_ports && result.exposed_ports.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">Exposed Ports ({result.exposed_ports.length})</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Port</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Service</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Risk</th>
                </tr>
              </thead>
              <tbody>
                {result.exposed_ports.map((p, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-3 py-2 font-mono text-xs">{p.port}</td>
                    <td className="px-3 py-2 text-xs">{p.service}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={cn('text-[10px]', riskColors[p.risk?.toLowerCase() || 'medium'])}>{p.risk}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Mobile Card ─── */
const MobileCard: React.FC<{
  org: MonitoredOrg;
  result: DdosScanResult | null;
  expanded: boolean;
  onToggle: () => void;
  onRecheck: () => void;
  rechecking: boolean;
  onOpenDrawer: () => void;
}> = ({ org, result, expanded, onToggle, onRecheck, rechecking, onOpenDrawer }) => {
  const rl = (result?.risk_level || 'LOW').toLowerCase();
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <Card className={cn(rl === 'critical' && 'border-red-500/50 animate-pulse')}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={cn('text-xs font-mono', riskColors[rl])}>
                  {result?.risk_level || '—'}
                </Badge>
                <div>
                  <div className="font-medium text-sm">{org.name}</div>
                  <div className="text-xs text-muted-foreground">{new URL(org.url).hostname}</div>
                </div>
              </div>
              <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {result?.protected ? (
                <span className="text-emerald-400 text-xs">✓ {result.primary_cdn || 'Protected'}</span>
              ) : result ? (
                <span className="text-red-400 text-xs">✗ No CDN</span>
              ) : null}
              {(result?.risk_factors || []).slice(0, 2).map((f, i) => (
                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{f.factor}</Badge>
              ))}
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>WAF: {result?.waf_cdn?.length ? <span className="text-emerald-400">✓ {result.waf_cdn[0]}</span> : <span className="text-red-400">✗</span>}</div>
              <div>Rate Limit: {result?.rate_limited ? <span className="text-emerald-400">✓</span> : <span className="text-red-400">✗</span>}</div>
              <div>Origin: {result?.origin_exposed ? <span className="text-red-400">⚠ Exposed</span> : <span className="text-emerald-400">✓ Hidden</span>}</div>
              <div>Avg: {result?.response_time?.avg_ms ? `${Math.round(result.response_time.avg_ms)}ms` : '—'}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" disabled={rechecking} onClick={e => { e.stopPropagation(); onRecheck(); }}>
                {rechecking ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />} Re-check
              </Button>
              {result && (
                <Button size="sm" variant="outline" className="flex-1" onClick={onOpenDrawer}>
                  Details
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default DdosMonitor;
