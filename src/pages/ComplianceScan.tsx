import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { Shield, ChevronDown, Loader2, PlayCircle, CheckCircle2, XCircle, Clock, Download, ExternalLink, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatET } from '@/lib/dateUtils';
import { toast } from '@/hooks/use-toast';

/* ── helpers ── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const proxyUrl = (path: string) =>
  `${SUPABASE_URL}/functions/v1/security-scanner-proxy?path=${encodeURIComponent(path)}`;

const apiHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
});

const getBarColor = (s: number) =>
  s >= 80 ? '#00c853' : s >= 60 ? '#ffab00' : s >= 40 ? '#ff6d00' : '#d50000';

const scoreColor = (s: number) =>
  s >= 80 ? 'text-green-400' : s >= 60 ? 'text-yellow-400' : s >= 40 ? 'text-orange-400' : 'text-red-500';

const scoreBg = (s: number) =>
  s >= 80 ? 'bg-green-500' : s >= 60 ? 'bg-yellow-500' : s >= 40 ? 'bg-orange-500' : 'bg-red-500';

const gradeColor = (g: string) =>
  g === 'A' || g === 'B'
    ? 'text-green-400 bg-green-500/10 border-green-500/30'
    : g === 'C'
    ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    : 'text-red-500 bg-red-500/10 border-red-500/30';

const sevOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
const sevBadge = (s: string) => {
  const c =
    s === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
    s === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
    s === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
    'bg-green-500/10 text-green-400 border-green-500/20';
  return <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', c)}>{s}</span>;
};

/* Normalize controls: API returns {key: {detail}} object or array */
const normalizeControls = (raw: any): ControlItem[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.entries(raw).map(([key, val]: [string, any]) => ({
    control_key: key,
    detail: typeof val === 'object' ? val?.detail : String(val),
    severity: typeof val === 'object' ? val?.severity : undefined,
    remediation: typeof val === 'object' ? val?.remediation : undefined,
  }));
};

/* ── types ── */
interface ControlItem {
  control_key: string;
  name?: string;
  detail?: string;
  severity?: string;
  remediation?: string;
  nist_control?: string;
  nist_name?: string;
  iso_control?: string;
  gdpr_article?: string;
  itu_pillar?: string;
}

interface RawCheck {
  uptime?: { checks?: Array<{ method: string; online: boolean; detail: string }>; verdict?: string; [k: string]: any };
  ssl?: { valid: boolean; common_name?: string; issuer?: string; expires?: string; days_until_expiry?: number; [k: string]: any };
  headers?: { grade?: string; present?: Record<string, string>; missing?: Record<string, any>; [k: string]: any };
  ddos?: { verdict?: string; providers?: string[]; evidence?: string[]; [k: string]: any };
  dns?: { results?: { spf?: { present: boolean }; dmarc?: { present: boolean }; zone_transfer?: { allowed: boolean } }; [k: string]: any };
}

interface FrameworkScores { scores: Record<string, number>; average: number }
interface ComplianceResults {
  overall_score: number;
  grade: string;
  passed: number;
  failed: number;
  total_controls: number;
  checked_at?: string;
  passed_controls?: any;
  failed_controls?: any;
  raw_checks?: RawCheck;
  frameworks: {
    nist_csf: FrameworkScores;
    iso_27001: FrameworkScores;
    gdpr: FrameworkScores;
    itu_nci: FrameworkScores;
  };
  compliance_findings: Array<{
    control_key: string;
    severity: string;
    detail: string;
    nist_control: string;
    nist_name: string;
    iso_control: string;
    iso_name?: string;
    gdpr_article: string;
    gdpr_name?: string;
    itu_pillar: string;
    remediation: string;
  }>;
}

interface ScanRecord {
  scan_id: string;
  organization_name: string;
  target_url?: string;
  target?: string;
  compliance_status: string;
  compliance_phase: string;
  compliance_results: ComplianceResults | null;
  overall_score?: number;
  grade?: string;
  created_at: string;
}

/* ── Sheet Drawer for Framework Detail ── */
interface SheetState {
  open: boolean;
  framework: string;
  category: string;
  score: number;
  controls: ControlItem[];
}

const FrameworkDetailSheet: React.FC<{ state: SheetState; onClose: () => void }> = ({ state, onClose }) => (
  <Sheet open={state.open} onOpenChange={(o) => !o && onClose()}>
    <SheetContent className="overflow-y-auto sm:max-w-md">
      <SheetHeader>
        <SheetTitle className="font-mono text-sm">{state.framework} — {state.category}</SheetTitle>
        <SheetDescription>
          <span className={cn('text-4xl font-bold font-mono', scoreColor(state.score))}>{Math.round(state.score)}</span>
          <span className="text-muted-foreground text-sm ml-2">/ 100</span>
        </SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-3">
        {state.controls.length === 0 && <p className="text-sm text-muted-foreground">No controls mapped to this category.</p>}
        {state.controls.map((c, i) => {
          const passed = !c.severity || c.severity === 'PASS';
          return (
            <div key={i} className={cn('rounded-lg border p-3 space-y-1', passed ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5')}>
              <div className="flex items-center gap-2">
                {passed ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                <span className="font-mono text-xs font-medium">{c.control_key}</span>
                {c.name && <span className="text-xs text-muted-foreground truncate">— {c.name}</span>}
              </div>
              {!passed && c.detail && <p className="text-xs text-foreground pl-6">{c.detail}</p>}
              {!passed && c.remediation && (
                <div className="ml-6 mt-1 rounded bg-muted/40 border border-border p-2">
                  <p className="text-xs text-muted-foreground">🔧 {c.remediation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SheetContent>
  </Sheet>
);

/* ── Scan Metadata Header ── */
const ScanMetadata: React.FC<{ results: ComplianceResults; orgName: string; targetUrl: string; onDownload: () => void }> = ({ results, orgName, targetUrl, onDownload }) => (
  <Card className="glass-card border-border">
    <CardContent className="py-4 flex flex-wrap items-center gap-4 justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{orgName}</span>
        <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
          {targetUrl} <ExternalLink className="w-3 h-3" />
        </a>
        {results.checked_at && (
          <span className="text-[10px] text-muted-foreground font-mono">Completed: {formatET(results.checked_at, 'MMM dd, yyyy HH:mm')}</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className={cn('text-5xl font-bold font-mono px-3 py-1 rounded border', gradeColor(results.grade))}>{results.grade}</span>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onDownload}>
          <Download className="w-4 h-4" /> Download Report
        </Button>
      </div>
    </CardContent>
  </Card>
);

/* ── Overall Score Card with breakdown ── */
const OverallScoreCard: React.FC<{ r: ComplianceResults; onControlClick: (c: ControlItem) => void }> = ({ r, onControlClick }) => {
  const passedList = normalizeControls(r.passed_controls);
  const failedList = normalizeControls(r.failed_controls);
  return (
  <Card className="glass-card border-border">
    <CardContent className="flex flex-col items-center py-8 gap-3">
      <span className={cn('text-6xl font-bold font-mono', scoreColor(r.overall_score))}>{r.overall_score}</span>
      <span className={cn('text-2xl font-bold font-mono px-3 py-1 rounded border', gradeColor(r.grade))}>{r.grade}</span>
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1 text-green-400"><CheckCircle2 className="w-4 h-4" />{r.passed} passed</span>
        <span className="flex items-center gap-1 text-red-400"><XCircle className="w-4 h-4" />{r.failed} failed</span>
      </div>
      <div className="w-full max-w-md">
        <div className="text-xs text-muted-foreground text-center mb-1">{r.passed} of {r.total_controls} controls passed</div>
        <Progress value={(r.passed / Math.max(r.total_controls, 1)) * 100} className={cn('h-2', scoreBg(r.overall_score))} />
      </div>

      {/* Passed / Failed breakdown */}
      {(passedList.length > 0 || failedList.length > 0) && (
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="space-y-1">
            <h4 className="text-xs font-mono text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Passed Controls</h4>
            {passedList.map((c, i) => (
              <button key={i} onClick={() => onControlClick(c)} className="w-full text-left rounded border border-green-500/20 bg-green-500/5 p-2 hover:bg-green-500/10 transition-colors">
                <span className="font-mono text-[11px] text-green-400">{c.control_key}</span>
                {c.name && <span className="text-[10px] text-muted-foreground ml-1.5">— {c.name}</span>}
              </button>
            ))}
            {passedList.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-mono text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed Controls</h4>
            {failedList.map((c, i) => (
              <button key={i} onClick={() => onControlClick(c)} className="w-full text-left rounded border border-red-500/20 bg-red-500/5 p-2 hover:bg-red-500/10 transition-colors">
                <span className="font-mono text-[11px] text-red-400">{c.control_key}</span>
                {c.name && <span className="text-[10px] text-muted-foreground ml-1.5">— {c.name}</span>}
                {c.detail && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.detail}</p>}
              </button>
            ))}
            {failedList.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
          </div>
        </div>
      )}
    </CardContent>
  </Card>
  );
};

/* ── Framework Bar Card ── */
const FrameworkBarCard: React.FC<{
  title: string;
  scores: Record<string, number>;
  average: number;
  onBarClick: (category: string, score: number) => void;
}> = ({ title, scores, average, onBarClick }) => {
  const data = Object.entries(scores).map(([name, value]) => ({ name, value: Math.round(value) }));
  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center justify-between">
          {title}
          <span className={cn('text-lg font-bold', scoreColor(average))}>{Math.round(average)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor="pointer">
              {data.map((d, i) => (
                <Cell key={i} fill={getBarColor(d.value)} onClick={() => onBarClick(d.name, d.value)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

/* ── Finding Row ── */
const FindingRow: React.FC<{ f: ComplianceResults['compliance_findings'][0] }> = ({ f }) => {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/30 transition-colors">
          <TableCell>{sevBadge(f.severity)}</TableCell>
          <TableCell className="font-mono text-xs">{f.control_key}</TableCell>
          <TableCell className="text-xs max-w-[200px] truncate">{f.detail}</TableCell>
          <TableCell className="text-[10px] font-mono text-muted-foreground">{f.nist_control}</TableCell>
          <TableCell className="text-[10px] font-mono text-muted-foreground">{f.iso_control}</TableCell>
          <TableCell className="text-[10px] font-mono text-muted-foreground">{f.gdpr_article}</TableCell>
          <TableCell><ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} /></TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/10 border-l-2 border-primary/40">
            <div className="py-3 px-3 space-y-2">
              <p className="text-xs text-foreground">{f.detail}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                <span><strong>NIST:</strong> {f.nist_control} {f.nist_name && `— ${f.nist_name}`}</span>
                <span><strong>ISO:</strong> {f.iso_control} {f.iso_name && `— ${f.iso_name}`}</span>
                <span><strong>GDPR:</strong> {f.gdpr_article} {f.gdpr_name && `— ${f.gdpr_name}`}</span>
                <span><strong>ITU Pillar:</strong> {f.itu_pillar}</span>
              </div>
              <div className="rounded bg-muted/30 border border-border p-2.5 mt-1">
                <p className="text-xs text-muted-foreground"><span className="font-medium">🔧 Remediation:</span> {f.remediation}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-1 text-xs gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  toast({ title: 'Acknowledged', description: `${f.control_key} marked as acknowledged.` });
                }}
              >
                <Flag className="w-3 h-3" /> Mark as Acknowledged
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
};

/* ── Technical Evidence ── */
const TechnicalEvidence: React.FC<{ raw: RawCheck }> = ({ raw }) => {
  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [open, setOpen] = useState(false);
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 hover:bg-muted/20 rounded transition-colors">
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
          <span className="text-xs font-mono font-medium text-foreground">{title}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6 pr-3 pb-3">{children}</CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono">Technical Evidence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-0 pb-2">
        {/* Uptime */}
        {raw.uptime && (
          <Section title="Uptime Checks">
            <div className="space-y-1">
              {(raw.uptime.checks || []).map((u, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {u.online ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                  <span className="font-mono">{u.method}</span>
                  <span className="text-muted-foreground">{u.detail}</span>
                </div>
              ))}
              {raw.uptime.verdict && <p className="text-xs mt-1 text-muted-foreground">Verdict: {raw.uptime.verdict}</p>}
            </div>
          </Section>
        )}

        {/* SSL */}
        {raw.ssl && (
          <Section title="SSL / TLS">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-muted-foreground">Valid</span>
              <span className={raw.ssl.valid ? 'text-green-400' : 'text-red-400'}>{raw.ssl.valid ? '✅ Yes' : '❌ No'}</span>
              {raw.ssl.common_name && <><span className="text-muted-foreground">CN</span><span>{raw.ssl.common_name}</span></>}
              {raw.ssl.issuer && <><span className="text-muted-foreground">Issuer</span><span>{raw.ssl.issuer}</span></>}
              {raw.ssl.expires && <><span className="text-muted-foreground">Expires</span><span>{raw.ssl.expires}</span></>}
              {raw.ssl.days_until_expiry != null && <><span className="text-muted-foreground">Days Left</span><span className={raw.ssl.days_until_expiry < 30 ? 'text-yellow-400' : ''}>{raw.ssl.days_until_expiry}</span></>}
            </div>
          </Section>
        )}

        {/* Headers */}
        {raw.headers && (
          <Section title={`Security Headers ${raw.headers.grade ? `(Grade: ${raw.headers.grade})` : ''}`}>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(raw.headers.present || {}).map((h, i) => (
                <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">{h}</span>
              ))}
              {Object.keys(raw.headers.missing || {}).map((h, i) => (
                <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{h}</span>
              ))}
            </div>
          </Section>
        )}

        {/* DDoS */}
        {raw.ddos && (
          <Section title="DDoS Protection">
            <div className="space-y-1 text-xs">
              {raw.ddos.verdict && <p><strong>Verdict:</strong> {raw.ddos.verdict}</p>}
              <p><strong>Providers:</strong> {(raw.ddos.providers?.length || 0) > 0 ? raw.ddos.providers!.join(', ') : 'None detected'}</p>
              {(raw.ddos.evidence || []).map((e, i) => (
                <p key={i} className="text-muted-foreground text-[11px]">• {e}</p>
              ))}
            </div>
          </Section>
        )}

        {/* DNS */}
        {raw.dns && (
          <Section title="DNS Security">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-muted-foreground">SPF</span>
              <span className={raw.dns.results?.spf?.present ? 'text-green-400' : 'text-red-400'}>{raw.dns.results?.spf?.present ? '✅ Present' : '❌ Missing'}</span>
              <span className="text-muted-foreground">DMARC</span>
              <span className={raw.dns.results?.dmarc?.present ? 'text-green-400' : 'text-red-400'}>{raw.dns.results?.dmarc?.present ? '✅ Present' : '❌ Missing'}</span>
              {raw.dns.results?.zone_transfer != null && (
                <>
                  <span className="text-muted-foreground">Zone Transfer</span>
                  <span className={!raw.dns.results.zone_transfer.allowed ? 'text-green-400' : 'text-red-400'}>
                    {!raw.dns.results.zone_transfer.allowed ? '✅ Blocked' : '❌ Allowed'}
                  </span>
                </>
              )}
            </div>
          </Section>
        )}
      </CardContent>
    </Card>
  );
};

/* ── Main page ── */
const ComplianceScan: React.FC = () => {
  const [params] = useSearchParams();
  const [orgName, setOrgName] = useState(params.get('org') || '');
  const [targetUrl, setTargetUrl] = useState(params.get('url') || '');
  const [scanning, setScanning] = useState(false);
  const [phase, setPhase] = useState('');
  const [results, setResults] = useState<ComplianceResults | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  // Sheet drawer state
  const [sheetState, setSheetState] = useState<SheetState>({ open: false, framework: '', category: '', score: 0, controls: [] });

  /* Fetch history on mount */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(proxyUrl('/compliance/scans'), { headers: apiHeaders() });
        if (res.ok) {
          const data = await res.json();
          setHistory(Array.isArray(data) ? data : data.scans || []);
        } else {
          const data = await res.json().catch(() => ({}));
          const msg = data.detail || data.error || `API returned ${res.status}`;
          console.warn('[ComplianceScan] History fetch failed:', res.status, data);
          if (res.status === 404) {
            setError('Compliance scanning API is not available. Please verify the backend has compliance endpoints deployed.');
          } else {
            setError(msg);
          }
        }
      } catch (err) {
        console.error('[ComplianceScan] History fetch error:', err);
      }
      setLoadingHistory(false);
    })();
  }, [results]);

  /* Poll scan */
  const pollScan = useCallback((scanId: string) => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch(proxyUrl(`/compliance/scan/${scanId}`), { headers: apiHeaders() });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.warn('[ComplianceScan] Poll error:', res.status, data);
          if (res.status === 404) {
            clearInterval(iv);
            setError('Compliance scanning API is not available.');
            setScanning(false);
            setPhase('');
          }
          return;
        }
        const data = await res.json();
        setPhase(data.compliance_phase || '');
        if (data.compliance_status === 'done') {
          clearInterval(iv);
          setResults(data.compliance_results);
          setScanning(false);
          setPhase('');
        } else if (data.compliance_status === 'error') {
          clearInterval(iv);
          setError(data.error || 'Scan failed with an error.');
          setScanning(false);
          setPhase('');
        }
      } catch { /* retry next tick */ }
    }, 5000);
    return iv;
  }, []);

  const startScan = async () => {
    if (!(orgName || '').trim() || !(targetUrl || '').trim()) return;
    setScanning(true);
    setResults(null);
    setError(null);
    setSelectedScanId(null);
    setPhase('Initiating scan…');
    try {
      const res = await fetch(proxyUrl('/compliance/scan'), {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ target_url: targetUrl.trim(), organization_name: orgName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.detail || data.error || `API returned ${res.status}`;
        console.error('[ComplianceScan] Start scan failed:', res.status, data);
        setScanning(false);
        setPhase('');
        setError(res.status === 404
          ? 'Compliance scanning API is not available. Please verify the backend has compliance endpoints deployed.'
          : msg);
        return;
      }
      const data = await res.json();
      if (data.scan_id) {
        const iv = pollScan(data.scan_id);
        return () => clearInterval(iv);
      } else {
        setScanning(false);
        setPhase('');
        setError(data.detail || data.error || 'No scan ID returned');
      }
    } catch {
      setScanning(false);
      setPhase('Network error');
      setError('Network error – could not reach the compliance API.');
    }
  };

  /* Load history scan */
  const loadHistoryScan = async (h: ScanRecord) => {
    setSelectedScanId(h.scan_id);
    setOrgName(h.organization_name);
    setTargetUrl(h.target_url || h.target || '');
    if (h.compliance_results) {
      setResults(h.compliance_results);
      return;
    }
    try {
      const res = await fetch(proxyUrl(`/compliance/scan/${h.scan_id}/report`), { headers: apiHeaders() });
      if (res.ok) {
        const data = await res.json();
        setResults(data.compliance_results || data);
      }
    } catch (err) {
      console.error('[ComplianceScan] Load history error:', err);
    }
  };

  /* Download report */
  const downloadReport = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${orgName || 'scan'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* Open sheet for a framework bar click */
  const handleBarClick = (framework: string, category: string, score: number) => {
    const findings = results?.compliance_findings || [];
    const failed = normalizeControls(results?.failed_controls);
    const passed = normalizeControls(results?.passed_controls);

    // Build controls for the category by matching findings/controls
    const catLower = category.toLowerCase();
    const relevantFindings: ControlItem[] = findings
      .filter(f => {
        const matchNist = framework.includes('NIST') && f.nist_name?.toLowerCase().includes(catLower);
        const matchIso = framework.includes('ISO') && f.iso_control?.toLowerCase().includes(catLower);
        const matchGdpr = framework.includes('GDPR') && f.gdpr_article?.toLowerCase().includes(catLower);
        const matchItu = framework.includes('ITU') && f.itu_pillar?.toLowerCase().includes(catLower);
        return matchNist || matchIso || matchGdpr || matchItu;
      })
      .map(f => ({ ...f, severity: f.severity }));

    // Also include passed/failed controls that match
    const allControls = [
      ...passed.filter(c => c.name?.toLowerCase().includes(catLower) || c.control_key?.toLowerCase().includes(catLower)).map(c => ({ ...c, severity: 'PASS' })),
      ...failed.filter(c => c.name?.toLowerCase().includes(catLower) || c.control_key?.toLowerCase().includes(catLower)),
      ...relevantFindings,
    ];

    // Deduplicate by control_key
    const seen = new Set<string>();
    const deduped = allControls.filter(c => {
      if (seen.has(c.control_key)) return false;
      seen.add(c.control_key);
      return true;
    });

    setSheetState({ open: true, framework, category, score, controls: deduped.length > 0 ? deduped : relevantFindings });
  };

  /* Open sheet for a control click */
  const handleControlClick = (c: ControlItem) => {
    setSheetState({
      open: true,
      framework: 'Control Detail',
      category: c.control_key,
      score: c.severity === 'PASS' || !c.severity ? 100 : 0,
      controls: [c],
    });
  };

  const sortedFindings = results?.compliance_findings
    ?.slice()
    .sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9)) || [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold font-mono text-foreground">Compliance Scanner</h1>
      </div>

      {/* Scan form */}
      <Card className="glass-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="Organization name" value={orgName} onChange={e => setOrgName(e.target.value)} className="flex-1" />
            <Input placeholder="https://example.com" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} className="flex-1" />
            <Button onClick={startScan} disabled={scanning || !(orgName || '').trim() || !(targetUrl || '').trim()} className="gap-2">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              {scanning ? 'Scanning…' : 'Run Compliance Scan'}
            </Button>
          </div>
          {scanning && phase && (
            <div className="flex items-center gap-2 mt-3 text-sm text-primary font-mono animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              {phase}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground">Check the browser console for details.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <>
          {/* Scan Metadata */}
          <ScanMetadata results={results} orgName={orgName} targetUrl={targetUrl} onDownload={downloadReport} />

          {/* Overall Score */}
          <OverallScoreCard r={results} onControlClick={handleControlClick} />

          {/* Framework cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FrameworkBarCard title="NIST CSF 2.0" scores={results.frameworks.nist_csf.scores} average={results.frameworks.nist_csf.average} onBarClick={(cat, score) => handleBarClick('NIST CSF 2.0', cat, score)} />
            <FrameworkBarCard title="ISO 27001" scores={results.frameworks.iso_27001.scores} average={results.frameworks.iso_27001.average} onBarClick={(cat, score) => handleBarClick('ISO 27001', cat, score)} />
            <FrameworkBarCard title="GDPR" scores={results.frameworks.gdpr.scores} average={results.frameworks.gdpr.average} onBarClick={(cat, score) => handleBarClick('GDPR', cat, score)} />
            <FrameworkBarCard title="ITU NCI" scores={results.frameworks.itu_nci.scores} average={results.frameworks.itu_nci.average} onBarClick={(cat, score) => handleBarClick('ITU NCI', cat, score)} />
          </div>

          {/* Findings table */}
          {sortedFindings.length > 0 && (
            <Card className="glass-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono">Compliance Findings ({sortedFindings.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Severity</TableHead>
                        <TableHead>Control</TableHead>
                        <TableHead>Issue</TableHead>
                        <TableHead>NIST</TableHead>
                        <TableHead>ISO</TableHead>
                        <TableHead>GDPR</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedFindings.map((f, i) => <FindingRow key={i} f={f} />)}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Technical Evidence */}
          {results.raw_checks && <TechnicalEvidence raw={results.raw_checks} />}
        </>
      )}

      {/* Sheet drawer */}
      <FrameworkDetailSheet state={sheetState} onClose={() => setSheetState(s => ({ ...s, open: false }))} />

      {/* History */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Scan History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingHistory ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Loading…</div>
          ) : history.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No compliance scans yet</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow
                      key={h.scan_id}
                      className={cn('cursor-pointer hover:bg-muted/30 transition-colors', selectedScanId === h.scan_id && 'bg-primary/10')}
                      onClick={() => loadHistoryScan(h)}
                    >
                      <TableCell className="font-mono text-xs">{h.organization_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{h.target_url || h.target}</TableCell>
                      <TableCell>
                        {(h.compliance_results?.overall_score ?? h.overall_score) != null ? (
                          <span className={cn('font-bold font-mono', scoreColor(h.compliance_results?.overall_score ?? h.overall_score ?? 0))}>
                            {h.compliance_results?.overall_score ?? h.overall_score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">{h.compliance_status}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(h.compliance_results?.grade || h.grade) && (
                          <span className={cn('text-xs font-bold font-mono px-1.5 py-0.5 rounded border', gradeColor(h.compliance_results?.grade || h.grade || ''))}>
                            {h.compliance_results?.grade || h.grade}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {h.created_at ? formatET(h.created_at, 'MMM dd, yyyy') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceScan;
