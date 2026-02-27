import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  Crosshair, RefreshCw, Shield, Globe, Wrench, Fish, Database,
  Check, X, Search, Trophy, Clock, Loader2, Play, Square, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface MonitoredOrg {
  id: string; name: string; url: string; sector: string; is_active: boolean;
}

interface ThreatScanResult {
  org_name: string;
  url: string;
  sector: string;
  score: number;
  grade: string;
  risk_level: string;
  alerts: { category: string; message: string; severity: string }[];
  checks: {
    uptime: { verdict: string; score: number; alert: boolean; alert_msg?: string; checks?: any[] };
    ssl: { valid: boolean; score: number; days_left: number; issuer?: string; alert: boolean; alert_msg?: string };
    ddos: { protected: boolean; score: number; providers?: string[]; rate_limited?: boolean; evidence?: string[]; alert: boolean; alert_msg?: string };
    email: { score: number; results: { spf: { present: boolean; record?: string }; dmarc: { present: boolean; record?: string }; dkim: { present: boolean } }; alerts?: string[] };
    headers: { score: number; grade?: string; present?: string[]; missing?: string[]; alert: boolean; alert_msg?: string };
    ports: { score: number; exposed_risky?: { port: number; service: string; severity: string }[]; risky_count: number; alert: boolean; alert_msg?: string };
    defacement: { defaced: boolean; score: number; page_title?: string; keywords_found?: string[]; alert: boolean; alert_msg?: string };
    dns: { score: number; zone_transfer_blocked?: boolean; dnssec_enabled?: boolean; caa_record?: boolean; issues?: string[]; alert_msg?: string };
    blacklist: { listed: boolean; score: number; listed_on?: { ip: string; blacklist: string }[]; alert: boolean; alert_msg?: string };
    software: { score: number; detected?: { type: string; name: string }[]; vulnerabilities?: string[]; alert: boolean; alert_msg?: string };
  };
  checked_at: string;
}

/* ─── Helpers ─── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function proxyFetch<T>(path: string, method = 'GET', body?: any): Promise<T> {
  const url = `${SUPABASE_URL}/functions/v1/security-scanner-proxy?path=${encodeURIComponent(path)}`;
  const res = await fetch(url, {
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

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'text-emerald-400';
  if (grade === 'B') return 'text-green-400';
  if (grade === 'C') return 'text-yellow-400';
  if (grade === 'D') return 'text-orange-400';
  return 'text-red-400';
}

function gradeBg(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'bg-emerald-500/20 border-emerald-500/30';
  if (grade === 'B') return 'bg-green-500/20 border-green-500/30';
  if (grade === 'C') return 'bg-yellow-500/20 border-yellow-500/30';
  if (grade === 'D') return 'bg-orange-500/20 border-orange-500/30';
  return 'bg-red-500/20 border-red-500/30';
}

function severityBadge(severity: string) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  return colors[severity?.toLowerCase()] || colors.low;
}

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function checkBadgeStatus(checks: ThreatScanResult['checks'], key: string): 'green' | 'amber' | 'red' {
  const c = checks;
  switch (key) {
    case 'uptime': return c.uptime?.verdict === 'ONLINE' ? (c.uptime.score === 10 ? 'green' : 'amber') : 'red';
    case 'ssl': return c.ssl?.valid && c.ssl.days_left > 30 ? 'green' : c.ssl?.valid ? 'amber' : 'red';
    case 'ddos': return c.ddos?.protected ? 'green' : 'red';
    case 'email': {
      const spf = c.email?.results?.spf?.present;
      const dmarc = c.email?.results?.dmarc?.present;
      return spf && dmarc ? 'green' : spf || dmarc ? 'amber' : 'red';
    }
    case 'headers': return (c.headers?.score ?? 0) >= 7 ? 'green' : (c.headers?.score ?? 0) >= 4 ? 'amber' : 'red';
    case 'ports': return (c.ports?.risky_count ?? 0) === 0 ? 'green' : 'red';
    case 'defacement': return !c.defacement?.defaced ? 'green' : 'red';
    case 'dns': return c.dns?.zone_transfer_blocked ? 'green' : 'red';
    case 'blacklist': return !c.blacklist?.listed ? 'green' : 'red';
    case 'software': return (c.software?.vulnerabilities?.length ?? 0) === 0 ? 'green' : 'red';
    default: return 'red';
  }
}

const CHECK_KEYS = ['uptime', 'ssl', 'ddos', 'email', 'headers', 'ports', 'defacement', 'dns', 'blacklist', 'software'] as const;

/* ─── Circular Gauge ─── */
const ScoreGauge: React.FC<{ score: number; maxScore?: number; size?: number; grade?: string }> = ({ score, maxScore = 100, size = 100, grade: gradeOverride }) => {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const grade = gradeOverride || (pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 40 ? 'D' : 'F');
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const strokeColor = pct >= 80 ? '#10b981' : pct >= 60 ? '#eab308' : pct >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={strokeColor} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('text-lg font-bold', gradeColor(grade))}>{grade}</span>
        <span className="text-[10px] text-muted-foreground">{Math.round(pct)}%</span>
      </div>
    </div>
  );
};

/* ─── Per-org localStorage helpers ─── */
function saveOrgResult(orgName: string, result: ThreatScanResult) {
  try { localStorage.setItem(`threat_intel_${orgName}`, JSON.stringify(result)); } catch { /* quota */ }
}

function loadOrgResult(orgName: string): ThreatScanResult | null {
  try {
    const raw = localStorage.getItem(`threat_intel_${orgName}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/* ─── Main Component ─── */
const ThreatIntelligence: React.FC = () => {
  const { toast } = useToast();

  const [orgs, setOrgs] = useState<MonitoredOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('scorecards');
  const [now, setNow] = useState(Date.now());

  // Per-org scan results
  const [scanResults, setScanResults] = useState<Record<string, ThreatScanResult>>({});

  // Single-org scanning state (mutex)
  const [scanningOrgId, setScanningOrgId] = useState<string | null>(null);
  const [scanningOrgName, setScanningOrgName] = useState('');
  const [scanPhase, setScanPhase] = useState('');
  const [scanPercent, setScanPercent] = useState(0);
  const [errorOrgs, setErrorOrgs] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sequential queue state
  const [queueRunning, setQueueRunning] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueTotal, setQueueTotal] = useState(0);
  const queueCancelledRef = useRef(false);

  // Filters
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('All');

  // Detail drawer
  const [detailResult, setDetailResult] = useState<ThreatScanResult | null>(null);

  // Live clock
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(iv);
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  /* ─── Load orgs + restore per-org cached results ─── */
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('organizations').select('id, name, domain, sector').order('name');
      if (data) {
        const mapped = data.map((d: any) => ({
          id: d.id, name: d.name,
          url: d.domain.startsWith('http') ? d.domain : 'https://' + d.domain,
          sector: d.sector, is_active: true,
        }));
        setOrgs(mapped);

        // Restore per-org results from localStorage
        const restored: Record<string, ThreatScanResult> = {};
        for (const org of mapped) {
          const cached = loadOrgResult(org.name);
          if (cached) restored[org.name] = cached;
        }
        if (Object.keys(restored).length > 0) setScanResults(restored);
      }
      setLoading(false);
    };
    load();
  }, []);

  /* ─── Single-Org Scan (with mutex) ─── */
  const scanSingleOrg = useCallback(async (org: MonitoredOrg): Promise<boolean> => {
    // Mutex check
    if (scanningOrgId) {
      toast({ title: `Please wait — scan in progress for ${scanningOrgName}` });
      return false;
    }

    setScanningOrgId(org.id);
    setScanningOrgName(org.name);
    setScanPhase('Starting...');
    setScanPercent(0);
    setErrorOrgs(prev => { const n = new Set(prev); n.delete(org.id); return n; });

    try {
      const startRes = await proxyFetch<{ scan_id: string }>('/threat/scan/single', 'POST', {
        name: org.name, url: org.url, sector: org.sector,
      });

      return await new Promise<boolean>((resolve) => {
        pollRef.current = setInterval(async () => {
          try {
            const pollRes = await proxyFetch<any>(`/threat/scan/${startRes.scan_id}`);
            if (pollRes.phase) setScanPhase(pollRes.phase);
            if (typeof pollRes.percent === 'number') setScanPercent(pollRes.percent);

            if (pollRes.status === 'done' && pollRes.result) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;

              setScanResults(prev => ({ ...prev, [pollRes.result.org_name]: pollRes.result }));
              saveOrgResult(org.name, pollRes.result);
              setScanningOrgId(null);
              setScanningOrgName('');
              setScanPhase('');
              setScanPercent(0);
              toast({ title: `${org.name} scanned`, description: `Score: ${pollRes.result.score}/100 (${pollRes.result.grade})` });
              resolve(true);
            } else if (pollRes.status === 'error') {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              setScanningOrgId(null);
              setScanningOrgName('');
              setScanPhase('');
              setScanPercent(0);
              setErrorOrgs(prev => new Set(prev).add(org.id));
              toast({ title: `Scan failed for ${org.name}`, variant: 'destructive' });
              resolve(false);
            }
          } catch { /* continue polling */ }
        }, 4000);
      });
    } catch (err: any) {
      setScanningOrgId(null);
      setScanningOrgName('');
      setScanPhase('');
      setScanPercent(0);
      setErrorOrgs(prev => new Set(prev).add(org.id));
      toast({ title: 'Scan failed', variant: 'destructive', description: err.message });
      return false;
    }
  }, [scanningOrgId, scanningOrgName, toast]);

  /* ─── Sequential Queue ─── */
  const runSequentialQueue = useCallback(async () => {
    queueCancelledRef.current = false;
    setQueueRunning(true);
    setQueueIndex(0);
    setQueueTotal(orgs.length);

    for (let i = 0; i < orgs.length; i++) {
      if (queueCancelledRef.current) break;
      setQueueIndex(i + 1);
      await scanSingleOrg(orgs[i]);
    }

    setQueueRunning(false);
    setQueueIndex(0);
    setQueueTotal(0);
    if (!queueCancelledRef.current) {
      toast({ title: 'Sequential scan complete', description: `All ${orgs.length} organizations scanned` });
    } else {
      toast({ title: 'Queue stopped', description: `Stopped after ${queueIndex} scans` });
    }
  }, [orgs, scanSingleOrg, toast, queueIndex]);

  const stopQueue = useCallback(() => {
    queueCancelledRef.current = true;
  }, []);

  /* ─── Computed: National Threat Level from per-org results ─── */
  const computedSummary = (() => {
    const results = Object.values(scanResults);
    if (results.length === 0) return null;
    const total = results.length;
    const avg_score = results.reduce((s, r) => s + r.score, 0) / total;
    const grade_counts: Record<string, number> = { 'A+': 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    let critical = 0, high = 0, medium = 0, low = 0;
    for (const r of results) {
      grade_counts[r.grade] = (grade_counts[r.grade] || 0) + 1;
      const rl = r.risk_level?.toUpperCase();
      if (rl === 'CRITICAL') critical++;
      else if (rl === 'HIGH') high++;
      else if (rl === 'MEDIUM') medium++;
      else low++;
    }
    const national_risk = critical > 0 ? 'CRITICAL' : high > total * 0.3 ? 'HIGH' : medium > total * 0.5 ? 'MEDIUM' : 'LOW';
    return { total, avg_score, grade_counts, national_risk, critical, high, medium, low };
  })();

  const nationalThreatLevel = (() => {
    if (!computedSummary) return { level: 'LOW', color: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400', pulse: false };
    const risk = computedSummary.national_risk;
    if (risk === 'CRITICAL') return { level: 'CRITICAL ALERT', color: 'bg-red-700/40 border-red-500/50 text-red-300', pulse: true };
    if (risk === 'HIGH') return { level: 'HIGH', color: 'bg-orange-500/20 border-orange-500/30 text-orange-400', pulse: true };
    if (risk === 'MEDIUM') return { level: 'ELEVATED', color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400', pulse: false };
    return { level: 'LOW', color: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400', pulse: false };
  })();

  const scannedCount = Object.keys(scanResults).length;

  /* ─── Filtered results ─── */
  const resultsList = orgs
    .map(org => ({ org, result: scanResults[org.name] }))
    .filter(({ org, result }) => {
      if (search && !org.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (gradeFilter !== 'All' && result) {
        if (gradeFilter === 'A' && result.grade !== 'A+' && result.grade !== 'A') return false;
        if (gradeFilter !== 'A' && result.grade !== gradeFilter) return false;
      }
      return true;
    })
    .sort((a, b) => (a.result?.score ?? 999) - (b.result?.score ?? 999));

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Crosshair className="w-7 h-7 text-neon-cyan" /> Threat Intelligence Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Complete threat prevention and security intelligence for monitored organizations</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-mono">
              {scannedCount}/{orgs.length} scanned
            </span>
            {queueRunning ? (
              <Button onClick={stopQueue} variant="destructive" size="sm">
                <Square className="w-4 h-4 mr-2" /> Stop Queue
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={!!scanningOrgId} className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30">
                    <Play className="w-4 h-4 mr-2" />
                    Scan All (Sequential)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Scan all organizations?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will scan all {orgs.length} organizations one by one. This may take approximately {orgs.length * 2} minutes. Continue?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={runSequentialQueue}>Start Queue</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Queue Progress Bar */}
        {queueRunning && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Queue: {queueIndex}/{queueTotal} — scanning {scanningOrgName}...</span>
              <span>{Math.round((queueIndex / queueTotal) * 100)}%</span>
            </div>
            <Progress value={(queueIndex / queueTotal) * 100} className="h-2" />
          </div>
        )}

        {/* National Threat Level */}
        <div className={cn('rounded-lg border p-4 text-center', nationalThreatLevel.color, nationalThreatLevel.pulse && 'animate-pulse')}>
          <p className="text-xs font-mono uppercase tracking-wider opacity-70">National Threat Level</p>
          <p className="text-2xl font-bold">{nationalThreatLevel.level}</p>
          {computedSummary && (
            <p className="text-xs mt-1 opacity-70">
              Average Score: {Math.round(computedSummary.avg_score)}% ({computedSummary.total} orgs assessed)
            </p>
          )}
        </div>

        {/* Scan Status Bar */}
        <div className="rounded-md border border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
          {scanningOrgId ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-neon-cyan" />
              <span>
                {queueRunning
                  ? `Queue: ${queueIndex}/${queueTotal} complete — scanning ${scanningOrgName}...`
                  : `Scanning: ${scanningOrgName} — ${scanPhase} (${scanPercent}%)`}
              </span>
            </>
          ) : (
            <span>{scannedCount}/{orgs.length} organizations scanned</span>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="scorecards" className="flex-1 min-w-[120px]"><Trophy className="w-3.5 h-3.5 mr-1.5" />Scorecards</TabsTrigger>
            <TabsTrigger value="threats" className="flex-1 min-w-[120px]"><Globe className="w-3.5 h-3.5 mr-1.5" />Threat Feed</TabsTrigger>
            <TabsTrigger value="tech" className="flex-1 min-w-[120px]"><Wrench className="w-3.5 h-3.5 mr-1.5" />Tech Stack</TabsTrigger>
            <TabsTrigger value="phishing" className="flex-1 min-w-[120px]"><Fish className="w-3.5 h-3.5 mr-1.5" />Phishing</TabsTrigger>
            <TabsTrigger value="breaches" className="flex-1 min-w-[120px]"><Database className="w-3.5 h-3.5 mr-1.5" />Breaches</TabsTrigger>
          </TabsList>

          {/* ─── Tab 1: Scorecards ─── */}
          <TabsContent value="scorecards" className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search organizations..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['All', 'A', 'B', 'C', 'D', 'F'].map(g => <SelectItem key={g} value={g}>{g === 'All' ? 'All Grades' : `Grade ${g}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Grade Distribution */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {['A+/A', 'B', 'C', 'D', 'F'].map(g => {
                const counts = computedSummary?.grade_counts;
                const count = counts
                  ? g === 'A+/A' ? (counts['A+'] || 0) + (counts['A'] || 0)
                  : (counts[g] || 0)
                  : 0;
                return (
                  <Card key={g} className={cn('border', g === 'F' ? 'border-red-500/20' : 'border-border')}>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">Grade {g}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resultsList.map(({ org, result }) => {
                const isThisScanning = scanningOrgId === org.id;
                const isScanBusy = !!scanningOrgId;
                const hasError = errorOrgs.has(org.id);

                return (
                  <Card key={org.id}
                    className={cn('border cursor-pointer hover:border-neon-cyan/30 transition-all duration-300',
                      result ? gradeBg(result.grade) : 'border-border',
                      isThisScanning && 'ring-1 ring-neon-cyan/40')}
                    onClick={() => result && setDetailResult(result)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{org.name}</h3>
                          <Badge variant="outline" className="text-xs mt-1">{org.sector}</Badge>
                          {result && (
                            <Badge variant="outline" className={cn('text-xs mt-1 ml-1', severityBadge(result.risk_level))}>
                              {result.risk_level}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Scan button with tooltip */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon" variant="ghost" className="h-7 w-7"
                                onClick={e => { e.stopPropagation(); scanSingleOrg(org); }}
                                disabled={isScanBusy && !isThisScanning}
                              >
                                {isThisScanning
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-neon-cyan" />
                                  : <RefreshCw className={cn('w-3.5 h-3.5', isScanBusy && 'opacity-30')} />}
                              </Button>
                            </TooltipTrigger>
                            {isScanBusy && !isThisScanning && (
                              <TooltipContent>Scan in progress...</TooltipContent>
                            )}
                          </Tooltip>

                          {/* Score gauge or placeholder */}
                          {result
                            ? <ScoreGauge score={result.score} size={80} grade={result.grade} />
                            : (
                              <div className="w-20 h-20 rounded-full border-2 border-muted flex items-center justify-center text-xs text-muted-foreground">
                                {isThisScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : 'N/A'}
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Scanning state */}
                      {isThisScanning && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[10px] text-neon-cyan font-mono">⏳ {scanPhase} ({scanPercent}%)</p>
                          <Progress value={scanPercent} className="h-1.5" />
                        </div>
                      )}

                      {/* Scan complete state */}
                      {result && !isThisScanning && (
                        <>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {result.score}/100 pts ({result.score}%)
                            </span>
                            <div className="flex items-center gap-1.5">
                              {result.checked_at && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" /> {timeAgo(result.checked_at)}
                                </span>
                              )}
                              <button
                                className="text-[10px] text-neon-cyan hover:underline"
                                onClick={e => { e.stopPropagation(); scanSingleOrg(org); }}
                                disabled={isScanBusy}
                              >
                                🔄 Rescan
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {CHECK_KEYS.map(key => {
                              const status = checkBadgeStatus(result.checks, key);
                              return (
                                <span key={key} className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono',
                                  status === 'green' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  status === 'amber' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                  'bg-red-500/10 text-red-400 border-red-500/20'
                                )}>
                                  {status === 'green' ? '✓' : status === 'amber' ? '~' : '✗'} {key}
                                </span>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {/* Never scanned state */}
                      {!result && !isThisScanning && !hasError && (
                        <p className="text-xs text-muted-foreground mt-3">Not yet scanned</p>
                      )}

                      {/* Error state */}
                      {hasError && !isThisScanning && !result && (
                        <div className="mt-2 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-xs text-red-400">Scan failed</span>
                          <button
                            className="text-xs text-neon-cyan hover:underline ml-auto"
                            onClick={e => { e.stopPropagation(); scanSingleOrg(org); }}
                            disabled={isScanBusy}
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {resultsList.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No scorecards match your filters.</p>
            )}
          </TabsContent>

          {/* ─── Tab 2-5: Coming Soon ─── */}
          <TabsContent value="threats" className="space-y-4"><ComingSoon label="Threat Feed" /></TabsContent>
          <TabsContent value="tech" className="space-y-4"><ComingSoon label="Tech Stack" /></TabsContent>
          <TabsContent value="phishing" className="space-y-4"><ComingSoon label="Phishing Detection" /></TabsContent>
          <TabsContent value="breaches" className="space-y-4"><ComingSoon label="Breach Monitoring" /></TabsContent>
        </Tabs>

        {/* ─── Detail Drawer ─── */}
        <Sheet open={!!detailResult} onOpenChange={() => setDetailResult(null)}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                {detailResult && <ScoreGauge score={detailResult.score} size={60} grade={detailResult.grade} />}
                <div>
                  <p>{detailResult?.org_name}</p>
                  <p className="text-xs text-muted-foreground font-normal">{detailResult?.sector} — {detailResult?.url}</p>
                </div>
              </SheetTitle>
              <SheetDescription>
                {detailResult && (
                  <span className={cn('font-bold', gradeColor(detailResult.grade))}>
                    {detailResult.score}/100 — Grade {detailResult.grade} — {detailResult.risk_level}
                  </span>
                )}
              </SheetDescription>
            </SheetHeader>
            {detailResult && (
              <div className="space-y-4 mt-4">
                {/* 10 checks with progress bars */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Security Checks</h4>
                  {CHECK_KEYS.map(key => {
                    const check = (detailResult.checks as any)[key];
                    const score = check?.score ?? 0;
                    const status = checkBadgeStatus(detailResult.checks, key);
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{key}</span>
                          <span className="text-xs font-mono">{score}/10</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all duration-500',
                            status === 'green' ? 'bg-emerald-500' : status === 'amber' ? 'bg-yellow-500' : 'bg-red-500'
                          )} style={{ width: `${(score / 10) * 100}%` }} />
                        </div>
                        {check?.alert_msg && (
                          <p className="text-[10px] text-orange-400">⚠ {check.alert_msg}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Alerts */}
                {detailResult.alerts?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Alerts</h4>
                    {detailResult.alerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <Badge variant="outline" className={cn('text-[10px] shrink-0', severityBadge(a.severity))}>{a.severity}</Badge>
                        <span>{a.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* SSL Details */}
                {detailResult.checks.ssl && (
                  <DetailSection title="SSL / TLS">
                    <DetailRow label="Valid" value={detailResult.checks.ssl.valid ? '✓ Yes' : '✗ No'} />
                    <DetailRow label="Issuer" value={detailResult.checks.ssl.issuer || '—'} />
                    <DetailRow label="Days Left" value={String(detailResult.checks.ssl.days_left ?? '—')} />
                  </DetailSection>
                )}

                {/* DDoS Details */}
                {detailResult.checks.ddos && (
                  <DetailSection title="DDoS Protection">
                    <DetailRow label="Protected" value={detailResult.checks.ddos.protected ? '✓ Yes' : '✗ No'} />
                    <DetailRow label="Providers" value={detailResult.checks.ddos.providers?.join(', ') || 'None detected'} />
                    {detailResult.checks.ddos.evidence?.length ? (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Evidence: {detailResult.checks.ddos.evidence.join(', ')}
                      </div>
                    ) : null}
                  </DetailSection>
                )}

                {/* Email */}
                {detailResult.checks.email && (
                  <DetailSection title="Email Security">
                    <DetailRow label="SPF" value={detailResult.checks.email.results?.spf?.present ? '✓ Present' : '✗ Missing'} />
                    <DetailRow label="DMARC" value={detailResult.checks.email.results?.dmarc?.present ? '✓ Present' : '✗ Missing'} />
                    <DetailRow label="DKIM" value={detailResult.checks.email.results?.dkim?.present ? '✓ Present' : '✗ Missing'} />
                  </DetailSection>
                )}

                {/* Ports */}
                {(detailResult.checks.ports?.exposed_risky?.length ?? 0) > 0 && (
                  <DetailSection title="Exposed Ports">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead className="text-xs">Port</TableHead><TableHead className="text-xs">Service</TableHead><TableHead className="text-xs">Severity</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailResult.checks.ports.exposed_risky!.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono">{p.port}</TableCell>
                            <TableCell className="text-xs">{p.service}</TableCell>
                            <TableCell><Badge variant="outline" className={cn('text-[10px]', severityBadge(p.severity))}>{p.severity}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </DetailSection>
                )}

                {/* Software */}
                {detailResult.checks.software && (
                  <DetailSection title="Software / Tech">
                    {detailResult.checks.software.detected?.map((d, i) => (
                      <span key={i} className="text-xs mr-2">{d.name} ({d.type})</span>
                    ))}
                    {(detailResult.checks.software.vulnerabilities?.length ?? 0) > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {detailResult.checks.software.vulnerabilities!.map((v, i) => (
                          <p key={i} className="text-[10px] text-red-400">⚠ {v}</p>
                        ))}
                      </div>
                    )}
                  </DetailSection>
                )}

                {/* Blacklist */}
                {detailResult.checks.blacklist?.listed && (
                  <DetailSection title="Blacklist">
                    {detailResult.checks.blacklist.listed_on?.map((b, i) => (
                      <p key={i} className="text-xs text-red-400">{b.ip} — {b.blacklist}</p>
                    ))}
                  </DetailSection>
                )}

                {/* DNS */}
                {detailResult.checks.dns && (
                  <DetailSection title="DNS Security">
                    <DetailRow label="Zone Transfer Blocked" value={detailResult.checks.dns.zone_transfer_blocked ? '✓ Yes' : '✗ No'} />
                    <DetailRow label="DNSSEC" value={detailResult.checks.dns.dnssec_enabled ? '✓ Enabled' : '✗ Disabled'} />
                    <DetailRow label="CAA Record" value={detailResult.checks.dns.caa_record ? '✓ Present' : '✗ Missing'} />
                    {detailResult.checks.dns.issues?.map((issue, i) => (
                      <p key={i} className="text-[10px] text-orange-400">⚠ {issue}</p>
                    ))}
                  </DetailSection>
                )}

                {/* Timestamp */}
                {detailResult.checked_at && (
                  <p className="text-xs text-muted-foreground text-right pt-2 border-t border-border">
                    Checked: {timeAgo(detailResult.checked_at)} — {new Date(detailResult.checked_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
};

/* ─── Small helper components ─── */
const ComingSoon: React.FC<{ label: string }> = ({ label }) => (
  <Card className="border-border">
    <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
      <Shield className="w-12 h-12 text-muted-foreground/30" />
      <h3 className="text-lg font-semibold text-muted-foreground">{label}</h3>
      <p className="text-sm text-muted-foreground">Coming soon — real data integration in progress</p>
    </CardContent>
  </Card>
);

const DetailSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-1 border-t border-border pt-3">
    <h4 className="text-sm font-semibold">{title}</h4>
    {children}
  </div>
);

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono">{value}</span>
  </div>
);

export default ThreatIntelligence;
