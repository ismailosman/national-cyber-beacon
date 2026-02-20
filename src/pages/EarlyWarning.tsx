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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Radar, Eye, Globe, ShieldBan, Mail, Radio, FileCheck, RefreshCw,
  ChevronDown, Search, ShieldCheck, AlertTriangle, Siren, Check, X,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface MonitoredOrg {
  id: string;
  name: string;
  url: string;
  sector: string;
  is_active: boolean;
}

interface Baseline {
  id: string;
  organization_id: string | null;
  url: string;
  content_hash: string | null;
  page_title: string | null;
  page_size: number | null;
  dns_records: any;
}

interface DefacementResult {
  url: string;
  currentHash: string | null;
  currentTitle: string | null;
  currentSize: number | null;
  hashChanged: boolean;
  titleChanged: boolean;
  sizeAnomaly: boolean;
  defacementKeywordsFound: string[];
  isDefaced: boolean;
  error: string | null;
  checkedAt: string;
}

interface DnsResult {
  domain: string;
  records: { A: string[]; AAAA: string[]; MX: string[]; NS: string[]; CNAME: string[]; TXT: string[] };
  emailSecurity: {
    spfExists: boolean; spfRecord: string | null;
    dmarcExists: boolean; dmarcRecord: string | null; dmarcPolicy: string | null;
    dkimFound: boolean;
  };
  error: string | null;
  checkedAt: string;
  dnsChanged?: boolean;
  changes?: string[];
}

interface BlacklistResult {
  url: string;
  blacklisted: boolean;
  blacklistSources: string[];
  reputation: string;
  error: string | null;
  checkedAt: string;
}

interface SecurityHeadersResult {
  url: string;
  headers: Record<string, { present: boolean; value: string | null }>;
  score: number;
  maxScore: number;
  grade: string;
  error: string | null;
  checkedAt: string;
}

interface PortResult {
  url: string;
  openPorts: { port: number; service: string; risk: string }[];
  error: string | null;
  checkedAt: string;
}

/* ─── Constants ─── */
const SECTORS = ['All', 'Government', 'Telecom', 'Banking', 'Education'];
const CHECK_TYPES = ['All', 'Defacement', 'DNS', 'Blacklist', 'Email Security', 'Open Ports', 'Security Headers'];
const RISK_LEVELS_FILTER = ['All', 'Safe', 'Warning', 'Critical'];

const riskColors: Record<string, string> = {
  safe: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const sectorColors: Record<string, string> = {
  Government: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Telecom: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Banking: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Education: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

function getEmailGrade(spf: boolean, dmarc: boolean, dmarcPolicy: string | null, dkim: boolean): string {
  if (spf && dmarc && dkim && dmarcPolicy === 'reject') return 'A';
  if (spf && dmarc && dkim && dmarcPolicy === 'quarantine') return 'B';
  if (spf && dmarc && dmarcPolicy === 'none') return 'C';
  if (spf && !dmarc) return 'D';
  return 'F';
}

function gradeColor(grade: string): string {
  if (grade === 'A' || grade === 'B') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (grade === 'C') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (grade === 'D') return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

/* ─── Component ─── */
const EarlyWarning: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [orgs, setOrgs] = useState<MonitoredOrg[]>([]);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  // Results
  const [defacementResults, setDefacementResults] = useState<Record<string, DefacementResult>>({});
  const [dnsResults, setDnsResults] = useState<Record<string, DnsResult>>({});
  const [blacklistResults, setBlacklistResults] = useState<Record<string, BlacklistResult>>({});
  const [headersResults, setHeadersResults] = useState<Record<string, SecurityHeadersResult>>({});
  const [portResults, setPortResults] = useState<Record<string, PortResult>>({});

  // Filters
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [checkTypeFilter, setCheckTypeFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');

  // Panels
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
    defacement: true, dns: true, blacklist: true, email: true, ports: true, headers: true
  });

  // Detail modal
  const [detailOrg, setDetailOrg] = useState<MonitoredOrg | null>(null);

  /* ─── Load orgs and baselines ─── */
  useEffect(() => {
    const load = async () => {
      const [orgsRes, baselinesRes] = await Promise.all([
        supabase.from('organizations_monitored').select('*').eq('is_active', true),
        supabase.from('baselines').select('*') as any,
      ]);
      if (orgsRes.data) setOrgs(orgsRes.data);
      if (baselinesRes.data) setBaselines(baselinesRes.data);
      setLoading(false);
    };
    load();
  }, []);

  /* ─── Check Functions ─── */
  const runDefacementCheck = useCallback(async (targetOrgs: MonitoredOrg[]) => {
    const urls = targetOrgs.map(o => {
      const bl = baselines.find(b => b.url === o.url);
      return { url: o.url, baselineHash: bl?.content_hash, baselineTitle: bl?.page_title, baselineSize: bl?.page_size };
    });
    try {
      const { data, error } = await supabase.functions.invoke('check-defacement', { body: { urls } });
      if (error) throw error;
      const newResults: Record<string, DefacementResult> = { ...defacementResults };
      for (const r of data.results || []) {
        newResults[r.url] = r;
        // Update baseline if first check
        const bl = baselines.find(b => b.url === r.url);
        if (!bl && r.currentHash) {
          const org = targetOrgs.find(o => o.url === r.url);
          await (supabase.from('baselines') as any).insert({
            organization_id: org?.id, url: r.url,
            content_hash: r.currentHash, page_title: r.currentTitle, page_size: r.currentSize,
          });
        }
        // Generate alert for defacement
        if (r.isDefaced) {
          const org = targetOrgs.find(o => o.url === r.url);
          if (org) await generateAlert(org, 'critical', `Website Defacement Detected`, `Defacement indicators found on ${r.url}. Keywords: ${r.defacementKeywordsFound.join(', ')}`);
        }
      }
      setDefacementResults(newResults);
    } catch (err) {
      console.error('Defacement check failed:', err);
    }
  }, [baselines, defacementResults]);

  const runDnsCheck = useCallback(async (targetOrgs: MonitoredOrg[]) => {
    const domains = targetOrgs.map(o => extractDomain(o.url));
    try {
      const { data, error } = await supabase.functions.invoke('check-dns', { body: { domains } });
      if (error) throw error;
      const newResults: Record<string, DnsResult> = { ...dnsResults };
      for (const r of data.results || []) {
        // Compare with baseline
        const org = targetOrgs.find(o => extractDomain(o.url) === r.domain);
        const bl = baselines.find(b => extractDomain(b.url) === r.domain);
        if (bl?.dns_records) {
          const changes: string[] = [];
          const bDns = bl.dns_records as any;
          if (JSON.stringify(r.records.A?.sort()) !== JSON.stringify((bDns.A || []).sort())) changes.push(`A record changed`);
          if (JSON.stringify(r.records.NS?.sort()) !== JSON.stringify((bDns.NS || []).sort())) changes.push(`NS records changed`);
          if (JSON.stringify(r.records.MX?.sort()) !== JSON.stringify((bDns.MX || []).sort())) changes.push(`MX records changed`);
          r.dnsChanged = changes.length > 0;
          r.changes = changes;
          if (changes.some(c => c.includes('NS'))) {
            if (org) await generateAlert(org, 'critical', 'DNS NS Records Changed', `Nameserver records changed for ${r.domain} - possible hijacking`);
          } else if (changes.some(c => c.includes('A record'))) {
            if (org) await generateAlert(org, 'high', 'DNS A Record Changed', `A record changed for ${r.domain}: ${changes.join(', ')}`);
          }
        } else {
          r.dnsChanged = false;
          r.changes = [];
          // Store baseline
          if (org) {
            const existingBl = baselines.find(b => b.url === org.url);
            if (existingBl) {
              await (supabase.from('baselines') as any).update({ dns_records: r.records }).eq('id', existingBl.id);
            } else {
              await (supabase.from('baselines') as any).insert({
                organization_id: org.id, url: org.url, dns_records: r.records,
              });
            }
          }
        }
        newResults[r.domain] = r;
      }
      setDnsResults(newResults);
    } catch (err) {
      console.error('DNS check failed:', err);
    }
  }, [baselines, dnsResults]);

  const runBlacklistCheck = useCallback(async (targetOrgs: MonitoredOrg[]) => {
    const urls = targetOrgs.map(o => o.url);
    try {
      const { data, error } = await supabase.functions.invoke('check-blacklist', { body: { urls } });
      if (error) throw error;
      const newResults: Record<string, BlacklistResult> = { ...blacklistResults };
      for (const r of data.results || []) {
        newResults[r.url] = r;
        if (r.blacklisted) {
          const org = targetOrgs.find(o => o.url === r.url);
          if (org) await generateAlert(org, 'critical', 'Domain Blacklisted', `${r.url} found on blacklists: ${r.blacklistSources.join(', ')}`);
        }
      }
      setBlacklistResults(newResults);
    } catch (err) {
      console.error('Blacklist check failed:', err);
    }
  }, [blacklistResults]);

  const runHeadersCheck = useCallback(async (targetOrgs: MonitoredOrg[]) => {
    const urls = targetOrgs.map(o => o.url);
    try {
      const { data, error } = await supabase.functions.invoke('check-security-headers', { body: { urls } });
      if (error) throw error;
      const newResults: Record<string, SecurityHeadersResult> = { ...headersResults };
      for (const r of data.results || []) {
        newResults[r.url] = r;
        if (r.grade === 'F') {
          const org = targetOrgs.find(o => o.url === r.url);
          if (org) await generateAlert(org, 'high', 'Security Headers Grade F', `${r.url} has no security headers (grade F)`);
        }
      }
      setHeadersResults(newResults);
    } catch (err) {
      console.error('Security headers check failed:', err);
    }
  }, [headersResults]);

  const runPortCheck = useCallback(async (targetOrgs: MonitoredOrg[]) => {
    // HTTP-based port probing (best-effort since Deno doesn't support raw TCP)
    const newResults: Record<string, PortResult> = { ...portResults };
    for (const org of targetOrgs) {
      const domain = extractDomain(org.url);
      const openPorts: { port: number; service: string; risk: string }[] = [];
      const portsToCheck = [
        { port: 8080, service: 'HTTP Alt', risk: 'medium' },
        { port: 8443, service: 'HTTPS Alt', risk: 'medium' },
      ];
      for (const p of portsToCheck) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 3000);
          await fetch(`http://${domain}:${p.port}`, { signal: ctrl.signal, mode: 'no-cors' });
          clearTimeout(t);
          openPorts.push(p);
        } catch {
          // Port not reachable or blocked by CORS - expected
        }
      }
      newResults[org.url] = {
        url: org.url, openPorts, error: null, checkedAt: new Date().toISOString(),
      };
    }
    setPortResults(newResults);
  }, [portResults]);

  /* ─── Alert Generation (with dedup) ─── */
  const generateAlert = async (org: MonitoredOrg, severity: string, title: string, description: string) => {
    try {
      // Check for duplicate within 24h
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase.from('alerts')
        .select('id')
        .eq('title', title)
        .gte('created_at', since)
        .limit(1);
      if (existing && existing.length > 0) return;

      await supabase.from('alerts').insert({
        title,
        description,
        severity: severity as any,
        source: 'early-warning',
        status: 'open',
      });
    } catch (err) {
      console.error('Failed to generate alert:', err);
    }
  };

  /* ─── Run All Checks ─── */
  const runAllChecks = useCallback(async () => {
    if (orgs.length === 0) return;
    setChecking(true);
    toast({ title: 'Running all security checks...', description: `Scanning ${orgs.length} organizations` });
    try {
      await Promise.all([
        runDefacementCheck(orgs),
        runDnsCheck(orgs),
        runBlacklistCheck(orgs),
        runHeadersCheck(orgs),
        runPortCheck(orgs),
      ]);
      setLastChecked(new Date().toISOString());
      toast({ title: 'All checks complete', description: 'Early warning scan finished' });
    } catch {
      toast({ title: 'Some checks failed', variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  }, [orgs, runDefacementCheck, runDnsCheck, runBlacklistCheck, runHeadersCheck, runPortCheck, toast]);

  // Run on mount
  const initialRun = useRef(false);
  useEffect(() => {
    if (!loading && orgs.length > 0 && !initialRun.current) {
      initialRun.current = true;
      runAllChecks();
    }
  }, [loading, orgs.length, runAllChecks]);

  /* ─── Computed Summaries ─── */
  const getCriticalCount = () => {
    let count = 0;
    Object.values(defacementResults).forEach(r => { if (r.isDefaced) count++; });
    Object.values(dnsResults).forEach(r => { if (r.dnsChanged && r.changes?.some(c => c.includes('NS'))) count++; });
    Object.values(blacklistResults).forEach(r => { if (r.blacklisted) count++; });
    return count;
  };

  const getWarningCount = () => {
    let count = 0;
    Object.values(defacementResults).forEach(r => { if (r.hashChanged && !r.isDefaced) count++; });
    Object.values(dnsResults).forEach(r => { if (r.dnsChanged && !r.changes?.some(c => c.includes('NS'))) count++; });
    Object.values(headersResults).forEach(r => { if (r.grade === 'D' || r.grade === 'F') count++; });
    return count;
  };

  const getDefacementCount = () => Object.values(defacementResults).filter(r => r.isDefaced).length;
  const getBlacklistedCount = () => Object.values(blacklistResults).filter(r => r.blacklisted).length;
  const criticalCount = getCriticalCount();
  const warningCount = getWarningCount();
  const allClearCount = orgs.length - criticalCount - warningCount;

  /* ─── Filtered Orgs ─── */
  const filteredOrgs = orgs.filter(o => {
    if (search && !o.name.toLowerCase().includes(search.toLowerCase()) && !o.url.toLowerCase().includes(search.toLowerCase())) return false;
    if (sectorFilter !== 'All' && o.sector !== sectorFilter) return false;
    return true;
  });

  /* ─── Panel Toggle ─── */
  const togglePanel = (key: string) => setOpenPanels(p => ({ ...p, [key]: !p[key] }));

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
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
            <Radar className="w-7 h-7 text-neon-cyan" /> Early Warning System
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Proactive compromise detection and advance security alerting</p>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && <span className="text-xs text-muted-foreground font-mono">Last: {new Date(lastChecked).toLocaleTimeString()}</span>}
          <Button onClick={runAllChecks} disabled={checking} className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30">
            <RefreshCw className={cn('w-4 h-4 mr-2', checking && 'animate-spin')} />
            {checking ? 'Scanning...' : 'Run All Checks Now'}
          </Button>
        </div>
      </div>

      {/* Threat Banner */}
      {criticalCount > 0 ? (
        <Alert className="border-red-500/50 bg-red-500/10 animate-pulse">
          <Siren className="w-5 h-5 text-red-400" />
          <AlertTitle className="text-red-400 font-bold">🚨 CRITICAL ALERT</AlertTitle>
          <AlertDescription className="text-red-300">
            {criticalCount} organization(s) may be compromised — immediate investigation required
          </AlertDescription>
        </Alert>
      ) : warningCount > 0 ? (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <AlertTitle className="text-yellow-400">⚠ Security Warnings</AlertTitle>
          <AlertDescription className="text-yellow-300">
            {warningCount} organization(s) have security warnings requiring attention
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-500/50 bg-emerald-500/10">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <AlertTitle className="text-emerald-400">✓ All Clear</AlertTitle>
          <AlertDescription className="text-emerald-300">No active threats detected. All organizations are secure.</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        <SummaryCard icon={<Radar className="w-5 h-5" />} label="Organizations Scanned" value={orgs.length} color="text-blue-400" bgColor="bg-blue-500/10 border-blue-500/20" />
        <SummaryCard icon={<ShieldCheck className="w-5 h-5" />} label="All Clear" value={Math.max(0, allClearCount)} color="text-emerald-400" bgColor="bg-emerald-500/10 border-emerald-500/20" />
        <SummaryCard icon={<AlertTriangle className="w-5 h-5" />} label="Warnings" value={warningCount} color="text-yellow-400" bgColor="bg-yellow-500/10 border-yellow-500/20" />
        <SummaryCard icon={<Siren className="w-5 h-5" />} label="Critical Alerts" value={criticalCount} color="text-red-400" bgColor={cn("bg-red-500/10 border-red-500/20", criticalCount > 0 && "animate-pulse")} />
        <SummaryCard icon={<Eye className="w-5 h-5" />} label="Defacements" value={getDefacementCount()} color="text-red-400" bgColor="bg-red-900/20 border-red-900/30" />
        <SummaryCard icon={<ShieldBan className="w-5 h-5" />} label="Blacklisted" value={getBlacklistedCount()} color="text-red-400" bgColor="bg-red-900/20 border-red-900/30" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search organizations..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-[140px] bg-card border-border"><SelectValue /></SelectTrigger>
          <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={checkTypeFilter} onValueChange={setCheckTypeFilter}>
          <SelectTrigger className="w-[160px] bg-card border-border"><SelectValue /></SelectTrigger>
          <SelectContent>{CHECK_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[120px] bg-card border-border"><SelectValue /></SelectTrigger>
          <SelectContent>{RISK_LEVELS_FILTER.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* 6 Panels */}
      {(checkTypeFilter === 'All' || checkTypeFilter === 'Defacement') && (
        <CheckPanel
          title="Website Defacement Monitor" icon={<Eye className="w-5 h-5 text-red-400" />}
          open={openPanels.defacement} onToggle={() => togglePanel('defacement')}
          passCount={filteredOrgs.filter(o => defacementResults[o.url] && !defacementResults[o.url].isDefaced && !defacementResults[o.url].hashChanged).length}
          failCount={filteredOrgs.filter(o => defacementResults[o.url]?.isDefaced).length}
          totalCount={filteredOrgs.length}
        >
          {isMobile ? (
            <div className="space-y-3">
              {filteredOrgs.map(o => {
                const r = defacementResults[o.url];
                return (
                  <Card key={o.id} className="bg-card/50 border-border/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm cursor-pointer hover:text-neon-cyan" onClick={() => setDetailOrg(o)}>{o.name}</span>
                      {r ? (
                        r.isDefaced ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">🚨 DEFACED</Badge>
                        : r.hashChanged ? <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">⚠ Changed</Badge>
                        : r.error ? <Badge variant="secondary">Failed</Badge>
                        : <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ Clean</Badge>
                      ) : <Badge variant="secondary">Pending</Badge>}
                    </div>
                    {r?.defacementKeywordsFound?.length > 0 && (
                      <p className="text-xs text-red-400">Keywords: {r.defacementKeywordsFound.join(', ')}</p>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-muted-foreground">
                  <th className="text-left p-2">Organization</th>
                  <th className="text-left p-2">URL</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Title Match</th>
                  <th className="text-left p-2">Size Change</th>
                  <th className="text-left p-2">Last Checked</th>
                </tr></thead>
                <tbody>
                  {filteredOrgs.map(o => {
                    const r = defacementResults[o.url];
                    return (
                      <tr key={o.id} className="border-b border-border/30 hover:bg-card/50">
                        <td className="p-2 cursor-pointer hover:text-neon-cyan" onClick={() => setDetailOrg(o)}>{o.name}</td>
                        <td className="p-2">
                          <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline flex items-center gap-1 text-xs">
                            {extractDomain(o.url)} <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="p-2">
                          {r ? (
                            r.isDefaced ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">🚨 DEFACED</Badge>
                            : r.hashChanged ? <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">⚠ Content Changed</Badge>
                            : r.error ? <Badge variant="secondary">Check Failed</Badge>
                            : <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ Clean</Badge>
                          ) : <Badge variant="secondary">Pending</Badge>}
                        </td>
                        <td className="p-2">{r ? (r.titleChanged ? <X className="w-4 h-4 text-red-400" /> : <Check className="w-4 h-4 text-emerald-400" />) : '—'}</td>
                        <td className="p-2">{r ? (r.sizeAnomaly ? <span className="text-red-400 text-xs">⚠ &gt;70%</span> : <span className="text-emerald-400 text-xs">Normal</span>) : '—'}</td>
                        <td className="p-2 text-xs text-muted-foreground">{r?.checkedAt ? new Date(r.checkedAt).toLocaleTimeString() : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CheckPanel>
      )}

      {(checkTypeFilter === 'All' || checkTypeFilter === 'DNS') && (
        <CheckPanel
          title="DNS Integrity Monitor" icon={<Globe className="w-5 h-5 text-blue-400" />}
          open={openPanels.dns} onToggle={() => togglePanel('dns')}
          passCount={filteredOrgs.filter(o => { const r = dnsResults[extractDomain(o.url)]; return r && !r.dnsChanged; }).length}
          failCount={filteredOrgs.filter(o => { const r = dnsResults[extractDomain(o.url)]; return r?.dnsChanged; }).length}
          totalCount={filteredOrgs.length}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-2">Organization</th>
                <th className="text-left p-2">Domain</th>
                <th className="text-left p-2">A Records</th>
                <th className="text-left p-2">NS Records</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Changes</th>
              </tr></thead>
              <tbody>
                {filteredOrgs.map(o => {
                  const domain = extractDomain(o.url);
                  const r = dnsResults[domain];
                  return (
                    <tr key={o.id} className="border-b border-border/30 hover:bg-card/50">
                      <td className="p-2 cursor-pointer hover:text-neon-cyan" onClick={() => setDetailOrg(o)}>{o.name}</td>
                      <td className="p-2 text-xs font-mono">{domain}</td>
                      <td className="p-2 text-xs font-mono">{r?.records?.A?.join(', ') || '—'}</td>
                      <td className="p-2 text-xs font-mono">{r?.records?.NS?.slice(0, 2).join(', ') || '—'}</td>
                      <td className="p-2">
                        {r ? (
                          r.error ? <Badge variant="secondary">Failed</Badge>
                          : r.dnsChanged && r.changes?.some(c => c.includes('NS')) ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30">🚨 HIJACKED</Badge>
                          : r.dnsChanged ? <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">⚠ Changed</Badge>
                          : <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ Stable</Badge>
                        ) : <Badge variant="secondary">Pending</Badge>}
                      </td>
                      <td className="p-2 text-xs">{r?.changes?.join('; ') || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CheckPanel>
      )}

      {(checkTypeFilter === 'All' || checkTypeFilter === 'Blacklist') && (
        <CheckPanel
          title="Blacklist & Reputation" icon={<ShieldBan className="w-5 h-5 text-orange-400" />}
          open={openPanels.blacklist} onToggle={() => togglePanel('blacklist')}
          passCount={filteredOrgs.filter(o => blacklistResults[o.url] && !blacklistResults[o.url].blacklisted).length}
          failCount={filteredOrgs.filter(o => blacklistResults[o.url]?.blacklisted).length}
          totalCount={filteredOrgs.length}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-2">Organization</th>
                <th className="text-left p-2">URL</th>
                <th className="text-left p-2">Blacklist Status</th>
                <th className="text-left p-2">Reputation</th>
                <th className="text-left p-2">Sources</th>
                <th className="text-left p-2">Last Checked</th>
              </tr></thead>
              <tbody>
                {filteredOrgs.map(o => {
                  const r = blacklistResults[o.url];
                  return (
                    <tr key={o.id} className="border-b border-border/30 hover:bg-card/50">
                      <td className="p-2 cursor-pointer hover:text-neon-cyan" onClick={() => setDetailOrg(o)}>{o.name}</td>
                      <td className="p-2 text-xs">{extractDomain(o.url)}</td>
                      <td className="p-2">
                        {r ? (
                          r.blacklisted ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">🚨 BLACKLISTED</Badge>
                          : r.error ? <Badge variant="secondary">Failed</Badge>
                          : <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ Clean</Badge>
                        ) : <Badge variant="secondary">Pending</Badge>}
                      </td>
                      <td className="p-2 text-xs">{r?.reputation || '—'}</td>
                      <td className="p-2 text-xs">{r?.blacklistSources?.join(', ') || '—'}</td>
                      <td className="p-2 text-xs text-muted-foreground">{r?.checkedAt ? new Date(r.checkedAt).toLocaleTimeString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CheckPanel>
      )}

      {(checkTypeFilter === 'All' || checkTypeFilter === 'Email Security') && (
        <CheckPanel
          title="Email Security (SPF/DKIM/DMARC)" icon={<Mail className="w-5 h-5 text-purple-400" />}
          open={openPanels.email} onToggle={() => togglePanel('email')}
          passCount={filteredOrgs.filter(o => {
            const r = dnsResults[extractDomain(o.url)];
            return r?.emailSecurity?.spfExists && r?.emailSecurity?.dmarcExists;
          }).length}
          failCount={filteredOrgs.filter(o => {
            const r = dnsResults[extractDomain(o.url)];
            return r && (!r.emailSecurity?.spfExists || !r.emailSecurity?.dmarcExists);
          }).length}
          totalCount={filteredOrgs.length}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-2">Organization</th>
                <th className="text-left p-2">Domain</th>
                <th className="text-left p-2">SPF</th>
                <th className="text-left p-2">DMARC</th>
                <th className="text-left p-2">Policy</th>
                <th className="text-left p-2">DKIM</th>
                <th className="text-left p-2">Grade</th>
              </tr></thead>
              <tbody>
                {filteredOrgs.map(o => {
                  const domain = extractDomain(o.url);
                  const r = dnsResults[domain];
                  const es = r?.emailSecurity;
                  const grade = es ? getEmailGrade(es.spfExists, es.dmarcExists, es.dmarcPolicy, es.dkimFound) : '—';
                  return (
                    <tr key={o.id} className="border-b border-border/30 hover:bg-card/50">
                      <td className="p-2 cursor-pointer hover:text-neon-cyan" onClick={() => setDetailOrg(o)}>{o.name}</td>
                      <td className="p-2 text-xs font-mono">{domain}</td>
                      <td className="p-2">{es ? (es.spfExists ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />) : '—'}</td>
                      <td className="p-2">{es ? (es.dmarcExists ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />) : '—'}</td>
                      <td className="p-2 text-xs">{es?.dmarcPolicy || '—'}</td>
                      <td className="p-2">{es ? (es.dkimFound ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />) : '—'}</td>
                      <td className="p-2">{grade !== '—' ? <Badge className={gradeColor(grade)}>{grade}</Badge> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CheckPanel>
      )}

      {(checkTypeFilter === 'All' || checkTypeFilter === 'Open Ports') && (
        <CheckPanel
          title="Exposed Ports & Services" icon={<Radio className="w-5 h-5 text-cyan-400" />}
          open={openPanels.ports} onToggle={() => togglePanel('ports')}
          passCount={filteredOrgs.filter(o => portResults[o.url] && portResults[o.url].openPorts.length === 0).length}
          failCount={filteredOrgs.filter(o => portResults[o.url]?.openPorts?.length > 0).length}
          totalCount={filteredOrgs.length}
          note="Limited to HTTP-based probing. Full TCP port scanning requires dedicated infrastructure."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-2">Organization</th>
                <th className="text-left p-2">Hostname</th>
                <th className="text-left p-2">Open Ports</th>
                <th className="text-left p-2">Risk Level</th>
                <th className="text-left p-2">Last Checked</th>
              </tr></thead>
              <tbody>
                {filteredOrgs.map(o => {
                  const r = portResults[o.url];
                  return (
                    <tr key={o.id} className="border-b border-border/30 hover:bg-card/50">
                      <td className="p-2 cursor-pointer hover:text-neon-cyan" onClick={() => setDetailOrg(o)}>{o.name}</td>
                      <td className="p-2 text-xs font-mono">{extractDomain(o.url)}</td>
                      <td className="p-2">
                        {r ? (r.openPorts.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {r.openPorts.map(p => (
                              <Badge key={p.port} className={p.risk === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}>
                                {p.port} ({p.service})
                              </Badge>
                            ))}
                          </div>
                        ) : <span className="text-emerald-400 text-xs">✓ No exposed services</span>) : '—'}
                      </td>
                      <td className="p-2">
                        {r ? (r.openPorts.some(p => p.risk === 'critical') ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Critical</Badge>
                        : r.openPorts.length > 0 ? <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Medium</Badge>
                        : <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Low</Badge>) : '—'}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{r?.checkedAt ? new Date(r.checkedAt).toLocaleTimeString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CheckPanel>
      )}

      {(checkTypeFilter === 'All' || checkTypeFilter === 'Security Headers') && (
        <CheckPanel
          title="Security Headers Score" icon={<FileCheck className="w-5 h-5 text-teal-400" />}
          open={openPanels.headers} onToggle={() => togglePanel('headers')}
          passCount={filteredOrgs.filter(o => { const r = headersResults[o.url]; return r && r.grade !== 'F' && r.grade !== 'D'; }).length}
          failCount={filteredOrgs.filter(o => { const r = headersResults[o.url]; return r && (r.grade === 'F' || r.grade === 'D'); }).length}
          totalCount={filteredOrgs.length}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-2">Organization</th>
                <th className="text-left p-2">HSTS</th>
                <th className="text-left p-2">CSP</th>
                <th className="text-left p-2">X-Frame</th>
                <th className="text-left p-2">X-CT</th>
                <th className="text-left p-2">XSS</th>
                <th className="text-left p-2">Referrer</th>
                <th className="text-left p-2">Permissions</th>
                <th className="text-left p-2">Score</th>
                <th className="text-left p-2">Grade</th>
              </tr></thead>
              <tbody>
                {filteredOrgs.map(o => {
                  const r = headersResults[o.url];
                  const h = r?.headers || {};
                  const hk = (k: string) => h[k]?.present;
                  return (
                    <tr key={o.id} className="border-b border-border/30 hover:bg-card/50">
                      <td className="p-2 cursor-pointer hover:text-neon-cyan" onClick={() => setDetailOrg(o)}>{o.name}</td>
                      <td className="p-2">{r ? (hk('strictTransportSecurity') ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />) : '—'}</td>
                      <td className="p-2">{r ? (hk('contentSecurityPolicy') ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />) : '—'}</td>
                      <td className="p-2">{r ? (hk('xFrameOptions') ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />) : '—'}</td>
                      <td className="p-2">{r ? (hk('xContentTypeOptions') ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />) : '—'}</td>
                      <td className="p-2">{r ? (hk('xXssProtection') ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />) : '—'}</td>
                      <td className="p-2">{r ? (hk('referrerPolicy') ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />) : '—'}</td>
                      <td className="p-2">{r ? (hk('permissionsPolicy') ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />) : '—'}</td>
                      <td className="p-2 text-xs">{r ? `${r.score}/${r.maxScore}` : '—'}</td>
                      <td className="p-2">{r ? <Badge className={gradeColor(r.grade)}>{r.grade}</Badge> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CheckPanel>
      )}

      {/* Organization Detail Modal */}
      <Dialog open={!!detailOrg} onOpenChange={() => setDetailOrg(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card border-border">
          {detailOrg && <OrgDetailContent
            org={detailOrg}
            defacement={defacementResults[detailOrg.url]}
            dns={dnsResults[extractDomain(detailOrg.url)]}
            blacklist={blacklistResults[detailOrg.url]}
            headers={headersResults[detailOrg.url]}
            ports={portResults[detailOrg.url]}
          />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ─── Sub-components ─── */
function SummaryCard({ icon, label, value, color, bgColor }: {
  icon: React.ReactNode; label: string; value: number; color: string; bgColor: string;
}) {
  return (
    <Card className={cn("min-w-[140px] border", bgColor)}>
      <CardContent className="p-4 flex flex-col items-center gap-1">
        <div className={color}>{icon}</div>
        <span className={cn("text-2xl font-bold", color)}>{value}</span>
        <span className="text-xs text-muted-foreground text-center">{label}</span>
      </CardContent>
    </Card>
  );
}

function CheckPanel({ title, icon, open, onToggle, children, passCount, failCount, totalCount, note }: {
  title: string; icon: React.ReactNode; open: boolean; onToggle: () => void;
  children: React.ReactNode; passCount: number; failCount: number; totalCount: number; note?: string;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <Card className="bg-card border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-card/80 transition-colors p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {icon}
                <CardTitle className="text-base">{title}</CardTitle>
                <div className="flex gap-2 ml-2">
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">{passCount} passed</Badge>
                  {failCount > 0 && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">{failCount} failed</Badge>}
                  <Badge variant="secondary" className="text-xs">{totalCount} total</Badge>
                </div>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
            </div>
            {note && <p className="text-xs text-muted-foreground mt-1 ml-8">⚡ {note}</p>}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-4 pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function OrgDetailContent({ org, defacement, dns, blacklist, headers, ports }: {
  org: MonitoredOrg; defacement?: DefacementResult; dns?: DnsResult;
  blacklist?: BlacklistResult; headers?: SecurityHeadersResult; ports?: PortResult;
}) {
  // Calculate overall score
  let score = 100;
  const recommendations: { priority: string; text: string }[] = [];

  if (defacement?.isDefaced) { score -= 40; recommendations.push({ priority: 'CRITICAL', text: 'Website appears defaced — investigate immediately' }); }
  if (blacklist?.blacklisted) { score -= 30; recommendations.push({ priority: 'CRITICAL', text: `Domain blacklisted on: ${blacklist.blacklistSources.join(', ')}` }); }
  if (dns?.dnsChanged && dns.changes?.some(c => c.includes('NS'))) { score -= 30; recommendations.push({ priority: 'CRITICAL', text: 'NS records changed — possible DNS hijacking' }); }

  if (dns?.emailSecurity && !dns.emailSecurity.dmarcExists) { score -= 10; recommendations.push({ priority: 'HIGH', text: 'Add DMARC record with p=reject policy' }); }
  if (dns?.emailSecurity && !dns.emailSecurity.spfExists) { score -= 10; recommendations.push({ priority: 'HIGH', text: 'Add SPF record to prevent email spoofing' }); }
  if (headers && headers.grade === 'F') { score -= 15; recommendations.push({ priority: 'HIGH', text: 'No security headers found — add HSTS, CSP, X-Frame-Options' }); }
  if (headers && headers.grade === 'D') { score -= 10; recommendations.push({ priority: 'MEDIUM', text: 'Improve security headers — currently grade D' }); }

  if (headers && !headers.headers?.contentSecurityPolicy?.present) { recommendations.push({ priority: 'MEDIUM', text: 'Add Content-Security-Policy header' }); }
  if (headers && !headers.headers?.permissionsPolicy?.present) { recommendations.push({ priority: 'LOW', text: 'Add Permissions-Policy header' }); }

  score = Math.max(0, score);
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Badge className={sectorColors[org.sector] || 'bg-muted'}>{org.sector}</Badge>
          {org.name}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 mt-4">
        {/* Score */}
        <div className="text-center p-4 bg-muted/30 rounded-lg">
          <span className={cn("text-4xl font-bold", scoreColor)}>{score}</span>
          <span className="text-muted-foreground text-sm">/100</span>
          <p className="text-xs text-muted-foreground mt-1">Overall Security Score</p>
        </div>

        {/* Check Summaries */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <MiniStatus label="Defacement" ok={defacement && !defacement.isDefaced && !defacement.hashChanged} critical={defacement?.isDefaced} warning={defacement?.hashChanged && !defacement?.isDefaced} />
          <MiniStatus label="DNS" ok={dns && !dns.dnsChanged} critical={dns?.dnsChanged && dns.changes?.some(c => c.includes('NS'))} warning={dns?.dnsChanged && !dns.changes?.some(c => c.includes('NS'))} />
          <MiniStatus label="Blacklist" ok={blacklist && !blacklist.blacklisted} critical={blacklist?.blacklisted} />
          <MiniStatus label="Email Security" ok={dns?.emailSecurity?.spfExists && dns?.emailSecurity?.dmarcExists} warning={dns?.emailSecurity && (!dns.emailSecurity.spfExists || !dns.emailSecurity.dmarcExists)} />
          <MiniStatus label="Ports" ok={ports && ports.openPorts.length === 0} warning={ports && ports.openPorts.length > 0} />
          <MiniStatus label="Headers" ok={headers && (headers.grade === 'A' || headers.grade === 'B')} warning={headers && (headers.grade === 'C' || headers.grade === 'D')} critical={headers?.grade === 'F'} />
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Recommendations</h4>
            <div className="space-y-1">
              {recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge className={
                    r.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    r.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                    r.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                    'bg-muted text-muted-foreground'
                  }>{r.priority}</Badge>
                  <span>{r.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function MiniStatus({ label, ok, warning, critical }: { label: string; ok?: boolean | null; warning?: boolean | null; critical?: boolean | null }) {
  return (
    <div className={cn("rounded-lg border p-2 text-center text-xs",
      critical ? 'bg-red-500/10 border-red-500/30 text-red-400' :
      warning ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
      ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
      'bg-muted/30 border-border text-muted-foreground'
    )}>
      <div className="font-medium">{label}</div>
      <div>{critical ? '🚨 Critical' : warning ? '⚠ Warning' : ok ? '✓ OK' : '—'}</div>
    </div>
  );
}

export default EarlyWarning;
