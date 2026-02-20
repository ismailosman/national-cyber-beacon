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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Crosshair, RefreshCw, Shield, Globe, Wrench, Fish, Database,
  AlertTriangle, Check, X, ExternalLink, Search, Trophy, RotateCw, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface MonitoredOrg {
  id: string; name: string; url: string; sector: string; is_active: boolean;
}

interface ThreatFeedData {
  cisaKEV: any[]; maliciousUrls: any[]; latestCVEs: any[]; feodoC2: any[]; fetchedAt: string;
}

interface TechFingerprint {
  url: string;
  technologies: {
    webServer: string | null; webServerVersion: string | null;
    language: string | null; languageVersion: string | null;
    cms: string | null; cmsVersion: string | null;
    cdn: string | null; jsLibraries: string[];
  } | null;
  error: string | null; errorMessage?: string; success?: boolean; checkedAt: string;
}

interface PhishingResult {
  organization: string; organizationId: string; domain: string;
  lookalikeDomains: { domain: string; exists: boolean; ip: string | null; hasWebsite: boolean; risk: string }[];
  totalFound: number; checkedAt: string;
}

interface BreachResult {
  organizationId?: string;
  domain: string; organization: string; breachCount: number; breachesFound: number;
  breaches: { name: string; title: string; date?: string; breachDate?: string; recordCount?: number; pwnCount?: number; dataClasses?: string[]; dataTypes?: string[]; description: string; isVerified: boolean; affectedEmails?: string[] }[];
  isClean: boolean | null;
  riskLevel?: string;
  source?: string;
  method?: string;
  note?: string;
  error?: string;
  breachedEmails?: string[];
  checkedEmails?: number;
  checkedAt: string;
}

type CheckStatus = 'pending' | 'completed' | 'failed';
interface BreakdownItem { points: number; max: number; status: CheckStatus; error?: string }
interface OrgScorecard {
  org: MonitoredOrg;
  score: number; maxPossible: number; percentage: number;
  grade: string; completedChecks: number; totalChecks: number; confidence: number;
  breakdown: Record<string, BreakdownItem>;
  lastUpdated: string | null;
}

interface ScanProgress { current: number; total: number; currentOrg: string; phase: string }

/* ─── Helpers ─── */
function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function scoreToGrade(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

/* ─── Manual name aliases for org ↔ log linkage ─── */
const NAME_ALIASES: Record<string, string> = {
  'salama bank': 'salaam bank',
  'office of the president': 'villa somalia',
  'ministry of fisheries': 'ministry of fishery',
  'mogadishu university': 'mogadishu university',   // future
  'simad university': 'simad university',             // future
};

/* ─── Fuzzy name matching for org ↔ log linkage ─── */
function normalizeOrgName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function orgNameMatches(logName: string, orgName: string): boolean {
  const a = normalizeOrgName(logName);
  const b = normalizeOrgName(orgName);
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  // Check alias mapping
  const alias = NAME_ALIASES[a];
  if (alias) {
    const aliasNorm = normalizeOrgName(alias);
    if (aliasNorm === b || b.startsWith(aliasNorm) || aliasNorm.startsWith(b)) return true;
    if (aliasNorm.length > 4 && b.includes(aliasNorm)) return true;
    if (b.length > 4 && aliasNorm.includes(b)) return true;
  }
  // "contains" for short names (>4 chars) inside longer ones
  if (a.length > 4 && b.includes(a)) return true;
  if (b.length > 4 && a.includes(b)) return true;
  return false;
}

function matchLogToOrg<T extends { organization_id?: string | null; organization_name?: string }>(
  logs: T[], org: MonitoredOrg
): T[] {
  return logs.filter(l =>
    l.organization_id === org.id ||
    (l.organization_name && orgNameMatches(l.organization_name, org.name))
  );
}

function matchFirstLogToOrg<T extends { organization_id?: string | null; organization_name?: string }>(
  logs: T[], org: MonitoredOrg
): T | undefined {
  return logs.find(l =>
    l.organization_id === org.id ||
    (l.organization_name && orgNameMatches(l.organization_name, org.name))
  );
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

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ─── invoke with retry ─── */
async function invokeWithRetry(
  fnName: string, body: any, maxRetries = 2, timeoutMs = 15000
): Promise<{ data: any; error: any; errorType?: string }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const { data, error } = await supabase.functions.invoke(fnName, {
        body,
        // @ts-ignore - AbortSignal support
      });
      clearTimeout(timer);
      if (error) {
        if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 5000)); continue; }
        return { data: null, error, errorType: 'EDGE_FUNCTION_ERROR' };
      }
      return { data, error: null };
    } catch (err: any) {
      if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 5000)); continue; }
      const msg = err?.message || '';
      let errorType = 'UNKNOWN';
      if (msg.includes('abort') || msg.includes('timeout')) errorType = 'CONNECTION_TIMEOUT';
      else if (msg.includes('429')) errorType = 'RATE_LIMITED';
      return { data: null, error: err, errorType };
    }
  }
  return { data: null, error: new Error('Max retries reached'), errorType: 'UNKNOWN' };
}

async function logCheckError(orgId: string | null, orgName: string, url: string, checkType: string, errorType: string, errorMessage: string, retryCount: number) {
  try {
    await supabase.from('check_errors' as any).insert({
      organization_id: orgId, organization_name: orgName, url, check_type: checkType,
      error_type: errorType, error_message: errorMessage.slice(0, 500), retry_count: retryCount,
    });
  } catch { /* best effort */ }
}

/* ─── Circular Gauge ─── */
const ScoreGauge: React.FC<{ score: number; maxScore?: number; size?: number; label?: string }> = ({ score, maxScore = 100, size = 100, label }) => {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const grade = scoreToGrade(pct);
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

/* ─── Confidence Badge ─── */
const ConfidenceBadge: React.FC<{ confidence: number; completed: number; total: number }> = ({ confidence, completed, total }) => {
  if (confidence >= 80) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]" variant="outline">✓ High ({completed}/{total})</Badge>;
  if (confidence >= 50) return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]" variant="outline">Partial ({completed}/{total})</Badge>;
  return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]" variant="outline">⚠ Low ({completed}/{total})</Badge>;
};

/* ─── Main Component ─── */
const ThreatIntelligence: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [orgs, setOrgs] = useState<MonitoredOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('scorecards');
  const [now, setNow] = useState(Date.now());
  const scanAbort = useRef(false);

  // Data
  const [scorecards, setScorecards] = useState<OrgScorecard[]>([]);
  const [threatFeed, setThreatFeed] = useState<ThreatFeedData | null>(null);
  const [techFingerprints, setTechFingerprints] = useState<Record<string, TechFingerprint>>({});
  const [phishingResults, setPhishingResults] = useState<PhishingResult[]>([]);
  const [breachResults, setBreachResults] = useState<BreachResult[]>([]);
  const [checkErrors, setCheckErrors] = useState<Record<string, { type: string; message: string }>>({});
  const [techScanning, setTechScanning] = useState(false);
  const [phishingScanning, setPhishingScanning] = useState(false);
  const [breachScanning, setBreachScanning] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('All');
  const [threatFilter, setThreatFilter] = useState('All');
  const [ministryFilter, setMinistryFilter] = useState('All');
  const [feedLoading, setFeedLoading] = useState(false);

  // Detail
  const [detailOrg, setDetailOrg] = useState<OrgScorecard | null>(null);
  const [selectedBreachOrg, setSelectedBreachOrg] = useState<BreachResult | null>(null);

  // Live clock for "ago" labels
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(iv);
  }, []);

  /* ─── Load orgs + cached breach results ─── */
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('organizations').select('id, name, domain, sector').order('name');
      if (data) setOrgs(data.map((d: any) => ({ id: d.id, name: d.name, url: d.domain.startsWith('http') ? d.domain : 'https://' + d.domain, sector: d.sector, is_active: true })));

      // Load cached breach results and merge with all orgs
      const { data: cached } = await supabase.from('breach_check_results').select('*').order('organization_name');
      const cachedMap = new Map<string, any>();
      for (const r of cached || []) {
        if (!cachedMap.has(r.organization_id)) cachedMap.set(r.organization_id, r);
      }
      if (data) {
        const mapped: BreachResult[] = data.map((d: any) => {
          const orgId = d.id;
          const r = cachedMap.get(orgId);
          if (r) {
            return {
              organizationId: r.organization_id,
              domain: r.domain,
              organization: r.organization_name,
              breachCount: r.breach_count,
              breachesFound: r.breach_count,
              breaches: r.breaches || [],
              isClean: r.is_clean,
              source: r.source,
              breachedEmails: r.breached_emails || [],
              error: r.error,
              checkedAt: r.checked_at,
            };
          }
          const domain = d.domain.startsWith('http') ? extractDomain(d.domain) : d.domain;
          return {
            organizationId: orgId,
            domain,
            organization: d.name,
            breachCount: 0, breachesFound: 0, breaches: [],
            isClean: null, source: 'Not checked',
            checkedAt: '',
          };
        });
        setBreachResults(mapped);
      }

      setLoading(false);
    };
    load();
  }, []);

  /* ─── Scorecard Calculation (excludes pending) ─── */
  const calculateScorecards = useCallback(async (orgList: MonitoredOrg[]) => {
    const cards: OrgScorecard[] = [];

    const [uptimeRes, sslRes, ddosRes, ewRes, techRes] = await Promise.all([
      supabase.from('uptime_logs').select('*').order('checked_at', { ascending: false }).limit(1000),
      supabase.from('ssl_logs').select('*').order('checked_at', { ascending: false }).limit(500),
      supabase.from('ddos_risk_logs').select('*').order('checked_at', { ascending: false }).limit(500),
      supabase.from('early_warning_logs').select('*').order('checked_at', { ascending: false }).limit(1000),
      supabase.from('tech_fingerprints' as any).select('*').order('checked_at', { ascending: false }).limit(500),
    ]);

    const MAXES: Record<string, number> = { uptime: 15, ssl: 15, ddos: 15, email: 10, headers: 10, ports: 10, defacement: 10, dns: 5, blacklist: 5, software: 5 };

    for (const org of orgList) {
      const breakdown: Record<string, BreakdownItem> = {};
      const orgUptime = matchLogToOrg(uptimeRes.data || [], org);
      const orgSsl = matchFirstLogToOrg(sslRes.data || [], org);
      const orgDdos = matchFirstLogToOrg(ddosRes.data || [], org);
      const orgEw = matchLogToOrg(ewRes.data || [], org);
      const orgTech = matchFirstLogToOrg((techRes.data || []) as any[], org) as any;

      // Uptime
      if (orgUptime.length > 0) {
        const upCount = orgUptime.filter(u => u.status === 'up').length;
        const pct = (upCount / orgUptime.length) * 100;
        breakdown.uptime = { points: pct >= 99 ? 15 : pct >= 95 ? 10 : pct >= 90 ? 5 : 0, max: 15, status: 'completed' };
      } else {
        breakdown.uptime = { points: 0, max: 15, status: 'pending' };
      }

      // SSL
      if (orgSsl) {
        breakdown.ssl = { points: orgSsl.is_valid && !orgSsl.is_expiring_soon ? 15 : orgSsl.is_valid ? 8 : 0, max: 15, status: 'completed' };
      } else {
        breakdown.ssl = { points: 0, max: 15, status: 'pending' };
      }

      // DDoS
      if (orgDdos) {
        let pts = 0;
        if (orgDdos.has_cdn) pts += 5;
        if (orgDdos.has_waf) pts += 5;
        if (orgDdos.has_rate_limiting) pts += 5;
        breakdown.ddos = { points: pts, max: 15, status: 'completed' };
      } else {
        breakdown.ddos = { points: 0, max: 15, status: 'pending' };
      }

      // Email
      const emailEw = orgEw.find(e => e.check_type === 'email_security') || orgEw.find(e => e.check_type === 'dns');
      if (emailEw) {
        const det = emailEw.details as any;
        const es = det?.emailSecurity;
        let pts = 0;
        if (es) {
          if (es.spfExists && es.dmarcExists && es.dkimFound && es.dmarcPolicy === 'reject') pts = 10;
          else if (es.spfExists && es.dmarcExists) pts = 7;
          else if (es.spfExists) pts = 3;
        }
        breakdown.email = { points: pts, max: 10, status: 'completed' };
      } else {
        breakdown.email = { points: 0, max: 10, status: 'pending' };
      }

      // Headers
      const headersEw = orgEw.find(e => e.check_type === 'security_headers');
      if (headersEw) {
        const sc = (headersEw.details as any)?.score || 0;
        breakdown.headers = { points: sc >= 7 ? 10 : sc >= 5 ? 7 : sc >= 3 ? 5 : sc >= 1 ? 2 : 0, max: 10, status: 'completed' };
      } else {
        breakdown.headers = { points: 0, max: 10, status: 'pending' };
      }

      // Ports
      const portsEw = orgEw.find(e => e.check_type === 'open_ports');
      if (portsEw) {
        breakdown.ports = { points: portsEw.risk_level === 'safe' ? 10 : portsEw.risk_level === 'warning' ? 5 : 0, max: 10, status: 'completed' };
      } else {
        breakdown.ports = { points: 0, max: 10, status: 'pending' };
      }

      // Defacement
      const defEw = orgEw.find(e => e.check_type === 'defacement');
      if (defEw) {
        breakdown.defacement = { points: defEw.risk_level === 'safe' ? 10 : defEw.risk_level === 'warning' ? 5 : 0, max: 10, status: 'completed' };
      } else {
        breakdown.defacement = { points: 0, max: 10, status: 'pending' };
      }

      // DNS
      const dnsEw = orgEw.find(e => e.check_type === 'dns');
      if (dnsEw) {
        breakdown.dns = { points: dnsEw.risk_level === 'safe' ? 5 : dnsEw.risk_level === 'warning' ? 2 : 0, max: 5, status: 'completed' };
      } else {
        breakdown.dns = { points: 0, max: 5, status: 'pending' };
      }

      // Blacklist
      const blEw = orgEw.find(e => e.check_type === 'blacklist');
      if (blEw) {
        breakdown.blacklist = { points: blEw.risk_level === 'safe' ? 5 : 0, max: 5, status: 'completed' };
      } else {
        breakdown.blacklist = { points: 0, max: 5, status: 'pending' };
      }

      // Software
      if (orgTech) {
        breakdown.software = { points: orgTech.outdated_count === 0 ? 5 : orgTech.outdated_count <= 2 ? 2 : 0, max: 5, status: 'completed' };
      } else {
        breakdown.software = { points: 0, max: 5, status: 'pending' };
      }

      // Check for errors
      const orgErrorKey = org.id;
      if (checkErrors[orgErrorKey]) {
        // Mark specific checks as failed if we have error data
      }

      const completedEntries = Object.values(breakdown).filter(b => b.status === 'completed');
      const totalChecks = Object.keys(breakdown).length;
      const completedChecks = completedEntries.length;
      const earnedPoints = completedEntries.reduce((s, b) => s + b.points, 0);
      const maxPossible = completedEntries.reduce((s, b) => s + b.max, 0);
      const percentage = maxPossible > 0 ? Math.round((earnedPoints / maxPossible) * 100) : 0;
      const confidence = Math.round((completedChecks / totalChecks) * 100);
      const grade = scoreToGrade(percentage);

      // Find latest checked_at across all data for this org
      const timestamps = [
        ...orgUptime.map(u => u.checked_at),
        orgSsl?.checked_at, orgDdos?.checked_at,
        ...orgEw.map(e => e.checked_at),
        orgTech?.checked_at,
      ].filter(Boolean) as string[];
      const lastUpdated = timestamps.length > 0 ? timestamps.sort().reverse()[0] : null;

      cards.push({ org, score: earnedPoints, maxPossible, percentage, grade, completedChecks, totalChecks, confidence, breakdown, lastUpdated });
    }

    cards.sort((a, b) => a.percentage - b.percentage);
    setScorecards(cards);
  }, [checkErrors]);

  /* ─── Threat Feed ─── */
  const fetchThreatFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const techNames = Object.values(techFingerprints)
        .filter(t => t.technologies)
        .flatMap(t => [t.technologies!.webServer, t.technologies!.cms, t.technologies!.language].filter(Boolean) as string[]);
      const { data, error } = await invokeWithRetry('fetch-threat-intel', { orgTechnologies: techNames });
      if (error) throw error;
      setThreatFeed(data);
      const total = (data?.cisaKEV?.length || 0) + (data?.latestCVEs?.length || 0) + (data?.maliciousUrls?.length || 0) + (data?.feodoC2?.length || 0);
      toast({ title: 'Threat feed updated', description: `${total} entries loaded from 4 sources` });
    } catch (err) {
      console.error('Threat feed error:', err);
      toast({ title: 'Threat feed failed', variant: 'destructive' });
    } finally {
      setFeedLoading(false);
    }
  }, [techFingerprints, toast]);

  /* ─── Tech Fingerprinting ─── */
  const runFingerprinting = useCallback(async (orgList: MonitoredOrg[]) => {
    try {
      const urls = orgList.map(o => o.url);
      const { data, error, errorType } = await invokeWithRetry('fingerprint-tech', { urls });
      if (error) {
        for (const org of orgList) {
          await logCheckError(org.id, org.name, org.url, 'tech_fingerprint', errorType || 'UNKNOWN', String(error), 2);
        }
        return;
      }
      const newFp: Record<string, TechFingerprint> = {};
      for (const r of data.results || []) {
        newFp[r.url] = r;
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
        } else if (org && r.error) {
          await logCheckError(org.id, org.name, r.url, 'tech_fingerprint', r.error, r.errorMessage || '', 0);
        }
      }
      setTechFingerprints(prev => ({ ...prev, ...newFp }));
    } catch (err) {
      console.error('Fingerprinting error:', err);
    }
  }, []);

  /* ─── Phishing Domains ─── */
  const runPhishingCheck = useCallback(async (orgList: MonitoredOrg[]) => {
    try {
      const organizations = orgList.map(o => ({ id: o.id, name: o.name, domain: extractDomain(o.url) }));
      const { data, error } = await invokeWithRetry('check-phishing-domains', { organizations });
      if (error) throw error;
      setPhishingResults(data.results || []);

      for (const r of data.results || []) {
        for (const d of r.lookalikeDomains) {
          if (d.exists) {
            await supabase.from('phishing_domains' as any).upsert({
              organization_id: r.organizationId, organization_name: r.organization,
              original_domain: r.domain, lookalike_domain: d.domain,
              is_active: d.hasWebsite, ip_address: d.ip, has_website: d.hasWebsite,
              risk_level: d.risk, last_checked: new Date().toISOString(),
            }, { onConflict: 'lookalike_domain' }).select();

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

  /* ─── Breach Check (per-org sequential) ─── */
  const [breachProgress, setBreachProgress] = useState<{ current: number; total: number; currentOrg: string } | null>(null);

  const runBreachCheck = useCallback(async (orgList: MonitoredOrg[]) => {
    const results: BreachResult[] = [];
    setBreachProgress({ current: 0, total: orgList.length, currentOrg: '' });

    // Try to read HIBP API key from settings table
    let apiKey = '';
    try {
      const { data: settingsData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'hibp_api_key')
        .single();
      apiKey = settingsData?.value || '';
    } catch { /* no settings table or no key */ }

    for (let i = 0; i < orgList.length; i++) {
      if (scanAbort.current) break;
      const org = orgList[i];
      const domain = extractDomain(org.url);
      setBreachProgress({ current: i + 1, total: orgList.length, currentOrg: org.name });

      try {
        const { data, error } = await invokeWithRetry('check-breaches', {
          domain, organizationName: org.name, apiKey,
        }, 2, 120000); // 2min timeout for email-pattern search

        if (data?.success) {
          results.push({
            organizationId: org.id,
            domain: data.domain,
            organization: data.organization,
            breachCount: data.breachCount,
            breachesFound: data.breachCount,
            breaches: data.breaches || [],
            isClean: data.isClean,
            riskLevel: data.riskLevel,
            source: data.source,
            method: data.method,
            note: data.note,
            breachedEmails: data.breachedEmails || [],
            checkedEmails: data.checkedEmails,
            checkedAt: data.checkedAt,
          });
        } else {
          results.push({
            organizationId: org.id,
            domain, organization: org.name,
            breachCount: 0, breachesFound: 0, breaches: [],
            isClean: null, riskLevel: 'info',
            error: data?.error || error?.message || 'Check failed',
            checkedAt: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        results.push({
          organizationId: org.id,
          domain, organization: org.name,
          breachCount: 0, breachesFound: 0, breaches: [],
          isClean: null, riskLevel: 'info',
          error: err.message,
          checkedAt: new Date().toISOString(),
        });
      }

      setBreachResults([...results]);

      // Wait 3s between orgs (each org takes ~23s internally with HIBP)
      if (i < orgList.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setBreachProgress(null);

    // Persist to breach_check_results table via upsert
    for (const result of results) {
      const matchedOrg = orgList.find(o => o.id === result.organizationId || extractDomain(o.url) === result.domain);
      if (matchedOrg) {
        try {
          await supabase.from('breach_check_results').upsert({
            organization_id: matchedOrg.id,
            organization_name: result.organization,
            domain: result.domain,
            breach_count: result.breachCount,
            breaches: result.breaches || [],
            breached_emails: result.breachedEmails || [],
            is_clean: result.isClean,
            error: result.error || null,
            source: result.source || '',
            checked_at: result.checkedAt,
          }, { onConflict: 'organization_id' });
        } catch { /* best effort */ }
      }
    }
  }, []);

  /* ─── Security Headers Check ─── */
  const runSecurityHeadersCheck = useCallback(async (orgList: MonitoredOrg[]) => {
    try {
      const urls = orgList.map(o => o.url);
      const { data, error } = await invokeWithRetry('check-security-headers', { urls }, 2, 30000);
      if (error) { console.error('Headers check error:', error); return; }
      for (const r of data?.results || []) {
        const org = orgList.find(o => o.url === r.url);
        if (!org) continue;
        const riskLevel = r.score >= 5 ? 'safe' : r.score >= 3 ? 'warning' : 'critical';
        await supabase.from('early_warning_logs').insert({
          organization_id: org.id, organization_name: org.name, url: r.url,
          check_type: 'security_headers', risk_level: riskLevel,
          details: { score: r.score, maxScore: r.maxScore, grade: r.grade, headers: r.headers },
        });
      }
    } catch (err) { console.error('Headers check error:', err); }
  }, []);

  /* ─── Email + DNS Check ─── */
  const runEmailDnsCheck = useCallback(async (orgList: MonitoredOrg[]) => {
    try {
      const domains = orgList.map(o => extractDomain(o.url));
      const { data, error } = await invokeWithRetry('check-dns', { domains }, 2, 30000);
      if (error) { console.error('DNS check error:', error); return; }

      // Load existing baselines for comparison
      const { data: baselines } = await supabase.from('baselines').select('*');
      const baselineMap = new Map((baselines || []).map(b => [b.url, b]));

      for (const r of data?.results || []) {
        const org = orgList.find(o => extractDomain(o.url) === r.domain);
        if (!org) continue;

        // Save email_security log
        await supabase.from('early_warning_logs').insert({
          organization_id: org.id, organization_name: org.name, url: org.url,
          check_type: 'email_security', risk_level: r.emailSecurity?.spfExists ? 'safe' : 'warning',
          details: { emailSecurity: r.emailSecurity },
        });

        // Save dns log with baseline comparison
        const baseline = baselineMap.get(org.url);
        let dnsRisk = 'safe';
        if (baseline?.dns_records) {
          const oldRecords = baseline.dns_records as any;
          const nsChanged = JSON.stringify(oldRecords?.NS?.sort()) !== JSON.stringify(r.records?.NS?.sort());
          const aChanged = JSON.stringify(oldRecords?.A?.sort()) !== JSON.stringify(r.records?.A?.sort());
          if (nsChanged) dnsRisk = 'critical';
          else if (aChanged) dnsRisk = 'warning';
        }
        await supabase.from('early_warning_logs').insert({
          organization_id: org.id, organization_name: org.name, url: org.url,
          check_type: 'dns', risk_level: dnsRisk,
          details: { records: r.records, emailSecurity: r.emailSecurity },
        });

        // Upsert baseline
        await supabase.from('baselines').upsert({
          organization_id: org.id, url: org.url,
          dns_records: r.records,
        }, { onConflict: 'url' });
      }
    } catch (err) { console.error('DNS check error:', err); }
  }, []);

  /* ─── Blacklist Check ─── */
  const runBlacklistCheck = useCallback(async (orgList: MonitoredOrg[]) => {
    try {
      const urls = orgList.map(o => o.url);
      const { data, error } = await invokeWithRetry('check-blacklist', { urls }, 2, 30000);
      if (error) { console.error('Blacklist check error:', error); return; }
      for (const r of data?.results || []) {
        const org = orgList.find(o => o.url === r.url);
        if (!org) continue;
        await supabase.from('early_warning_logs').insert({
          organization_id: org.id, organization_name: org.name, url: r.url,
          check_type: 'blacklist', risk_level: r.blacklisted ? 'critical' : 'safe',
          details: { blacklisted: r.blacklisted, blacklistSources: r.blacklistSources, reputation: r.reputation },
        });
        if (r.blacklisted) {
          await generateAlert('critical', `Blacklisted: ${org.name}`, `${org.url} found on blacklist: ${r.blacklistSources?.join(', ')}`);
        }
      }
    } catch (err) { console.error('Blacklist check error:', err); }
  }, []);

  /* ─── Defacement Check (with calibration) ─── */
  const runDefacementCheck = useCallback(async (orgList: MonitoredOrg[]) => {
    try {
      // Load baselines
      const { data: baselines } = await supabase.from('baselines').select('*');
      const baselineMap = new Map((baselines || []).map(b => [b.url, b]));

      // Get check counts per org from early_warning_logs
      const { data: existingLogs } = await supabase.from('early_warning_logs')
        .select('organization_id')
        .eq('check_type', 'defacement');
      const checkCounts = new Map<string, number>();
      for (const log of existingLogs || []) {
        const orgId = log.organization_id || '';
        checkCounts.set(orgId, (checkCounts.get(orgId) || 0) + 1);
      }

      const urlItems = orgList.map(o => {
        const bl = baselineMap.get(o.url);
        return {
          url: o.url,
          baselineHash: bl?.content_hash || null,
          baselineTitle: bl?.page_title || null,
          baselineSize: bl?.page_size || null,
          checkCount: checkCounts.get(o.id) || 0,
          expectedTitle: o.name, // Use org name for title mismatch check
        };
      });

      const { data, error } = await invokeWithRetry('check-defacement', { urls: urlItems }, 2, 30000);
      if (error) { console.error('Defacement check error:', error); return; }
      for (const r of data?.results || []) {
        const org = orgList.find(o => o.url === r.url);
        if (!org) continue;

        // Map new status to risk levels
        let riskLevel = 'safe';
        if (r.status === 'defaced') riskLevel = 'critical';
        else if (r.status === 'review_needed' || r.status === 'content_changed') riskLevel = 'warning';
        // baseline_set, calibrating, clean = safe

        await supabase.from('early_warning_logs').insert({
          organization_id: org.id, organization_name: org.name, url: r.url,
          check_type: 'defacement', risk_level: riskLevel,
          details: {
            status: r.status, hashChanged: r.hashChanged, titleChanged: r.titleChanged,
            sizeAnomaly: r.sizeAnomaly, defacementKeywordsFound: r.defacementKeywordsFound,
            keywordContexts: r.keywordContexts, indicators: r.indicators,
            indicatorCount: r.indicatorCount, internalLinkCount: r.internalLinkCount,
            hasNormalStructure: r.hasNormalStructure,
            currentHash: r.currentHash, currentTitle: r.currentTitle, currentSize: r.currentSize,
          },
        });

        // Only update baseline on first 3 checks
        const orgCheckCount = checkCounts.get(org.id) || 0;
        if (r.currentHash && orgCheckCount <= 2) {
          await supabase.from('baselines').upsert({
            organization_id: org.id, url: r.url,
            content_hash: r.currentHash, page_title: r.currentTitle, page_size: r.currentSize,
          }, { onConflict: 'url' });
        }

        // Only alert on high-confidence defacement (3+ indicators)
        if (r.status === 'defaced' && r.indicatorCount >= 3) {
          await generateAlert('critical', `Website Defaced: ${org.name}`, `Defacement detected on ${r.url} (${r.indicatorCount} indicators). Keywords: ${r.defacementKeywordsFound?.join(', ') || 'none'}`);
        }
      }
    } catch (err) { console.error('Defacement check error:', err); }
  }, []);

  /* ─── Ports Check ─── */
  const runPortsCheck = useCallback(async (orgList: MonitoredOrg[]) => {
    try {
      const hostnames = orgList.map(o => extractDomain(o.url));
      const { data, error } = await invokeWithRetry('check-ports', { hostnames }, 2, 60000);
      if (error) { console.error('Ports check error:', error); return; }
      for (const r of data?.results || []) {
        const org = orgList.find(o => extractDomain(o.url) === r.hostname);
        if (!org) continue;
        let riskLevel = 'safe';
        if (!r.portsAvailable) {
          riskLevel = 'safe'; // Can't check = give benefit of doubt
        } else if (r.criticalPorts > 0) {
          riskLevel = 'critical';
        } else if (r.totalOpen > 0) {
          riskLevel = 'warning';
        }
        await supabase.from('early_warning_logs').insert({
          organization_id: org.id, organization_name: org.name, url: org.url,
          check_type: 'open_ports', risk_level: riskLevel,
          details: { openPorts: r.openPorts, totalOpen: r.totalOpen, criticalPorts: r.criticalPorts, portsAvailable: r.portsAvailable, note: r.note },
        });
        if (r.criticalPorts > 0) {
          await generateAlert('high', `Critical Ports Exposed: ${org.name}`, `${r.criticalPorts} critical port(s) open on ${r.hostname}: ${r.openPorts.filter((p: any) => p.risk === 'critical').map((p: any) => p.service).join(', ')}`);
        }
      }
    } catch (err) { console.error('Ports check error:', err); }
  }, []);


  const generateAlert = async (severity: string, title: string, description: string) => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase.from('alerts').select('id').eq('title', title).gte('created_at', since).limit(1);
      if (existing && existing.length > 0) return;
      await supabase.from('alerts').insert({ title, description, severity: severity as any, source: 'threat-intel', status: 'open' });
    } catch (err) { console.error('Alert gen error:', err); }
  };

  /* ─── Queue-Based Full Scan ─── */
  const runFullScan = useCallback(async () => {
    if (orgs.length === 0) return;
    scanAbort.current = false;
    setScanning(true);
    toast({ title: 'Running full threat intelligence scan...', description: `Analyzing ${orgs.length} organizations` });

    try {
      // Phase 1: Fingerprinting in batches of 5
      const batchSize = 5;
      for (let i = 0; i < orgs.length; i += batchSize) {
        if (scanAbort.current) break;
        const batch = orgs.slice(i, i + batchSize);
        setScanProgress({ current: i, total: orgs.length, currentOrg: batch.map(o => o.name).join(', '), phase: 'Fingerprinting' });
        await runFingerprinting(batch);
        if (i + batchSize < orgs.length) await new Promise(r => setTimeout(r, 2000));
      }

      // Phase 2: Early Warning Checks in batches of 5
      for (let i = 0; i < orgs.length; i += batchSize) {
        if (scanAbort.current) break;
        const batch = orgs.slice(i, i + batchSize);
        setScanProgress({ current: i, total: orgs.length, currentOrg: batch.map(o => o.name).join(', '), phase: 'Security Checks' });
        await Promise.all([
          runSecurityHeadersCheck(batch),
          runEmailDnsCheck(batch),
          runBlacklistCheck(batch),
          runDefacementCheck(batch),
          runPortsCheck(batch),
        ]);
        if (i + batchSize < orgs.length) await new Promise(r => setTimeout(r, 2000));
      }

      // Phase 3: Global checks in parallel
      if (!scanAbort.current) {
        setScanProgress({ current: 0, total: 3, currentOrg: 'Global feeds', phase: 'Threat Intelligence' });
        await Promise.all([fetchThreatFeed(), runPhishingCheck(orgs), runBreachCheck(orgs)]);
      }

      // Phase 4: Recalculate scorecards and record history
      if (!scanAbort.current) {
        setScanProgress({ current: orgs.length, total: orgs.length, currentOrg: 'Calculating scores', phase: 'Scoring' });
        await calculateScorecards(orgs);

        // Record risk_history and update org scores
        const latestCards = scorecards.length > 0 ? scorecards : [];
        for (const card of latestCards) {
          try {
            await supabase.from('risk_history').insert({
              organization_id: card.org.id,
              score: card.percentage,
            });
            await supabase.from('organizations').update({
              risk_score: card.percentage,
              status: card.percentage >= 75 ? 'Secure' : card.percentage >= 50 ? 'Warning' : 'Critical',
              last_scan: new Date().toISOString(),
            }).eq('id', card.org.id);
          } catch { /* best effort */ }
        }
      }

      setLastChecked(new Date().toISOString());
      toast({ title: 'Scan complete', description: 'Threat intelligence updated' });
    } catch {
      toast({ title: 'Some checks failed', variant: 'destructive' });
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  }, [orgs, runFingerprinting, runSecurityHeadersCheck, runEmailDnsCheck, runBlacklistCheck, runDefacementCheck, runPortsCheck, fetchThreatFeed, runPhishingCheck, runBreachCheck, calculateScorecards, toast]);

  // Load persisted data from DB on mount
  const initialRun = useRef(false);
  useEffect(() => {
    if (!loading && orgs.length > 0 && !initialRun.current) {
      initialRun.current = true;

      // Load tech fingerprints from DB
      supabase.from('tech_fingerprints' as any).select('*').then(({ data: techData }: any) => {
        if (techData && techData.length > 0) {
          const fp: Record<string, TechFingerprint> = {};
          for (const t of techData) {
            fp[t.url] = {
              url: t.url,
              technologies: {
                webServer: t.web_server, webServerVersion: t.web_server_version,
                language: t.language, languageVersion: t.language_version,
                cms: t.cms, cmsVersion: t.cms_version,
                cdn: t.cdn, jsLibraries: t.js_libraries || [],
              },
              error: null, checkedAt: t.checked_at,
            };
          }
          setTechFingerprints(fp);
        }
      });

      // Load phishing from DB
      supabase.from('phishing_domains').select('*').then(({ data: phishingData }) => {
        if (phishingData && phishingData.length > 0) {
          const grouped: Record<string, PhishingResult> = {};
          for (const pd of phishingData) {
            const key = pd.organization_name;
            if (!grouped[key]) {
              grouped[key] = {
                organization: pd.organization_name, organizationId: pd.organization_id || '',
                domain: pd.original_domain, lookalikeDomains: [], totalFound: 0,
                checkedAt: pd.last_checked,
              };
            }
            grouped[key].lookalikeDomains.push({
              domain: pd.lookalike_domain, exists: true, ip: pd.ip_address,
              hasWebsite: pd.has_website, risk: pd.risk_level,
            });
            grouped[key].totalFound = grouped[key].lookalikeDomains.length;
          }
          setPhishingResults(Object.values(grouped));
        }
      });

      // Load breaches from breach_check_results (correct table) and show all orgs
      supabase.from('breach_check_results').select('*').order('checked_at', { ascending: false }).then(({ data: breachData }) => {
        const cachedMap = new Map<string, any>();
        for (const r of breachData || []) {
          if (!cachedMap.has(r.organization_id)) cachedMap.set(r.organization_id, r);
        }
        const results: BreachResult[] = orgs.map(org => {
          const cached = cachedMap.get(org.id);
          if (cached) {
            return {
              organizationId: cached.organization_id,
              domain: cached.domain,
              organization: cached.organization_name,
              breachCount: cached.breach_count,
              breachesFound: cached.breach_count,
              breaches: cached.breaches || [],
              isClean: cached.is_clean,
              source: cached.source,
              breachedEmails: cached.breached_emails || [],
              error: cached.error,
              checkedAt: cached.checked_at,
            };
          }
          return {
            organizationId: org.id,
            domain: extractDomain(org.url),
            organization: org.name,
            breachCount: 0, breachesFound: 0, breaches: [],
            isClean: null, source: 'Not checked',
            checkedAt: '',
          };
        });
        setBreachResults(results);
      });

      // Auto-fetch threat feed immediately
      fetchThreatFeed();

      // Load existing data first, then run scan
      calculateScorecards(orgs);
    }
  }, [loading, orgs.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { scanAbort.current = true; };
  }, []);

  /* ─── Realtime Subscriptions ─── */
  useEffect(() => {
    const channel = supabase
      .channel('threat-intel-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uptime_logs' }, () => { if (orgs.length > 0) calculateScorecards(orgs); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ssl_logs' }, () => { if (orgs.length > 0) calculateScorecards(orgs); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ddos_risk_logs' }, () => { if (orgs.length > 0) calculateScorecards(orgs); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'early_warning_logs' }, () => { if (orgs.length > 0) calculateScorecards(orgs); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threat_intelligence_logs' }, () => { if (orgs.length > 0) calculateScorecards(orgs); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgs, calculateScorecards]);

  /* ─── Background Scheduling ─── */
  useEffect(() => {
    if (orgs.length === 0) return;
    // Threat feed every 30 min
    const threatIv = setInterval(() => fetchThreatFeed(), 30 * 60 * 1000);
    // Scorecard recalc every 5 min
    const scoreIv = setInterval(() => calculateScorecards(orgs), 5 * 60 * 1000);
    return () => { clearInterval(threatIv); clearInterval(scoreIv); };
  }, [orgs, fetchThreatFeed, calculateScorecards]);

  /* ─── National Threat Level ─── */
  const nationalThreatLevel = (() => {
    if (scorecards.length === 0) return { level: 'LOW', color: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400', pulse: false };
    const avgScore = scorecards.reduce((s, c) => s + c.percentage, 0) / scorecards.length;
    const worst = scorecards[0]?.grade;
    // Additional condition: average score above 75% or below 25% triggers CRITICAL
    if (worst === 'F' || avgScore <= 25) return { level: 'CRITICAL ALERT', color: 'bg-red-700/40 border-red-500/50 text-red-300', pulse: true };
    if (avgScore >= 75 && worst === 'F') return { level: 'CRITICAL ALERT', color: 'bg-red-700/40 border-red-500/50 text-red-300', pulse: true };
    if (worst === 'D') return { level: 'HIGH', color: 'bg-orange-500/20 border-orange-500/30 text-orange-400', pulse: true };
    if (worst === 'C') return { level: 'ELEVATED', color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400', pulse: false };
    return { level: 'LOW', color: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400', pulse: false };
  })();

  const totalPhishing = phishingResults.reduce((sum, r) => sum + r.totalFound, 0);
  const activePhishing = phishingResults.reduce((sum, r) => sum + r.lookalikeDomains.filter(d => d.hasWebsite).length, 0);
  const totalBreaches = breachResults.reduce((sum, r) => sum + r.breachesFound, 0);

  const checksSucceeded = scorecards.reduce((s, c) => s + c.completedChecks, 0);
  const checksTotal = scorecards.reduce((s, c) => s + c.totalChecks, 0);

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
          {checksTotal > 0 && (
            <span className="text-xs text-muted-foreground font-mono">{checksSucceeded}/{checksTotal} checks</span>
          )}
          {lastChecked && (
            <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeAgo(lastChecked)}
            </span>
          )}
          <Button onClick={runFullScan} disabled={scanning} className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30">
            <RefreshCw className={cn('w-4 h-4 mr-2', scanning && 'animate-spin')} />
            {scanning ? 'Scanning...' : 'Run Full Scan'}
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      {scanProgress && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{scanProgress.phase}: {scanProgress.currentOrg}</span>
            <span>{scanProgress.current}/{scanProgress.total}</span>
          </div>
          <Progress value={scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0} className="h-2" />
        </div>
      )}

      {/* National Threat Level */}
      <div className={cn('rounded-lg border p-4 text-center', nationalThreatLevel.color, nationalThreatLevel.pulse && 'animate-pulse')}>
        <p className="text-xs font-mono uppercase tracking-wider opacity-70">National Threat Level</p>
        <p className="text-2xl font-bold">{nationalThreatLevel.level}</p>
        {scorecards.length > 0 && (
          <p className="text-xs mt-1 opacity-70">
            Average Score: {Math.round(scorecards.reduce((s, c) => s + c.percentage, 0) / scorecards.length)}%
            ({scorecards.filter(s => s.confidence >= 50).length}/{scorecards.length} orgs assessed)
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
              <Card key={sc.org.id}
                className={cn('border cursor-pointer hover:border-neon-cyan/30 transition-all duration-300', gradeBg(sc.grade))}
                onClick={() => setDetailOrg(sc)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{sc.org.name}</h3>
                      <Badge variant="outline" className="text-xs mt-1">{sc.org.sector}</Badge>
                      <div className="flex items-center gap-2 mt-1.5">
                        <ConfidenceBadge confidence={sc.confidence} completed={sc.completedChecks} total={sc.totalChecks} />
                      </div>
                    </div>
                    <ScoreGauge score={sc.score} maxScore={sc.maxPossible} size={80} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {sc.score}/{sc.maxPossible} pts ({sc.percentage}%)
                    </span>
                    {sc.lastUpdated && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {timeAgo(sc.lastUpdated)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(sc.breakdown).map(([key, item]) => (
                      <span key={key} className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono',
                        item.status === 'pending' ? 'bg-muted/30 text-muted-foreground border-muted' :
                        item.status === 'failed' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        item.points / item.max >= 0.8 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        item.points / item.max >= 0.5 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      )}>
                        {item.status === 'pending' ? '◌' : item.status === 'failed' ? '⚠' : item.points / item.max >= 0.8 ? '✓' : item.points / item.max >= 0.5 ? '~' : '✗'} {key}
                      </span>
                    ))}
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
          <div className="flex gap-3 flex-wrap items-center">
            <Select value={threatFilter} onValueChange={setThreatFilter}>
              <SelectTrigger className="w-40 border-neon-cyan/30 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="All">All Sources</SelectItem>
                <SelectItem value="CISA">CISA KEV</SelectItem>
                <SelectItem value="NVD">NVD CVEs</SelectItem>
                <SelectItem value="URLhaus">URLhaus</SelectItem>
                <SelectItem value="Feodo">Feodo Tracker</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ministryFilter} onValueChange={setMinistryFilter}>
              <SelectTrigger className="w-48 border-neon-cyan/30 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="All">All Ministries</SelectItem>
                {orgs.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="text-xs border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10" onClick={fetchThreatFeed} disabled={feedLoading || scanning}>
              <RefreshCw className={cn('w-3 h-3 mr-1', feedLoading && 'animate-spin')} /> {feedLoading ? 'Loading...' : 'Refresh Feed'}
            </Button>
          </div>

          {/* Source Status Indicators */}
          {threatFeed && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={cn('px-2 py-1 rounded border', threatFeed.cisaKEV.length > 0 ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-muted/30 text-muted-foreground border-border')}>
                CISA KEV {threatFeed.cisaKEV.length > 0 ? `✓ (${threatFeed.cisaKEV.length})` : '✗'}
              </span>
              <span className={cn('px-2 py-1 rounded border', threatFeed.latestCVEs.length > 0 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-muted/30 text-muted-foreground border-border')}>
                NVD {threatFeed.latestCVEs.length > 0 ? `✓ (${threatFeed.latestCVEs.length})` : '✗'}
              </span>
              <span className={cn('px-2 py-1 rounded border', threatFeed.maliciousUrls.length > 0 ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-muted/30 text-muted-foreground border-border')}>
                URLhaus {threatFeed.maliciousUrls.length > 0 ? `✓ (${threatFeed.maliciousUrls.length})` : '✗'}
              </span>
              <span className={cn('px-2 py-1 rounded border', (threatFeed.feodoC2?.length || 0) > 0 ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-muted/30 text-muted-foreground border-border')}>
                Feodo {(threatFeed.feodoC2?.length || 0) > 0 ? `✓ (${threatFeed.feodoC2.length})` : '✗'}
              </span>
            </div>
          )}

          {!threatFeed && !scanning && !feedLoading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-3">Loading threat feed data...</p>
              <Button size="sm" variant="outline" onClick={fetchThreatFeed} className="text-xs border-neon-cyan/30 text-neon-cyan">
                <RefreshCw className="w-3 h-3 mr-1" /> Fetch Now
              </Button>
            </div>
          )}

          {threatFeed && (() => {
            // Build unified threat array
            const allThreats: { id: string; source: string; sourceColor: string; identifier: string; severity: string; description: string; date: string; ministryAffected: string }[] = [];

            // Helper: match ministry by tech keywords
            const matchMinistry = (vendorProduct: string, description: string): string => {
              const combined = `${vendorProduct} ${description}`.toLowerCase();
              for (const org of orgs) {
                const orgTech = Object.values(techFingerprints).find(t => {
                  const orgMatch = orgs.find(o => o.url === t.url);
                  return orgMatch?.id === org.id;
                });
                if (orgTech?.technologies) {
                  const techs = [orgTech.technologies.webServer, orgTech.technologies.cms, orgTech.technologies.language, orgTech.technologies.cdn, ...(orgTech.technologies.jsLibraries || [])].filter(Boolean).map(s => s!.toLowerCase());
                  if (techs.some(t => combined.includes(t))) return org.name;
                }
              }
              return 'Global';
            };

            // CISA KEV
            if (threatFilter === 'All' || threatFilter === 'CISA') {
              for (const v of threatFeed.cisaKEV) {
                allThreats.push({
                  id: v.cveID, source: 'CISA KEV', sourceColor: 'bg-red-500/20 text-red-400 border-red-500/30',
                  identifier: v.cveID, severity: 'critical',
                  description: v.shortDescription || v.vulnerabilityName,
                  date: v.dateAdded,
                  ministryAffected: matchMinistry(`${v.vendorProject} ${v.product}`, v.shortDescription || ''),
                });
              }
            }

            // NVD CVEs
            if (threatFilter === 'All' || threatFilter === 'NVD') {
              for (const c of threatFeed.latestCVEs) {
                allThreats.push({
                  id: c.cveID, source: 'NVD', sourceColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                  identifier: c.cveID, severity: c.severity,
                  description: c.description,
                  date: c.published ? new Date(c.published).toISOString().split('T')[0] : '',
                  ministryAffected: matchMinistry('', c.description || ''),
                });
              }
            }

            // URLhaus
            if (threatFilter === 'All' || threatFilter === 'URLhaus') {
              for (const u of threatFeed.maliciousUrls) {
                allThreats.push({
                  id: u.url, source: 'URLhaus', sourceColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                  identifier: u.url, severity: u.severity || 'high',
                  description: `${u.threat} — ${u.host}`,
                  date: u.dateAdded ? new Date(u.dateAdded).toISOString().split('T')[0] : '',
                  ministryAffected: u.targetsSomalia ? 'Somalia (Regional)' : 'Global',
                });
              }
            }

            // Feodo C2
            if (threatFilter === 'All' || threatFilter === 'Feodo') {
              for (const f of (threatFeed.feodoC2 || [])) {
                allThreats.push({
                  id: `${f.ipAddress}:${f.port}`, source: 'Feodo', sourceColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                  identifier: `${f.ipAddress}:${f.port}`, severity: 'high',
                  description: `${f.malware} C2 server — ${f.country || 'Unknown'}`,
                  date: f.firstSeen ? new Date(f.firstSeen).toISOString().split('T')[0] : '',
                  ministryAffected: f.country === 'SO' ? 'Somalia (Regional)' : 'Global',
                });
              }
            }

            // Sort by date descending
            allThreats.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

            // Apply ministry filter
            const filtered = ministryFilter === 'All' ? allThreats : allThreats.filter(t => t.ministryAffected === ministryFilter);

            if (filtered.length === 0) {
              return (
                <Alert className="bg-emerald-500/10 border-emerald-500/30">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <AlertTitle className="text-emerald-400">No threats match current filters</AlertTitle>
                  <AlertDescription>Try changing your source or ministry filter.</AlertDescription>
                </Alert>
              );
            }

            return (
              <Card className="border-neon-cyan/20">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-neon-cyan/10">
                        <TableHead className="text-neon-cyan/70 text-xs">Source</TableHead>
                        <TableHead className="text-neon-cyan/70 text-xs">CVE ID / Identifier</TableHead>
                        <TableHead className="text-neon-cyan/70 text-xs">Severity</TableHead>
                        <TableHead className="text-neon-cyan/70 text-xs">Ministry Affected</TableHead>
                        <TableHead className="text-neon-cyan/70 text-xs">Published</TableHead>
                        <TableHead className="text-neon-cyan/70 text-xs max-w-[300px]">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.slice(0, 50).map((t, i) => (
                        <TableRow key={`${t.source}-${t.id}-${i}`} className="border-border/50 hover:bg-neon-cyan/5">
                          <TableCell className="py-2">
                            <Badge className={cn(t.sourceColor, 'text-[10px]')} variant="outline">{t.source}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs py-2 max-w-[200px] truncate">{t.identifier}</TableCell>
                          <TableCell className="py-2">
                            <Badge className={cn(severityBadge(t.severity), 'text-[10px]')} variant="outline">{t.severity.toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell className="text-xs py-2">{t.ministryAffected}</TableCell>
                          <TableCell className="font-mono text-xs py-2 text-muted-foreground">{t.date}</TableCell>
                          <TableCell className="text-xs py-2 text-muted-foreground max-w-[300px] truncate" title={t.description}>{t.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })()}

          {threatFeed?.fetchedAt && (
            <p className="text-xs text-muted-foreground text-center">Last updated: {timeAgo(threatFeed.fetchedAt)}</p>
          )}
        </TabsContent>

        {/* ─── Tab 3: Tech Stack ─── */}
        <TabsContent value="tech" className="space-y-4">
          {Object.keys(techFingerprints).length === 0 && !scanning && (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                <Wrench className="w-12 h-12 text-muted-foreground/50" />
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">No Tech Stack Data Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Scan all {orgs.length} organizations to detect web servers, CMS platforms, programming languages, and CDN providers.
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    setTechScanning(true);
                    try { await runFingerprinting(orgs); } finally { setTechScanning(false); }
                  }}
                  disabled={techScanning}
                  className="gap-2"
                >
                  {techScanning ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning...</> : <><Wrench className="w-4 h-4" /> Scan Tech Stack</>}
                </Button>
                <p className="text-xs text-muted-foreground">Or click "Run Full Scan" above to run all checks at once.</p>
              </CardContent>
            </Card>
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
                      if (fp.error || fp.success === false) return (
                        <TableRow key={org.id}>
                          <TableCell className="font-medium">{org.name}</TableCell>
                          <TableCell colSpan={5} className="text-orange-400">
                            ⚠ Check Failed{fp.error ? `: ${fp.error}` : ''}
                          </TableCell>
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
            <Card className="border-border">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                <Fish className="w-12 h-12 text-muted-foreground/50" />
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">No Phishing Data Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Scan for lookalike/typosquat domains targeting {orgs.length} monitored organizations.
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    setPhishingScanning(true);
                    try { await runPhishingCheck(orgs); } finally { setPhishingScanning(false); }
                  }}
                  disabled={phishingScanning}
                  className="gap-2"
                >
                  {phishingScanning ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning...</> : <><Fish className="w-4 h-4" /> Scan for Phishing Domains</>}
                </Button>
                <p className="text-xs text-muted-foreground">Or click "Run Full Scan" above to run all checks at once.</p>
              </CardContent>
            </Card>
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
          {/* Breach scan progress */}
          {breachProgress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Checking breaches... Organization {breachProgress.current}/{breachProgress.total}: {breachProgress.currentOrg}</span>
                <span>{Math.round((breachProgress.current / breachProgress.total) * 100)}%</span>
              </div>
              <Progress value={(breachProgress.current / breachProgress.total) * 100} className="h-2" />
              <p className="text-[10px] text-muted-foreground">Each organization checks 15 email patterns. Estimated ~{Math.ceil((breachProgress.total - breachProgress.current) * 26 / 60)} min remaining.</p>
            </div>
          )}

          {breachResults.length === 0 && !scanning && !breachScanning && (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                <Database className="w-12 h-12 text-muted-foreground/50" />
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">No Breach Data Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Check if any of the {orgs.length} monitored organization domains appear in known data breach databases.
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    setBreachScanning(true);
                    try { await runBreachCheck(orgs); } finally { setBreachScanning(false); }
                  }}
                  disabled={breachScanning}
                  className="gap-2"
                >
                  {breachScanning ? <><RefreshCw className="w-4 h-4 animate-spin" /> Checking...</> : <><Database className="w-4 h-4" /> Check for Breaches</>}
                </Button>
                <p className="text-xs text-muted-foreground">Or click "Run Full Scan" above to run all checks at once.</p>
              </CardContent>
            </Card>
          )}

          {/* Summary Banner */}
          {breachResults.length > 0 && !breachProgress && (() => {
            const breachedOrgs = breachResults.filter(r => r.breachCount > 0);
            const cleanOrgs = breachResults.filter(r => r.isClean === true);
            const unknownOrgs = breachResults.filter(r => r.isClean === null);
            const source = breachResults[0]?.source || 'Free Breach Check';

            return (
              <div className="space-y-3">
                {breachedOrgs.length === 0 ? (
                  <Alert className="bg-emerald-500/10 border-emerald-500/30">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <AlertTitle className="text-emerald-400">✓ No data breaches detected for any monitored organization</AlertTitle>
                    <AlertDescription className="text-xs">
                      Checked via: {source} · {cleanOrgs.length} clean{unknownOrgs.length > 0 ? `, ${unknownOrgs.length} unknown` : ''}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-red-500/10 border-red-500/30">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <AlertTitle className="text-red-400">⚠ {breachedOrgs.length} organization(s) have known data breaches</AlertTitle>
                    <AlertDescription className="text-xs">
                      Checked via: {source} · {cleanOrgs.length} clean, {breachedOrgs.length} breached{unknownOrgs.length > 0 ? `, ${unknownOrgs.length} unknown` : ''}
                    </AlertDescription>
                  </Alert>
                )}

                {/* HIBP API key recommendation */}
                {source.includes('Free') && (
                  <Alert className="bg-yellow-500/10 border-yellow-500/30">
                    <Globe className="w-4 h-4 text-yellow-400" />
                    <AlertDescription className="text-xs text-yellow-300">
                      ℹ Using free breach detection (limited to exact domain match). For comprehensive domain-specific email breach search,
                      add a <a href="https://haveibeenpwned.com/API/Key" target="_blank" rel="noopener noreferrer" className="underline font-semibold">HIBP API key ($3.50/month)</a> as
                      a Cloud secret named <code className="bg-muted px-1 rounded">HIBP_API_KEY</code>.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            );
          })()}

          {/* Re-check button */}
          {breachResults.length > 0 && !breachProgress && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {breachResults[0]?.checkedAt && `Last checked: ${timeAgo(breachResults[0].checkedAt)}`}
              </span>
              <Button
                size="sm" variant="outline" className="text-xs"
                onClick={async () => {
                  setBreachScanning(true);
                  try { await runBreachCheck(orgs); } finally { setBreachScanning(false); }
                }}
                disabled={breachScanning || !!breachProgress}
              >
                <RefreshCw className={cn('w-3 h-3 mr-1', breachScanning && 'animate-spin')} />
                {breachScanning ? 'Checking...' : 'Check All Now'}
              </Button>
            </div>
          )}

          {/* Full Organization Table */}
          {breachResults.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-neon-cyan" /> Organization Breach Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Breaches</TableHead>
                      <TableHead>Affected Emails</TableHead>
                      <TableHead>Last Checked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breachResults.map((r, i) => {
                      const statusBadge = r.error === 'NO_API_KEY' ? (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30" variant="outline">🔑 No API Key</Badge>
                      ) : r.error ? (
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30" variant="outline">⚠ Error</Badge>
                      ) : r.isClean === true ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" variant="outline">✓ Clean</Badge>
                      ) : r.breachCount > 0 ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30" variant="outline">⚠ {r.breachCount} Breach{r.breachCount > 1 ? 'es' : ''}</Badge>
                      ) : !r.checkedAt ? (
                        <Badge className="bg-muted/50 text-muted-foreground border-border" variant="outline">⏳ Not Checked</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" variant="outline">✓ Clean</Badge>
                      );

                      return (
                        <TableRow
                          key={`${r.domain}-${i}`}
                          className={cn('cursor-pointer hover:bg-accent/50 transition-colors', r.breachCount > 0 && 'bg-red-500/5')}
                          onClick={() => setSelectedBreachOrg(r)}
                        >
                          <TableCell className="font-medium">{r.organization}</TableCell>
                          <TableCell className="font-mono text-xs">{r.domain}</TableCell>
                          <TableCell>{statusBadge}</TableCell>
                          <TableCell className="text-sm">{r.breachCount}</TableCell>
                          <TableCell className="text-sm">{r.breachedEmails?.length || 0}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.checkedAt ? timeAgo(r.checkedAt) : '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Detail Modal ─── */}
      <Dialog open={!!detailOrg} onOpenChange={() => setDetailOrg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailOrg && <ScoreGauge score={detailOrg.score} maxScore={detailOrg.maxPossible} size={60} />}
              <div>
                <p>{detailOrg?.org.name}</p>
                <p className="text-xs text-muted-foreground font-normal">{detailOrg?.org.sector} — {detailOrg?.org.url}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {detailOrg && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  Score: <span className={cn('font-bold', gradeColor(detailOrg.grade))}>
                    {detailOrg.score}/{detailOrg.maxPossible} ({detailOrg.percentage}%) — {detailOrg.grade}
                  </span>
                </p>
                <ConfidenceBadge confidence={detailOrg.confidence} completed={detailOrg.completedChecks} total={detailOrg.totalChecks} />
              </div>
              {detailOrg.confidence < 50 && (
                <Alert className="bg-yellow-500/10 border-yellow-500/30">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <AlertDescription className="text-xs text-yellow-400">
                    Low confidence — only {detailOrg.completedChecks}/{detailOrg.totalChecks} checks completed. Score may change as more checks complete.
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                {Object.entries(detailOrg.breakdown).map(([key, item]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className={cn('capitalize', item.status === 'pending' && 'text-muted-foreground')}>
                      {key}
                      {item.status === 'pending' && <span className="text-[10px] ml-1 text-muted-foreground">(pending)</span>}
                      {item.status === 'failed' && <span className="text-[10px] ml-1 text-orange-400">(failed)</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      {item.status === 'completed' ? (
                        <>
                          <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all duration-500',
                              item.points / item.max >= 0.8 ? 'bg-emerald-500' :
                              item.points / item.max >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                            )} style={{ width: `${(item.points / item.max) * 100}%` }} />
                          </div>
                          <span className="text-xs font-mono w-10 text-right">{item.points}/{item.max}</span>
                        </>
                      ) : item.status === 'failed' ? (
                        <span className="text-xs text-orange-400 font-mono">⚠ Failed</span>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">◌ Pending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Mark as Clean / Reset Baseline actions */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={async () => {
                    if (!detailOrg) return;
                    // Mark as clean: insert safe defacement log + update baseline
                    await supabase.from('early_warning_logs').insert({
                      organization_id: detailOrg.org.id, organization_name: detailOrg.org.name, url: detailOrg.org.url,
                      check_type: 'defacement', risk_level: 'safe',
                      details: { status: 'clean', manualOverride: true },
                    });
                    toast({ title: `${detailOrg.org.name} marked as clean` });
                    calculateScorecards(orgs);
                  }}
                >
                  <Check className="w-3 h-3 mr-1" /> Mark as Clean
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={async () => {
                    if (!detailOrg) return;
                    // Reset baseline: fetch current page and update baseline
                    try {
                      const { data } = await invokeWithRetry('check-defacement', {
                        urls: [{ url: detailOrg.org.url, baselineHash: null, baselineTitle: null, baselineSize: null, checkCount: 0 }]
                      }, 1, 25000);
                      const r = data?.results?.[0];
                      if (r?.currentHash) {
                        await supabase.from('baselines').upsert({
                          organization_id: detailOrg.org.id, url: detailOrg.org.url,
                          content_hash: r.currentHash, page_title: r.currentTitle, page_size: r.currentSize,
                        }, { onConflict: 'url' });
                        toast({ title: `Baseline reset for ${detailOrg.org.name}` });
                      }
                    } catch { toast({ title: 'Failed to reset baseline', variant: 'destructive' }); }
                  }}
                >
                  <RotateCw className="w-3 h-3 mr-1" /> Reset Baseline
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => window.open(detailOrg?.org.url, '_blank')}
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> View Page
                </Button>
              </div>
              {detailOrg.lastUpdated && (
                <p className="text-xs text-muted-foreground text-right">Last updated: {timeAgo(detailOrg.lastUpdated)}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Breach Detail Dialog ─── */}
      <Dialog open={!!selectedBreachOrg} onOpenChange={() => setSelectedBreachOrg(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-red-400" />
              <div>
                <p>{selectedBreachOrg?.organization}</p>
                <p className="text-xs text-muted-foreground font-normal">{selectedBreachOrg?.domain}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedBreachOrg && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                {selectedBreachOrg.isClean === true ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" variant="outline">✓ Clean</Badge>
                ) : selectedBreachOrg.isClean === null ? (
                  <Badge className="bg-muted/50 text-muted-foreground border-border" variant="outline">? Unknown</Badge>
                ) : (
                  <Badge className={severityBadge(selectedBreachOrg.riskLevel === 'high' ? 'critical' : selectedBreachOrg.riskLevel === 'medium' ? 'high' : 'medium')} variant="outline">
                    Risk: {selectedBreachOrg.riskLevel}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">{selectedBreachOrg.breachCount} breach(es) found</span>
                {selectedBreachOrg.breachedEmails && selectedBreachOrg.breachedEmails.length > 0 && (
                  <span className="text-sm text-red-400">{selectedBreachOrg.breachedEmails.length} email(s) affected</span>
                )}
                {selectedBreachOrg.source && (
                  <span className="text-[10px] text-muted-foreground ml-auto">via {selectedBreachOrg.source}</span>
                )}
              </div>

              {/* Breached Emails List */}
              {selectedBreachOrg.breachedEmails && selectedBreachOrg.breachedEmails.length > 0 && (
                <Card className="border-red-500/20 bg-red-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Affected Email Addresses</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {selectedBreachOrg.breachedEmails.map((email: string) => {
                      const breachesForEmail = selectedBreachOrg.breaches.filter(b => b.affectedEmails?.includes(email));
                      return (
                        <div key={email} className="flex items-center justify-between text-xs">
                          <span className="font-mono text-red-400">{email}</span>
                          <span className="text-muted-foreground">found in {breachesForEmail.length} breach(es)</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {selectedBreachOrg.error && (
                <Alert className="bg-orange-500/10 border-orange-500/30">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <AlertDescription className="text-xs text-orange-300">Check failed: {selectedBreachOrg.error}</AlertDescription>
                </Alert>
              )}

              {selectedBreachOrg.breaches.length === 0 && !selectedBreachOrg.error ? (
                <Alert className="bg-emerald-500/10 border-emerald-500/30">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <AlertTitle className="text-emerald-400">No breaches found</AlertTitle>
                  <AlertDescription>No known breaches match this organization's domain ({selectedBreachOrg.domain}).</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {selectedBreachOrg.breaches.map((b, i) => {
                    const bDate = b.breachDate || b.date || '';
                    const types = b.dataClasses || b.dataTypes || [];

                    // Color-code data classes
                    const getDataClassColor = (dc: string) => {
                      const lower = dc.toLowerCase();
                      if (lower.includes('password') || lower.includes('credit') || lower.includes('bank') || lower.includes('security') || lower.includes('financial'))
                        return 'bg-red-500/20 text-red-400 border-red-500/30';
                      if (lower.includes('phone') || lower.includes('address') || lower.includes('date of birth') || lower.includes('physical'))
                        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
                      if (lower.includes('email') || lower.includes('username') || lower.includes('ip address'))
                        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
                      return 'bg-muted/50 text-muted-foreground border-border';
                    };

                    return (
                      <Card key={i} className="border-border">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">{b.title || b.name}</h4>
                            {b.isVerified && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]" variant="outline">Verified</Badge>}
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Date: <span className="font-mono">{bDate || 'Unknown'}</span></span>
                            <span>Records: <span className="font-mono">{(b.pwnCount || b.recordCount)?.toLocaleString() || '?'}</span></span>
                          </div>
                          {b.affectedEmails && b.affectedEmails.length > 0 && (
                            <div className="text-xs text-red-400">
                              Affected: {b.affectedEmails.join(', ')}
                            </div>
                          )}
                          {b.description && <p className="text-xs text-muted-foreground">{b.description}</p>}
                          {types.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs text-muted-foreground mr-1">Exposed:</span>
                              {types.map((dt: string) => (
                                <Badge key={dt} variant="outline" className={cn('text-[10px]', getDataClassColor(dt))}>{dt}</Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Recommendations based on leaked data */}
              {selectedBreachOrg.breaches.length > 0 && (() => {
                const allDataClasses = selectedBreachOrg.breaches.flatMap(b => (b.dataClasses || b.dataTypes || []).map(d => d.toLowerCase()));
                const hasPasswords = allDataClasses.some(d => d.includes('password'));
                const hasEmails = allDataClasses.some(d => d.includes('email'));
                const hasPhones = allDataClasses.some(d => d.includes('phone'));
                const hasIPs = allDataClasses.some(d => d.includes('ip address'));
                const hasFinancial = allDataClasses.some(d => d.includes('financial') || d.includes('credit') || d.includes('bank'));
                const hasDOB = allDataClasses.some(d => d.includes('date of birth') || d.includes('physical'));

                if (!hasPasswords && !hasEmails && !hasPhones && !hasIPs && !hasFinancial && !hasDOB) return null;

                return (
                  <Card className="border-orange-500/20 bg-orange-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-400" /> Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      {hasPasswords && (
                        <p className="flex items-start gap-2">
                          <span className="text-red-400 font-bold">🔴</span>
                          <span><strong>CRITICAL:</strong> Force immediate password reset for all @{selectedBreachOrg.domain} accounts. Enforce MFA.</span>
                        </p>
                      )}
                      {hasFinancial && (
                        <p className="flex items-start gap-2">
                          <span className="text-red-400 font-bold">🔴</span>
                          <span><strong>CRITICAL:</strong> Financial data exposed. Contact bank immediately. Monitor for fraudulent transactions.</span>
                        </p>
                      )}
                      {hasEmails && (
                        <p className="flex items-start gap-2">
                          <span className="text-orange-400 font-bold">🟠</span>
                          <span><strong>HIGH:</strong> Expect increased phishing attacks targeting @{selectedBreachOrg.domain}. Alert all staff.</span>
                        </p>
                      )}
                      {hasPhones && (
                        <p className="flex items-start gap-2">
                          <span className="text-orange-400 font-bold">🟠</span>
                          <span><strong>HIGH:</strong> Expect SMS phishing (smishing). Warn staff about suspicious texts.</span>
                        </p>
                      )}
                      {hasIPs && (
                        <p className="flex items-start gap-2">
                          <span className="text-yellow-400 font-bold">🟡</span>
                          <span><strong>MEDIUM:</strong> Attackers may know network infrastructure. Review firewall rules.</span>
                        </p>
                      )}
                      {hasDOB && (
                        <p className="flex items-start gap-2">
                          <span className="text-yellow-400 font-bold">🟡</span>
                          <span><strong>MEDIUM:</strong> Risk of identity theft. Alert affected staff.</span>
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {selectedBreachOrg.note && (
                <p className="text-xs text-muted-foreground italic">{selectedBreachOrg.note}</p>
              )}

              {selectedBreachOrg.checkedAt && (
                <p className="text-xs text-muted-foreground text-right">Checked: {timeAgo(selectedBreachOrg.checkedAt)}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ThreatIntelligence;
