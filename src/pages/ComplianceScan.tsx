import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { Shield, ChevronDown, Loader2, PlayCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatET } from '@/lib/dateUtils';

/* ── helpers ── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const proxyUrl = (path: string) =>
  `${SUPABASE_URL}/functions/v1/compliance-scan-proxy?path=${encodeURIComponent(path)}`;

const apiHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
});

const scoreColor = (s: number) => (s >= 75 ? 'text-neon-green' : s >= 50 ? 'text-neon-amber' : 'text-neon-red');
const scoreBg = (s: number) => (s >= 75 ? 'bg-neon-green' : s >= 50 ? 'bg-neon-amber' : 'bg-neon-red');
const gradeColor = (g: string) =>
  g === 'A' || g === 'B'
    ? 'text-neon-green bg-neon-green/10 border-neon-green/30'
    : g === 'C'
    ? 'text-neon-amber bg-neon-amber/10 border-neon-amber/30'
    : 'text-neon-red bg-neon-red/10 border-neon-red/30';

const sevOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
const sevBadge = (s: string) => {
  const c =
    s === 'CRITICAL' ? 'bg-neon-red/20 text-neon-red border-neon-red/30' :
    s === 'HIGH' ? 'bg-neon-red/10 text-neon-red/80 border-neon-red/20' :
    s === 'MEDIUM' ? 'bg-neon-amber/10 text-neon-amber border-neon-amber/20' :
    'bg-neon-green/10 text-neon-green border-neon-green/20';
  return <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', c)}>{s}</span>;
};

/* ── types ── */
interface FrameworkScores { scores: Record<string, number>; average: number }
interface ComplianceResults {
  overall_score: number;
  grade: string;
  passed: number;
  failed: number;
  total_controls: number;
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
    gdpr_article: string;
    itu_pillar: string;
    remediation: string;
  }>;
}

interface ScanRecord {
  scan_id: string;
  organization_name: string;
  target_url: string;
  compliance_status: string;
  compliance_phase: string;
  compliance_results: ComplianceResults | null;
  created_at: string;
}

/* ── Sub-components ── */

const OverallScoreCard: React.FC<{ r: ComplianceResults }> = ({ r }) => (
  <Card className="glass-card border-border">
    <CardContent className="flex flex-col items-center py-8 gap-3">
      <span className={cn('text-6xl font-bold font-mono', scoreColor(r.overall_score))}>{r.overall_score}</span>
      <span className={cn('text-2xl font-bold font-mono px-3 py-1 rounded border', gradeColor(r.grade))}>{r.grade}</span>
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1 text-neon-green"><CheckCircle2 className="w-4 h-4" />{r.passed} passed</span>
        <span className="flex items-center gap-1 text-neon-red"><XCircle className="w-4 h-4" />{r.failed} failed</span>
      </div>
      <div className="w-full max-w-md">
        <div className="text-xs text-muted-foreground text-center mb-1">{r.passed} of {r.total_controls} controls passed</div>
        <Progress value={(r.passed / Math.max(r.total_controls, 1)) * 100} className={cn('h-2', scoreBg(r.overall_score))} />
      </div>
    </CardContent>
  </Card>
);

const FrameworkBarCard: React.FC<{ title: string; scores: Record<string, number>; average: number }> = ({ title, scores, average }) => {
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
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.value >= 75 ? 'hsl(var(--neon-green))' : d.value >= 50 ? 'hsl(var(--neon-amber))' : 'hsl(var(--neon-red))'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

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
          <TableCell colSpan={7} className="bg-muted/10 border-l-2 border-neon-cyan/40">
            <div className="py-2 px-3 space-y-1">
              <p className="text-xs text-foreground">{f.detail}</p>
              <p className="text-xs text-neon-amber font-mono">⚡ {f.remediation}</p>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>NIST: {f.nist_name}</span>
                <span>ITU: {f.itu_pillar}</span>
              </div>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
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

  /* Fetch history on mount */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(proxyUrl('/compliance/scans'), { headers: apiHeaders() });
        if (res.ok) {
          const data = await res.json();
          setHistory(Array.isArray(data) ? data : data.scans || []);
        }
      } catch { /* ignore */ }
      setLoadingHistory(false);
    })();
  }, [results]);

  /* Poll scan */
  const pollScan = useCallback((scanId: string) => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch(proxyUrl(`/compliance/scan/${scanId}`), { headers: apiHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        setPhase(data.compliance_phase || '');
        if (data.compliance_status === 'done') {
          clearInterval(iv);
          setResults(data.compliance_results);
          setScanning(false);
          setPhase('');
        }
      } catch { /* retry next tick */ }
    }, 5000);
    return iv;
  }, []);

  const startScan = async () => {
    if (!orgName.trim() || !targetUrl.trim()) return;
    setScanning(true);
    setResults(null);
    setPhase('Initiating scan…');
    try {
      const res = await fetch(proxyUrl('/compliance/scan'), {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ target_url: targetUrl.trim(), organization_name: orgName.trim() }),
      });
      const data = await res.json();
      if (data.scan_id) {
        const iv = pollScan(data.scan_id);
        return () => clearInterval(iv);
      } else {
        setScanning(false);
        setPhase('Error starting scan');
      }
    } catch {
      setScanning(false);
      setPhase('Network error');
    }
  };

  const sortedFindings = results?.compliance_findings
    ?.slice()
    .sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9)) || [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-neon-cyan" />
        <h1 className="text-xl font-bold font-mono text-foreground">Compliance Scanner</h1>
      </div>

      {/* Scan form */}
      <Card className="glass-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="Organization name" value={orgName} onChange={e => setOrgName(e.target.value)} className="flex-1" />
            <Input placeholder="https://example.com" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} className="flex-1" />
            <Button onClick={startScan} disabled={scanning || !orgName.trim() || !targetUrl.trim()} className="gap-2">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              {scanning ? 'Scanning…' : 'Run Compliance Scan'}
            </Button>
          </div>
          {scanning && phase && (
            <div className="flex items-center gap-2 mt-3 text-sm text-neon-cyan font-mono animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              {phase}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <>
          <OverallScoreCard r={results} />

          {/* Framework cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FrameworkBarCard title="NIST CSF 2.0" scores={results.frameworks.nist_csf.scores} average={results.frameworks.nist_csf.average} />
            <FrameworkBarCard title="ISO 27001" scores={results.frameworks.iso_27001.scores} average={results.frameworks.iso_27001.average} />
            <FrameworkBarCard title="GDPR" scores={results.frameworks.gdpr.scores} average={results.frameworks.gdpr.average} />
            <FrameworkBarCard title="ITU NCI" scores={results.frameworks.itu_nci.scores} average={results.frameworks.itu_nci.average} />
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
        </>
      )}

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
                    <TableRow key={h.scan_id}>
                      <TableCell className="font-mono text-xs">{h.organization_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{h.target_url}</TableCell>
                      <TableCell>
                        {h.compliance_results ? (
                          <span className={cn('font-bold font-mono', scoreColor(h.compliance_results.overall_score))}>
                            {h.compliance_results.overall_score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">{h.compliance_status}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {h.compliance_results?.grade && (
                          <span className={cn('text-xs font-bold font-mono px-1.5 py-0.5 rounded border', gradeColor(h.compliance_results.grade))}>
                            {h.compliance_results.grade}
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
