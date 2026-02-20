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
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ShieldAlert, ShieldCheck, Shield, ShieldX, RefreshCw, ExternalLink,
  ChevronDown, Search, Globe, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

/* ─── Types ─── */
interface MonitoredOrg {
  id: string;
  name: string;
  url: string;
  sector: string;
  is_active: boolean;
}

interface DdosProtection {
  hasCDN: boolean;
  cdnProvider: string | null;
  hasRateLimiting: boolean;
  hasWAF: boolean;
  originExposed: boolean;
  protectionHeaders: string[];
  serverHeader: string | null;
}

interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  protection: DdosProtection | null;
  responseTimeSpike: boolean;
  availabilityFlapping: boolean;
  extendedDowntime: boolean;
  riskFactors: string[];
  avg1h: number | null;
  avg24h: number | null;
  flaps1h: number;
  recentPings: { time: string; responseTime: number | null; status: string }[];
}

/* ─── Constants ─── */
const RISK_RECALC_INTERVAL = 60_000;
const HEADER_CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const SECTORS = ['All', 'Government', 'Bank', 'Telecom', 'Health', 'Education', 'Other'];
const RISK_LEVELS = ['All', 'Low', 'Medium', 'High', 'Critical'];
const PROTECTION_FILTERS = ['All', 'CDN Protected', 'Unprotected'];

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

const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };

/* ─── Risk Calculation ─── */
function calculateRiskLevel(
  protection: DdosProtection | null,
  spike: boolean,
  flapping: boolean,
  downtime: boolean,
): { level: 'low' | 'medium' | 'high' | 'critical'; factors: string[] } {
  const factors: string[] = [];

  if (!protection?.hasCDN) factors.push('No CDN/DDoS protection');
  if (!protection?.hasRateLimiting) factors.push('No rate limiting');
  if (!protection?.hasWAF) factors.push('No WAF');
  if (protection?.originExposed) factors.push('Origin IP exposed');
  if (spike) factors.push('Response time spike (>3x baseline)');
  if (flapping) factors.push('Availability flapping (3+ status changes/1h)');
  if (downtime) factors.push('Extended downtime (3+ consecutive failures)');

  const activeAttack = spike || flapping || downtime;
  const noProtection = !protection?.hasCDN;

  if (downtime || (spike && flapping) || (activeAttack && noProtection && factors.length >= 4)) {
    return { level: 'critical', factors };
  }
  if ((noProtection && protection?.originExposed) || spike || flapping || factors.length >= 3) {
    return { level: 'high', factors };
  }
  if (factors.length >= 1) {
    return { level: 'medium', factors };
  }
  return { level: 'low', factors };
}

/* ─── Component ─── */
const DdosMonitor: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [orgs, setOrgs] = useState<MonitoredOrg[]>([]);
  const [risks, setRisks] = useState<Map<string, RiskAssessment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [protectionFilter, setProtectionFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'risk' | 'name' | 'responseTime' | 'flaps'>('risk');
  const lastHeaderCheckRef = useRef(0);

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
    setLoading(false);
  }, []);

  /* ── Calculate risk from uptime_logs ── */
  const calculateRisks = useCallback(async (orgList: MonitoredOrg[], protections: Map<string, DdosProtection>) => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch last 24h of uptime logs
    const { data: logs } = await supabase
      .from('uptime_logs')
      .select('organization_id, status, response_time_ms, checked_at')
      .gte('checked_at', twentyFourHoursAgo)
      .order('checked_at', { ascending: false })
      .limit(1000);

    if (!logs) return;

    const newRisks = new Map<string, RiskAssessment>();

    for (const org of orgList) {
      const orgLogs = logs.filter(l => l.organization_id === org.id);
      const logsLastHour = orgLogs.filter(l => l.checked_at >= oneHourAgo);
      const logsLast24h = orgLogs;

      // Avg response times
      const rt1h = logsLastHour.filter(l => l.response_time_ms != null).map(l => l.response_time_ms!);
      const rt24h = logsLast24h.filter(l => l.response_time_ms != null).map(l => l.response_time_ms!);
      const avg1h = rt1h.length > 0 ? rt1h.reduce((a, b) => a + b, 0) / rt1h.length : null;
      const avg24h = rt24h.length > 0 ? rt24h.reduce((a, b) => a + b, 0) / rt24h.length : null;

      // Response time spike
      const spike = avg1h != null && avg24h != null && avg24h > 0 && avg1h > 3 * avg24h;

      // Availability flapping - count status changes in last hour
      let flaps = 0;
      const sortedHour = [...logsLastHour].sort((a, b) => a.checked_at.localeCompare(b.checked_at));
      for (let i = 1; i < sortedHour.length; i++) {
        if (sortedHour[i].status !== sortedHour[i - 1].status) flaps++;
      }
      const flapping = flaps >= 3;

      // Extended downtime - 3+ consecutive down pings (most recent)
      let consecutiveDown = 0;
      for (const log of orgLogs) {
        if (log.status === 'down') consecutiveDown++;
        else break;
      }
      const extendedDowntime = consecutiveDown >= 3;

      const protection = protections.get(org.id) || null;
      const { level, factors } = calculateRiskLevel(protection, spike, flapping, extendedDowntime);

      // Recent pings for sparkline (last 20)
      const recentPings = orgLogs.slice(0, 20).reverse().map(l => ({
        time: new Date(l.checked_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        responseTime: l.response_time_ms,
        status: l.status,
      }));

      newRisks.set(org.id, {
        riskLevel: level,
        protection,
        responseTimeSpike: spike,
        availabilityFlapping: flapping,
        extendedDowntime,
        riskFactors: factors,
        avg1h,
        avg24h,
        flaps1h: flaps,
        recentPings,
      });
    }

    setRisks(newRisks);
  }, []);

  /* ── Check DDoS headers ── */
  const checkHeaders = useCallback(async (orgList: MonitoredOrg[]) => {
    if (orgList.length === 0) return new Map<string, DdosProtection>();
    setChecking(true);

    try {
      const urls = orgList.map(o => o.url);
      const { data, error } = await supabase.functions.invoke('check-ddos-risk', { body: { urls } });

      if (error || !data?.results) {
        toast({ title: 'DDoS Check Failed', description: 'Could not reach the DDoS check service.', variant: 'destructive' });
        setChecking(false);
        return new Map<string, DdosProtection>();
      }

      const results = data.results as Array<{ url: string; ddosProtection: DdosProtection }>;
      const urlMap = new Map(results.map(r => [r.url, r.ddosProtection]));

      const protections = new Map<string, DdosProtection>();
      for (const org of orgList) {
        const p = urlMap.get(org.url);
        if (p) protections.set(org.id, p);
      }

      lastHeaderCheckRef.current = Date.now();
      toast({ title: 'DDoS Check Complete', description: `Checked ${orgList.length} organizations.` });
      setChecking(false);
      return protections;
    } catch {
      toast({ title: 'DDoS Check Error', variant: 'destructive' });
      setChecking(false);
      return new Map<string, DdosProtection>();
    }
  }, [toast]);

  /* ── Check All Now ── */
  const checkAll = useCallback(async (orgList?: MonitoredOrg[]) => {
    const list = orgList || orgs;
    const protections = await checkHeaders(list);
    await calculateRisks(list, protections);

    // Store to ddos_risk_logs
    const logsToInsert = list.map(org => {
      const r = risks.get(org.id);
      const p = protections.get(org.id);
      return {
        organization_id: org.id,
        organization_name: org.name,
        url: org.url,
        risk_level: r?.riskLevel || 'low',
        has_cdn: p?.hasCDN || false,
        cdn_provider: p?.cdnProvider || null,
        has_rate_limiting: p?.hasRateLimiting || false,
        has_waf: p?.hasWAF || false,
        origin_exposed: p?.originExposed ?? true,
        response_time_spike: r?.responseTimeSpike || false,
        availability_flapping: r?.availabilityFlapping || false,
        extended_downtime: r?.extendedDowntime || false,
        risk_factors: r?.riskFactors || [],
        protection_headers: p?.protectionHeaders || [],
        server_header: p?.serverHeader || null,
      };
    });

    await supabase.from('ddos_risk_logs').insert(logsToInsert);
  }, [orgs, risks, checkHeaders, calculateRisks]);

  /* ── Re-check single ── */
  const recheckSingle = useCallback(async (org: MonitoredOrg) => {
    const protections = await checkHeaders([org]);
    await calculateRisks(orgs, new Map([...Array.from(risks.entries()).map(([k, v]) => [k, v.protection] as [string, DdosProtection | null]), ...protections.entries()].filter(([, v]) => v != null) as [string, DdosProtection][]));
  }, [orgs, risks, checkHeaders, calculateRisks]);

  /* ── Init ── */
  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  useEffect(() => {
    if (orgs.length > 0 && !loading) {
      checkAll(orgs);
    }
  }, [orgs.length, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Recalculate risk every 60s ── */
  useEffect(() => {
    if (orgs.length === 0 || loading) return;
    const interval = setInterval(() => {
      const protections = new Map<string, DdosProtection>();
      risks.forEach((r, id) => { if (r.protection) protections.set(id, r.protection); });
      calculateRisks(orgs, protections);
    }, RISK_RECALC_INTERVAL);
    return () => clearInterval(interval);
  }, [orgs, loading, risks, calculateRisks]);

  /* ── Filter & Sort ── */
  const riskEntries = orgs.map(org => ({ org, risk: risks.get(org.id) }));

  const filtered = riskEntries.filter(({ org, risk }) => {
    if (search && !org.name.toLowerCase().includes(search.toLowerCase()) && !org.url.toLowerCase().includes(search.toLowerCase())) return false;
    if (riskFilter !== 'All' && risk?.riskLevel !== riskFilter.toLowerCase()) return false;
    if (sectorFilter !== 'All' && org.sector.toLowerCase() !== sectorFilter.toLowerCase()) return false;
    if (protectionFilter === 'CDN Protected' && !risk?.protection?.hasCDN) return false;
    if (protectionFilter === 'Unprotected' && risk?.protection?.hasCDN) return false;
    return true;
  });

  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'risk': return (riskOrder[a.risk?.riskLevel || 'low'] ?? 3) - (riskOrder[b.risk?.riskLevel || 'low'] ?? 3);
      case 'name': return a.org.name.localeCompare(b.org.name);
      case 'responseTime': return (a.risk?.avg1h || 99999) - (b.risk?.avg1h || 99999);
      case 'flaps': return (b.risk?.flaps1h || 0) - (a.risk?.flaps1h || 0);
      default: return 0;
    }
  });

  /* ── Stats ── */
  const stats = {
    total: orgs.length,
    low: riskEntries.filter(e => e.risk?.riskLevel === 'low').length,
    medium: riskEntries.filter(e => e.risk?.riskLevel === 'medium').length,
    high: riskEntries.filter(e => e.risk?.riskLevel === 'high').length,
    critical: riskEntries.filter(e => e.risk?.riskLevel === 'critical').length,
    cdnProtected: riskEntries.filter(e => e.risk?.protection?.hasCDN).length,
  };

  const criticalOrgs = riskEntries.filter(e => e.risk?.riskLevel === 'critical').map(e => e.org.name);
  const highCount = stats.high;

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
        <Button onClick={() => checkAll()} disabled={checking} className="gap-2">
          <RefreshCw className={cn('w-4 h-4', checking && 'animate-spin')} />
          {checking ? 'Checking...' : 'Check All Now'}
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
            <div className="text-2xl font-bold text-cyan-400">{stats.cdnProtected}</div>
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
            {criticalOrgs.join(', ')} may be under active DDoS attack — Extended downtime detected with no DDoS protection
          </AlertDescription>
        </Alert>
      )}
      {criticalOrgs.length === 0 && highCount > 0 && (
        <Alert className="border-orange-500/50 bg-orange-500/10">
          <ShieldAlert className="w-4 h-4 text-orange-400" />
          <AlertTitle className="text-orange-400">⚠ HIGH RISK</AlertTitle>
          <AlertDescription className="text-orange-300">
            {highCount} organization{highCount > 1 ? 's have' : ' has'} elevated DDoS risk
          </AlertDescription>
        </Alert>
      )}
      {criticalOrgs.length === 0 && highCount === 0 && (
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
            <SelectItem value="flaps">Sort: Flap Count</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Table / Cards */}
      {isMobile ? (
        <div className="space-y-3">
          {filtered.map(({ org, risk }) => (
            <MobileCard key={org.id} org={org} risk={risk} expanded={expandedOrg === org.id} onToggle={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)} onRecheck={() => recheckSingle(org)} />
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
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">24h Avg</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Flaps</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Risk Factors</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ org, risk }) => (
                    <React.Fragment key={org.id}>
                      <tr className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}>
                        <td className="px-4 py-3">
                          <Badge className={cn('text-xs font-mono', riskColors[risk?.riskLevel || 'low'], risk?.riskLevel === 'critical' && 'animate-pulse')}>
                            {(risk?.riskLevel || 'unknown').toUpperCase()}
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
                          {risk?.protection?.hasCDN ? (
                            <span className="text-emerald-400 text-xs">✓ {risk.protection.cdnProvider}</span>
                          ) : (
                            <span className="text-red-400 text-xs">✗ No Protection</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {risk?.protection?.hasWAF ? <span className="text-emerald-400 text-xs">✓ Active</span> : <span className="text-red-400 text-xs">✗ None</span>}
                        </td>
                        <td className="px-4 py-3">
                          {risk?.protection?.hasRateLimiting ? <span className="text-emerald-400 text-xs">✓ Active</span> : <span className="text-red-400 text-xs">✗ None</span>}
                        </td>
                        <td className="px-4 py-3">
                          {risk?.protection?.originExposed ? <span className="text-red-400 text-xs">⚠ Exposed</span> : <span className="text-emerald-400 text-xs">✓ Hidden</span>}
                        </td>
                        <td className="px-4 py-3 w-[120px]">
                          <MiniSparkline data={risk?.recentPings || []} spike={risk?.responseTimeSpike} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {risk?.avg1h != null ? `${Math.round(risk.avg1h)}ms` : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {risk?.avg24h != null ? `${Math.round(risk.avg24h)}ms` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('font-mono text-xs', (risk?.flaps1h || 0) === 0 ? 'text-emerald-400' : (risk?.flaps1h || 0) < 3 ? 'text-yellow-400' : 'text-red-400')}>
                            {risk?.flaps1h ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(risk?.riskFactors || []).slice(0, 2).map((f, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{f.split('(')[0].trim()}</Badge>
                            ))}
                            {(risk?.riskFactors?.length || 0) > 2 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{risk!.riskFactors.length - 2}</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={e => { e.stopPropagation(); recheckSingle(org); }}>
                            <RefreshCw className="w-3 h-3 mr-1" /> Re-check
                          </Button>
                        </td>
                      </tr>
                      {expandedOrg === org.id && (
                        <tr>
                          <td colSpan={14} className="p-0">
                            <DetailPanel org={org} risk={risk} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={14} className="px-4 py-12 text-center text-muted-foreground">No organizations match the current filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/* ─── Mini Sparkline ─── */
const MiniSparkline: React.FC<{ data: { responseTime: number | null }[]; spike?: boolean }> = ({ data, spike }) => {
  if (data.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <ResponsiveContainer width={100} height={24}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="responseTime" stroke={spike ? '#ef4444' : '#22c55e'} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

/* ─── Detail Panel ─── */
const DetailPanel: React.FC<{ org: MonitoredOrg; risk?: RiskAssessment }> = ({ org, risk }) => {
  const baseline = risk?.avg24h || 0;
  const chartData = (risk?.recentPings || []).map(p => ({
    ...p,
    baseline,
  }));

  return (
    <div className="bg-muted/20 border-t border-border p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Factors */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Risk Factors</h4>
          <div className="space-y-2">
            {(risk?.riskFactors || []).map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-red-400 mt-0.5">•</span>
                <span>{f}</span>
              </div>
            ))}
            {(risk?.riskFactors?.length || 0) === 0 && <span className="text-muted-foreground text-sm">No active risk factors</span>}
          </div>
        </div>

        {/* Protection Recommendations */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Recommendations</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            {!risk?.protection?.hasCDN && <p>• Enable Cloudflare (free tier) or AWS Shield for volumetric DDoS protection</p>}
            {!risk?.protection?.hasRateLimiting && <p>• Implement rate limiting on public endpoints</p>}
            {!risk?.protection?.hasWAF && <p>• Enable a Web Application Firewall to filter malicious traffic</p>}
            {risk?.protection?.originExposed && <p>• Route traffic through a CDN to hide the origin IP</p>}
            {risk?.protection?.hasCDN && risk?.protection?.hasWAF && risk?.protection?.hasRateLimiting && !risk?.protection?.originExposed && (
              <p className="text-emerald-400">✓ All protection measures in place</p>
            )}
          </div>
        </div>
      </div>

      {/* Response Time Chart */}
      {chartData.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">Response Time (Last {chartData.length} Pings)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <ReferenceLine y={baseline} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Baseline', fill: '#f59e0b', fontSize: 10 }} />
              {baseline > 0 && <ReferenceLine y={baseline * 3} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '3x Baseline', fill: '#ef4444', fontSize: 10 }} />}
              <Line type="monotone" dataKey="responseTime" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Headers & Server */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold mb-2">Detected Headers</h4>
          <div className="flex flex-wrap gap-1">
            {(risk?.protection?.protectionHeaders || []).map((h, i) => (
              <Badge key={i} variant="outline" className="text-xs font-mono">{h}</Badge>
            ))}
            {(risk?.protection?.protectionHeaders?.length || 0) === 0 && <span className="text-muted-foreground text-xs">No protection headers detected</span>}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-2">Server</h4>
          <span className="text-xs font-mono text-muted-foreground">{risk?.protection?.serverHeader || '—'}</span>
        </div>
      </div>
    </div>
  );
};

/* ─── Mobile Card ─── */
const MobileCard: React.FC<{
  org: MonitoredOrg;
  risk?: RiskAssessment;
  expanded: boolean;
  onToggle: () => void;
  onRecheck: () => void;
}> = ({ org, risk, expanded, onToggle, onRecheck }) => (
  <Collapsible open={expanded} onOpenChange={onToggle}>
    <Card className={cn(risk?.riskLevel === 'critical' && 'border-red-500/50 animate-pulse')}>
      <CollapsibleTrigger asChild>
        <CardContent className="p-4 cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={cn('text-xs font-mono', riskColors[risk?.riskLevel || 'low'])}>
                {(risk?.riskLevel || '?').toUpperCase()}
              </Badge>
              <div>
                <div className="font-medium text-sm">{org.name}</div>
                <div className="text-xs text-muted-foreground">{new URL(org.url).hostname}</div>
              </div>
            </div>
            <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {risk?.protection?.hasCDN ? (
              <span className="text-emerald-400 text-xs">✓ {risk.protection.cdnProvider}</span>
            ) : (
              <span className="text-red-400 text-xs">✗ No CDN</span>
            )}
            {(risk?.riskFactors || []).slice(0, 2).map((f, i) => (
              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{f.split('(')[0].trim()}</Badge>
            ))}
          </div>
        </CardContent>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border">
          <DetailPanel org={org} risk={risk} />
          <div className="px-4 pb-4">
            <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onRecheck(); }} className="w-full">
              <RefreshCw className="w-3 h-3 mr-1" /> Re-check
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Card>
  </Collapsible>
);

export default DdosMonitor;
