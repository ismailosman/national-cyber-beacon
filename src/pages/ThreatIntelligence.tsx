import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Crosshair, RefreshCw, Shield, Globe, Wrench, Fish, Database,
  AlertTriangle, Check, X, ExternalLink, Search, Trophy, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface MonitoredOrg {
  id: string; name: string; url: string; sector: string; is_active: boolean;
}

interface ThreatFeedData {
  cisaKEV: any[]; maliciousUrls: any[]; latestCVEs: any[]; fetchedAt: string;
}

interface TechFingerprint {
  url: string;
  technologies: {
    webServer: string | null; webServerVersion: string | null;
    language: string | null; languageVersion: string | null;
    cms: string | null; cmsVersion: string | null;
    cdn: string | null; jsLibraries: string[];
  } | null;
  error: string | null; checkedAt: string;
}

interface PhishingResult {
  organization: string; organizationId: string; domain: string;
  lookalikeDomains: { domain: string; exists: boolean; ip: string | null; hasWebsite: boolean; risk: string }[];
  totalFound: number; checkedAt: string;
}

interface BreachResult {
  domain: string; organization: string; breachesFound: number;
  breaches: { name: string; title: string; date: string; recordCount: number; dataTypes: string[]; description: string; isVerified: boolean }[];
  checkedAt: string; note: string;
}

interface OrgScorecard {
  org: MonitoredOrg; score: number; grade: string;
  breakdown: { uptime: number; ssl: number; ddos: number; email: number; headers: number; ports: number; defacement: number; dns: number; blacklist: number; software: number };
}

/* ─── Helpers ─── */
function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
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
  return colors[severity] || colors.low;
}

/* ─── Circular Gauge ─── */
const ScoreGauge: React.FC<{ score: number; size?: number }> = ({ score, size = 100 }) => {
  const grade = scoreToGrade(score);
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = score >= 80 ? '#10b981' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={strokeColor} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('text-lg font-bold', gradeColor(grade))}>{grade}</span>
        <span className="text-xs text-muted-foreground">{score}</span>
      </div>
    </div>
  );
};

/* ─── Main Component ─── */
const ThreatIntelligence: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [orgs, setOrgs] = useState<MonitoredOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('scorecards');

  // Data
  const [scorecards, setScorecards] = useState<OrgScorecard[]>([]);
  const [threatFeed, setThreatFeed] = useState<ThreatFeedData | null>(null);
  const [techFingerprints, setTechFingerprints] = useState<Record<string, TechFingerprint>>({});
  const [phishingResults, setPhishingResults] = useState<PhishingResult[]>([]);
  const [breachResults, setBreachResults] = useState<BreachResult[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('All');
  const [threatFilter, setThreatFilter] = useState('All');

  // Detail
  const [detailOrg, setDetailOrg] = useState<OrgScorecard | null>(null);

  /* ─── Load orgs ─── */
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('organizations_monitored').select('*').eq('is_active', true);
      if (data) setOrgs(data);
      setLoading(false);
    };
    load();
  }, []);

  /* ─── Scorecard Calculation ─── */
  const calculateScorecards = useCallback(async (orgList: MonitoredOrg[]) => {
    const cards: OrgScorecard[] = [];

    // Fetch all monitoring data
    const [uptimeRes, sslRes, ddosRes, ewRes, techRes] = await Promise.all([
      supabase.from('uptime_logs').select('*').order('checked_at', { ascending: false }).limit(500),
      supabase.from('ssl_logs').select('*').order('checked_at', { ascending: false }).limit(200),
      supabase.from('ddos_risk_logs').select('*').order('checked_at', { ascending: false }).limit(200),
      supabase.from('early_warning_logs').select('*').order('checked_at', { ascending: false }).limit(500),
      supabase.from('tech_fingerprints' as any).select('*').order('checked_at', { ascending: false }).limit(200),
    ]);

    for (const org of orgList) {
      const breakdown = { uptime: 0, ssl: 0, ddos: 0, email: 0, headers: 0, ports: 0, defacement: 0, dns: 0, blacklist: 0, software: 0 };

      // Uptime (15 pts)
      const orgUptime = (uptimeRes.data || []).filter(u => u.organization_id === org.id);
      const upCount = orgUptime.filter(u => u.status === 'up').length;
      const uptimePercent = orgUptime.length > 0 ? (upCount / orgUptime.length) * 100 : 0;
      breakdown.uptime = uptimePercent >= 99 ? 15 : uptimePercent >= 95 ? 10 : uptimePercent >= 90 ? 5 : 0;

      // SSL (15 pts)
      const orgSsl = (sslRes.data || []).find(s => s.organization_id === org.id);
      if (orgSsl) {
        breakdown.ssl = orgSsl.is_valid && !orgSsl.is_expiring_soon ? 15 : orgSsl.is_valid ? 8 : 0;
      }

      // DDoS (15 pts)
      const orgDdos = (ddosRes.data || []).find(d => d.organization_id === org.id);
      if (orgDdos) {
        let ddosScore = 0;
        if (orgDdos.has_cdn) ddosScore += 5;
        if (orgDdos.has_waf) ddosScore += 5;
        if (orgDdos.has_rate_limiting) ddosScore += 5;
        breakdown.ddos = ddosScore;
      }

      // Early Warning checks
      const orgEw = (ewRes.data || []).filter(e => e.organization_id === org.id);
      const emailEw = orgEw.find(e => e.check_type === 'dns');
      if (emailEw) {
        const det = emailEw.details as any;
        const es = det?.emailSecurity;
        if (es) {
          if (es.spfExists && es.dmarcExists && es.dkimFound && es.dmarcPolicy === 'reject') breakdown.email = 10;
          else if (es.spfExists && es.dmarcExists) breakdown.email = 7;
          else if (es.spfExists) breakdown.email = 3;
        }
      }

      const headersEw = orgEw.find(e => e.check_type === 'security_headers');
      if (headersEw) {
        const det = headersEw.details as any;
        const sc = det?.score || 0;
        breakdown.headers = sc >= 7 ? 10 : sc >= 5 ? 7 : sc >= 3 ? 5 : sc >= 1 ? 2 : 0;
      }

      const portsEw = orgEw.find(e => e.check_type === 'open_ports');
      breakdown.ports = portsEw?.risk_level === 'safe' ? 10 : portsEw?.risk_level === 'warning' ? 5 : portsEw ? 0 : 5;

      const defEw = orgEw.find(e => e.check_type === 'defacement');
      breakdown.defacement = defEw?.risk_level === 'safe' ? 10 : defEw?.risk_level === 'warning' ? 5 : defEw ? 0 : 5;

      const dnsEw = orgEw.find(e => e.check_type === 'dns');
      breakdown.dns = dnsEw?.risk_level === 'safe' ? 5 : dnsEw?.risk_level === 'warning' ? 2 : dnsEw ? 0 : 3;

      const blEw = orgEw.find(e => e.check_type === 'blacklist');
      breakdown.blacklist = blEw?.risk_level === 'safe' ? 5 : 0;

      // Software (5 pts)
      const orgTech = (techRes.data || [] as any[]).find((t: any) => t.organization_id === org.id) as any;
      breakdown.software = orgTech ? (orgTech?.outdated_count === 0 ? 5 : (orgTech?.outdated_count ?? 0) <= 2 ? 2 : 0) : 3;

      const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
      cards.push({ org, score, grade: scoreToGrade(score), breakdown });
    }

    // Sort worst first
    cards.sort((a, b) => a.score - b.score);
    setScorecards(cards);
  }, []);

  /* ─── Threat Feed ─── */
  const fetchThreatFeed = useCallback(async () => {
    try {
      const techNames = Object.values(techFingerprints)
        .filter(t => t.technologies)
        .flatMap(t => [t.technologies!.webServer, t.technologies!.cms, t.technologies!.language].filter(Boolean) as string[]);
      const { data, error } = await supabase.functions.invoke('fetch-threat-intel', { body: { orgTechnologies: techNames } });
      if (error) throw error;
      setThreatFeed(data);
    } catch (err) {
      console.error('Threat feed error:', err);
    }
  }, [techFingerprints]);

  /* ─── Tech Fingerprinting ─── */
  const runFingerprinting = useCallback(async (orgList: MonitoredOrg[]) => {
    try {
      const urls = orgList.map(o => o.url);
      const { data, error } = await supabase.functions.invoke('fingerprint-tech', { body: { urls } });
      if (error) throw error;
      const newFp: Record<string, TechFingerprint> = {};
      for (const r of data.results || []) {
        newFp[r.url] = r;
        // Save to DB
        const org = orgList.find(o => o.url === r.url);
        if (org && r.technologies) {
          await supabase.from('tech_fingerprints' as any).upsert({
            organization_id: org.id, url: r.url,
            web_server: r.technologies.webServer, web_server_version: r.technologies.webServerVersion,
            language: r.technologies.language, language_version: r.technologies.languageVersion,
            cms: r.technologies.cms, cms_version: r.technologies.cmsVersion,
            cdn: r.technologies.cdn, js_libraries: r.technologies.jsLibraries || [],
            checked_at: r.checkedAt,
          }, { onConflict: 'url' }).select();
        }
      }
      setTechFingerprints(newFp);
    } catch (err) {
      console.error('Fingerprinting error:', err);
    }
  }, []);

  /* ─── Phishing Domains ─── */
  const runPhishingCheck = useCallback(async (orgList: MonitoredOrg[]) => {
    try {
      const organizations = orgList.map(o => ({ id: o.id, name: o.name, domain: extractDomain(o.url) }));
      const { data, error } = await supabase.functions.invoke('check-phishing-domains', { body: { organizations } });
      if (error) throw error;
      setPhishingResults(data.results || []);

      // Save active phishing domains
      for (const r of data.results || []) {
        for (const d of r.lookalikeDomains) {
          if (d.exists) {
            await supabase.from('phishing_domains' as any).upsert({
              organization_id: r.organizationId, organization_name: r.organization,
              original_domain: r.domain, lookalike_domain: d.domain,
              is_active: d.hasWebsite, ip_address: d.ip, has_website: d.hasWebsite,
              risk_level: d.risk, last_checked: new Date().toISOString(),
            }, { onConflict: 'lookalike_domain' }).select();

            // Alert for active phishing
            if (d.hasWebsite) {
              await generateAlert('critical', `Active Phishing Domain: ${d.domain}`, `Lookalike domain ${d.domain} targeting ${r.organization} has an active website at IP ${d.ip}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('Phishing check error:', err);
    }
  }, []);

  /* ─── Breach Check ─── */
  const runBreachCheck = useCallback(async (orgList: MonitoredOrg[]) => {
    try {
      const domains = orgList.map(o => ({ domain: extractDomain(o.url), name: o.name }));
      const { data, error } = await supabase.functions.invoke('check-breaches', { body: { domains } });
      if (error) throw error;
      setBreachResults(data.results || []);
    } catch (err) {
      console.error('Breach check error:', err);
    }
  }, []);

  /* ─── Alert Generation ─── */
  const generateAlert = async (severity: string, title: string, description: string) => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase.from('alerts').select('id').eq('title', title).gte('created_at', since).limit(1);
      if (existing && existing.length > 0) return;
      await supabase.from('alerts').insert({ title, description, severity: severity as any, source: 'threat-intel', status: 'open' });
    } catch (err) { console.error('Alert gen error:', err); }
  };

  /* ─── Run Full Scan ─── */
  const runFullScan = useCallback(async () => {
    if (orgs.length === 0) return;
    setScanning(true);
    toast({ title: 'Running full threat intelligence scan...', description: `Analyzing ${orgs.length} organizations` });
    try {
      await runFingerprinting(orgs);
      await Promise.all([
        fetchThreatFeed(),
        runPhishingCheck(orgs),
        runBreachCheck(orgs),
      ]);
      await calculateScorecards(orgs);
      setLastChecked(new Date().toISOString());
      toast({ title: 'Scan complete', description: 'Threat intelligence updated' });
    } catch {
      toast({ title: 'Some checks failed', variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  }, [orgs, runFingerprinting, fetchThreatFeed, runPhishingCheck, runBreachCheck, calculateScorecards, toast]);

  // Run on mount
  const initialRun = useRef(false);
  useEffect(() => {
    if (!loading && orgs.length > 0 && !initialRun.current) {
      initialRun.current = true;
      runFullScan();
    }
  }, [loading, orgs.length, runFullScan]);

  /* ─── National Threat Level ─── */
  const nationalThreatLevel = (() => {
    if (scorecards.length === 0) return { level: 'LOW', color: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400', pulse: false };
    const worst = scorecards[0]?.grade;
    if (worst === 'F') return { level: 'CRITICAL', color: 'bg-red-500/20 border-red-500/30 text-red-400', pulse: true };
    if (worst === 'D') return { level: 'HIGH', color: 'bg-orange-500/20 border-orange-500/30 text-orange-400', pulse: true };
    if (worst === 'C') return { level: 'ELEVATED', color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400', pulse: false };
    return { level: 'LOW', color: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400', pulse: false };
  })();

  const totalPhishing = phishingResults.reduce((sum, r) => sum + r.totalFound, 0);
  const activePhishing = phishingResults.reduce((sum, r) => sum + r.lookalikeDomains.filter(d => d.hasWebsite).length, 0);
  const totalBreaches = breachResults.reduce((sum, r) => sum + r.breachesFound, 0);

  /* ─── Filtered scorecards ─── */
  const filteredScorecards = scorecards.filter(s => {
    if (search && !s.org.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (gradeFilter !== 'All') {
      if (gradeFilter === 'A' && s.grade !== 'A+' && s.grade !== 'A') return false;
      if (gradeFilter !== 'A' && s.grade !== gradeFilter) return false;
    }
    return true;
  });

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
          {lastChecked && <span className="text-xs text-muted-foreground font-mono">Last: {new Date(lastChecked).toLocaleTimeString()}</span>}
          <Button onClick={runFullScan} disabled={scanning} className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30">
            <RefreshCw className={cn('w-4 h-4 mr-2', scanning && 'animate-spin')} />
            {scanning ? 'Scanning...' : 'Run Full Scan'}
          </Button>
        </div>
      </div>

      {/* National Threat Level */}
      <div className={cn('rounded-lg border p-4 text-center', nationalThreatLevel.color, nationalThreatLevel.pulse && 'animate-pulse')}>
        <p className="text-xs font-mono uppercase tracking-wider opacity-70">National Threat Level</p>
        <p className="text-2xl font-bold">{nationalThreatLevel.level}</p>
        {scorecards.length > 0 && (
          <p className="text-xs mt-1 opacity-70">
            Average Score: {Math.round(scorecards.reduce((s, c) => s + c.score, 0) / scorecards.length)} / 100
          </p>
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

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {['A+', 'A', 'B', 'C', 'D/F'].map(g => {
              const count = g === 'D/F'
                ? scorecards.filter(s => s.grade === 'D' || s.grade === 'F').length
                : scorecards.filter(s => s.grade === g).length;
              return (
                <Card key={g} className={cn('border', g === 'D/F' ? 'border-red-500/20' : 'border-border')}>
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
            {filteredScorecards.map(sc => (
              <Card key={sc.org.id} className={cn('border cursor-pointer hover:border-neon-cyan/30 transition-colors', gradeBg(sc.grade))}
                onClick={() => setDetailOrg(sc)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{sc.org.name}</h3>
                      <Badge variant="outline" className="text-xs mt-1">{sc.org.sector}</Badge>
                    </div>
                    <ScoreGauge score={sc.score} size={80} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {Object.entries(sc.breakdown).map(([key, val]) => {
                      const maxes: Record<string, number> = { uptime: 15, ssl: 15, ddos: 15, email: 10, headers: 10, ports: 10, defacement: 10, dns: 5, blacklist: 5, software: 5 };
                      const max = maxes[key] || 10;
                      const pct = val / max;
                      return (
                        <span key={key} className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono',
                          pct >= 0.8 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          pct >= 0.5 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        )}>
                          {pct >= 0.8 ? '✓' : pct >= 0.5 ? '~' : '✗'} {key}
                        </span>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {filteredScorecards.length === 0 && !scanning && (
            <p className="text-center text-muted-foreground py-8">No scorecards yet. Click "Run Full Scan" to generate.</p>
          )}
        </TabsContent>

        {/* ─── Tab 2: Threat Feed ─── */}
        <TabsContent value="threats" className="space-y-4">
          <div className="flex gap-3">
            <Select value={threatFilter} onValueChange={setThreatFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Sources</SelectItem>
                <SelectItem value="CISA">CISA KEV</SelectItem>
                <SelectItem value="NVD">NVD CVEs</SelectItem>
                <SelectItem value="URLhaus">URLhaus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!threatFeed && !scanning && (
            <p className="text-center text-muted-foreground py-8">No threat data yet. Click "Run Full Scan" to fetch.</p>
          )}

          {threatFeed && (
            <div className="space-y-4">
              {/* CISA KEV */}
              {(threatFilter === 'All' || threatFilter === 'CISA') && threatFeed.cisaKEV.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-red-400" /> CISA Known Exploited Vulnerabilities</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {threatFeed.cisaKEV.slice(0, 15).map((v, i) => (
                      <div key={i} className={cn('p-3 rounded border', v.affectsOurOrgs ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border')}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={severityBadge('critical')} variant="outline">CRITICAL</Badge>
                              <span className="font-mono text-sm">{v.cveID}</span>
                              {v.affectsOurOrgs && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30" variant="outline">AFFECTS OUR ORGS</Badge>}
                            </div>
                            <p className="text-sm mt-1 font-medium">{v.vulnerabilityName}</p>
                            <p className="text-xs text-muted-foreground mt-1">{v.vendorProject} — {v.product}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.shortDescription}</p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{v.dateAdded}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* NVD CVEs */}
              {(threatFilter === 'All' || threatFilter === 'NVD') && threatFeed.latestCVEs.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-400" /> Latest High-Severity CVEs</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {threatFeed.latestCVEs.slice(0, 10).map((c, i) => (
                      <div key={i} className={cn('p-3 rounded border', c.affectsTech ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border')}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={severityBadge(c.severity)} variant="outline">{c.severity.toUpperCase()}</Badge>
                          <span className="font-mono text-sm">{c.cveID}</span>
                          <span className="text-xs text-muted-foreground">CVSS {c.score}</span>
                          {c.affectsTech && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30" variant="outline">AFFECTS COMMON TECH</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Malicious URLs */}
              {(threatFilter === 'All' || threatFilter === 'URLhaus') && threatFeed.maliciousUrls.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-purple-400" /> Malicious URLs (Somalia-related)</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {threatFeed.maliciousUrls.map((u, i) => (
                      <div key={i} className="p-3 rounded border border-red-500/20 bg-red-500/5">
                        <div className="flex items-center gap-2">
                          <Badge className={severityBadge('high')} variant="outline">{u.threat}</Badge>
                          <span className="font-mono text-xs break-all">{u.url}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Added: {u.dateAdded} | Status: {u.status}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {threatFeed.cisaKEV.length === 0 && threatFeed.latestCVEs.length === 0 && threatFeed.maliciousUrls.length === 0 && (
                <Alert className="bg-emerald-500/10 border-emerald-500/30">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <AlertTitle className="text-emerald-400">No active threats detected</AlertTitle>
                  <AlertDescription>All feeds are clear at this time.</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── Tab 3: Tech Stack ─── */}
        <TabsContent value="tech" className="space-y-4">
          {Object.keys(techFingerprints).length === 0 && !scanning && (
            <p className="text-center text-muted-foreground py-8">No tech data yet. Run a scan to fingerprint organizations.</p>
          )}
          {Object.keys(techFingerprints).length > 0 && (
            <Card className="border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Web Server</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>CMS</TableHead>
                      <TableHead>CDN</TableHead>
                      <TableHead>JS Libraries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgs.map(org => {
                      const fp = techFingerprints[org.url];
                      if (!fp) return (
                        <TableRow key={org.id}>
                          <TableCell className="font-medium">{org.name}</TableCell>
                          <TableCell colSpan={5} className="text-muted-foreground">Pending...</TableCell>
                        </TableRow>
                      );
                      if (fp.error) return (
                        <TableRow key={org.id}>
                          <TableCell className="font-medium">{org.name}</TableCell>
                          <TableCell colSpan={5} className="text-red-400">Check Failed</TableCell>
                        </TableRow>
                      );
                      const t = fp.technologies!;
                      return (
                        <TableRow key={org.id}>
                          <TableCell className="font-medium">{org.name}</TableCell>
                          <TableCell>{t.webServer ? `${t.webServer}${t.webServerVersion ? '/' + t.webServerVersion : ''}` : '—'}</TableCell>
                          <TableCell>{t.language ? `${t.language}${t.languageVersion ? '/' + t.languageVersion : ''}` : '—'}</TableCell>
                          <TableCell>{t.cms ? `${t.cms}${t.cmsVersion ? ' ' + t.cmsVersion : ''}` : '—'}</TableCell>
                          <TableCell>{t.cdn || '—'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {t.jsLibraries.length > 0 ? t.jsLibraries.map(lib => (
                                <Badge key={lib} variant="outline" className="text-xs">{lib}</Badge>
                              )) : '—'}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Tab 4: Phishing ─── */}
        <TabsContent value="phishing" className="space-y-4">
          {phishingResults.length === 0 && !scanning && (
            <p className="text-center text-muted-foreground py-8">No phishing data yet. Run a scan to check for lookalike domains.</p>
          )}

          {phishingResults.length > 0 && totalPhishing === 0 && (
            <Alert className="bg-emerald-500/10 border-emerald-500/30">
              <Check className="w-4 h-4 text-emerald-400" />
              <AlertTitle className="text-emerald-400">No lookalike domains detected</AlertTitle>
              <AlertDescription>All monitored organizations are clear of phishing domain threats.</AlertDescription>
            </Alert>
          )}

          {totalPhishing > 0 && (
            <>
              <div className="flex gap-3">
                <Card className="flex-1 border-border">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-400">{totalPhishing}</p>
                    <p className="text-xs text-muted-foreground">Lookalike Domains</p>
                  </CardContent>
                </Card>
                <Card className="flex-1 border-red-500/20">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-red-400">{activePhishing}</p>
                    <p className="text-xs text-muted-foreground">Active Sites</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead>Original</TableHead>
                        <TableHead>Lookalike</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead>Risk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phishingResults.flatMap(r => r.lookalikeDomains.map((d, i) => (
                        <TableRow key={`${r.domain}-${i}`} className={d.hasWebsite ? 'bg-red-500/5' : ''}>
                          <TableCell className="font-medium">{r.organization}</TableCell>
                          <TableCell className="font-mono text-xs">{r.domain}</TableCell>
                          <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                          <TableCell className="font-mono text-xs">{d.ip || '—'}</TableCell>
                          <TableCell>{d.hasWebsite ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30" variant="outline">Active</Badge> : <span className="text-muted-foreground">No</span>}</TableCell>
                          <TableCell><Badge className={d.risk === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'} variant="outline">{d.risk}</Badge></TableCell>
                        </TableRow>
                      )))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Tab 5: Breaches ─── */}
        <TabsContent value="breaches" className="space-y-4">
          {breachResults.length === 0 && !scanning && (
            <p className="text-center text-muted-foreground py-8">No breach data yet. Run a scan to check for data breaches.</p>
          )}

          {breachResults.length > 0 && totalBreaches === 0 && (
            <Alert className="bg-emerald-500/10 border-emerald-500/30">
              <Check className="w-4 h-4 text-emerald-400" />
              <AlertTitle className="text-emerald-400">No known data breaches detected</AlertTitle>
              <AlertDescription>No monitored organization domains appear in known breach databases.</AlertDescription>
            </Alert>
          )}

          {totalBreaches > 0 && (
            <Card className="border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Breach</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Data Types</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breachResults.flatMap(r => r.breaches.map((b, i) => {
                      const isRecent = new Date(b.date) > new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
                      return (
                        <TableRow key={`${r.domain}-${i}`} className={isRecent ? 'bg-red-500/5' : 'bg-yellow-500/5'}>
                          <TableCell className="font-medium">{r.organization}</TableCell>
                          <TableCell>{b.name || b.title}</TableCell>
                          <TableCell className="font-mono text-xs">{b.date}</TableCell>
                          <TableCell>{b.recordCount?.toLocaleString() || '?'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {b.dataTypes.slice(0, 4).map(dt => (
                                <Badge key={dt} variant="outline" className="text-xs">{dt}</Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {breachResults.length > 0 && (
            <p className="text-xs text-muted-foreground text-center italic">
              Note: Full domain-specific breach search requires a paid HIBP API key. Showing publicly available breach data relevant to your sector.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Detail Modal ─── */}
      <Dialog open={!!detailOrg} onOpenChange={() => setDetailOrg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailOrg && <ScoreGauge score={detailOrg.score} size={60} />}
              <div>
                <p>{detailOrg?.org.name}</p>
                <p className="text-xs text-muted-foreground font-normal">{detailOrg?.org.sector} — {detailOrg?.org.url}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {detailOrg && (
            <div className="space-y-3">
              <p className="text-sm">Overall Score: <span className={cn('font-bold', gradeColor(detailOrg.grade))}>{detailOrg.score}/100 ({detailOrg.grade})</span></p>
              <div className="space-y-2">
                {Object.entries(detailOrg.breakdown).map(([key, val]) => {
                  const maxes: Record<string, number> = { uptime: 15, ssl: 15, ddos: 15, email: 10, headers: 10, ports: 10, defacement: 10, dns: 5, blacklist: 5, software: 5 };
                  const max = maxes[key] || 10;
                  return (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{key}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                          <div className={cn('h-full rounded-full', val / max >= 0.8 ? 'bg-emerald-500' : val / max >= 0.5 ? 'bg-yellow-500' : 'bg-red-500')}
                            style={{ width: `${(val / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono w-10 text-right">{val}/{max}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ThreatIntelligence;
