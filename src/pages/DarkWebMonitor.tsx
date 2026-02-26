import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, Search, Shield, AlertTriangle, Activity, Clock, Loader2, Send, RefreshCw, Globe, Database, Key, FileText, Skull, Download, Mail, Lock, ShieldAlert, ServerCrash, Unlock, ChevronDown, Bug, X, User, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { startDarkWebScan, getDarkWebScan, listDarkWebScans, pollDarkWebScan } from '@/services/darkwebApi';
import type { DarkWebScan, DarkWebScanListItem, DarkWebFinding } from '@/types/darkweb';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const severityColor = (s: string) => {
  switch (s) {
    case 'critical': return 'text-red-400 border-red-400/30 bg-red-400/10';
    case 'high': return 'text-orange-400 border-orange-400/30 bg-orange-400/10';
    case 'medium': return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
    default: return 'text-muted-foreground border-border bg-muted';
  }
};

const sourceConfig = [
  { key: 'ransomware', label: 'Ransomware', icon: Skull },
  { key: 'hibp', label: 'Credential Leaks', icon: Key },
  { key: 'pastes', label: 'Paste Sites', icon: FileText },
  { key: 'ahmia', label: 'Dark Web', icon: Globe },
  { key: 'intelx', label: 'Intel Database', icon: Database },
  { key: 'github', label: 'GitHub', icon: Search },
  { key: 'pwned_passwords', label: 'Pwned Passwords', icon: Lock },
  { key: 'breach_directory', label: 'Breach Directory', icon: ShieldAlert },
  { key: 'scylla', label: 'Scylla DB', icon: ServerCrash },
  { key: 'leakcheck', label: 'LeakCheck', icon: Unlock },
] as const;

// Fields to mask in findings display
const MASKED_FIELDS = new Set(['password', 'hash', 'password_hash']);

const FindingsTable: React.FC<{ findings: DarkWebFinding[]; sourceKey: string }> = ({ findings, sourceKey }) => {
  if (!findings || findings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground font-mono text-sm">
        No findings in this category.
      </div>
    );
  }

  const keys = Array.from(new Set(findings.flatMap(f => Object.keys(f)))).slice(0, 6);

  return (
    <div className="overflow-auto max-h-[400px]">
      <Table>
        <TableHeader>
          <TableRow className="border-border">
            {keys.map(k => (
              <TableHead key={k} className="font-mono text-xs uppercase text-muted-foreground whitespace-nowrap">{k.replace(/_/g, ' ')}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {findings.map((f, i) => (
            <TableRow key={i} className="border-border hover:bg-muted/30">
              {keys.map(k => (
                <TableCell key={k} className="font-mono text-xs max-w-[300px] truncate">
                  {MASKED_FIELDS.has(k) ? '••••••••' : typeof f[k] === 'object' ? JSON.stringify(f[k]) : String(f[k] ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

/* ── Chip Input ────────────────────────────────────── */
const ChipInput: React.FC<{
  label: string;
  placeholder: string;
  chips: string[];
  onChange: (chips: string[]) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}> = ({ label, placeholder, chips, onChange, disabled, icon }) => {
  const [input, setInput] = useState('');

  const addChip = (raw: string) => {
    const v = raw.trim();
    if (v && !chips.includes(v)) onChange([...chips, v]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(input);
      setInput('');
    } else if (e.key === 'Backspace' && !input && chips.length) {
      onChange(chips.slice(0, -1));
    }
  };

  return (
    <div>
      <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </Label>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 mb-1">
          {chips.map(c => (
            <Badge key={c} variant="secondary" className="font-mono text-[10px] gap-1 pr-1">
              {c}
              <button type="button" onClick={() => onChange(chips.filter(x => x !== c))} className="hover:text-destructive">
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        placeholder={placeholder}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) { addChip(input); setInput(''); } }}
        className="font-mono text-sm mt-1"
        disabled={disabled}
      />
    </div>
  );
};

/* ── LeakCheck Pro v2 Section ─────────────────────── */
interface LeakCheckFinding {
  type?: string;
  email?: string;
  username?: string;
  has_password?: boolean;
  breach_name?: string;
  breach_date?: string;
  fields?: string[];
  severity?: string;
  message?: string;
  [key: string]: unknown;
}

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };

const sortBySeverity = (a: LeakCheckFinding, b: LeakCheckFinding) =>
  (SEVERITY_ORDER[a.severity?.toUpperCase() ?? 'MEDIUM'] ?? 3) - (SEVERITY_ORDER[b.severity?.toUpperCase() ?? 'MEDIUM'] ?? 3);

const leakSeverityBorder = (s?: string) => {
  switch (s?.toUpperCase()) {
    case 'CRITICAL': return 'border-l-red-500';
    case 'HIGH': return 'border-l-orange-500';
    default: return 'border-l-yellow-500';
  }
};

const leakSeverityBadge = (s?: string) => {
  switch (s?.toUpperCase()) {
    case 'CRITICAL': return 'text-red-400 border-red-400/30 bg-red-400/10';
    case 'HIGH': return 'text-orange-400 border-orange-400/30 bg-orange-400/10';
    default: return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
  }
};

const LeakCheckFindingCard: React.FC<{ f: LeakCheckFinding }> = ({ f }) => (
  <div className={`border border-border rounded-lg p-3 space-y-2 border-l-4 ${leakSeverityBorder(f.severity)} bg-card`}>
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="outline" className={`font-mono text-[10px] ${leakSeverityBadge(f.severity)}`}>
        {f.severity?.toUpperCase() ?? 'MEDIUM'}
      </Badge>
      {f.breach_name && <span className="font-mono text-sm font-bold text-foreground">{f.breach_name}</span>}
      {f.breach_date && <span className="font-mono text-xs text-muted-foreground">{f.breach_date}</span>}
    </div>
    <div className="flex gap-4 text-xs font-mono text-muted-foreground flex-wrap">
      {f.email && <span>email: <span className="text-foreground">{f.email}</span></span>}
      {f.username && <span>username: <span className="text-foreground">{f.username}</span></span>}
    </div>
    {f.has_password && (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono text-[10px]">
        🔑 Password Exposed
      </Badge>
    )}
    {f.fields && f.fields.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {f.fields.map((field, i) => (
          <span key={i} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">{field}</span>
        ))}
      </div>
    )}
    {f.message && <p className="text-xs text-muted-foreground font-mono">{f.message}</p>}
  </div>
);

const LeakCheckGroup: React.FC<{ title: string; findings: LeakCheckFinding[] }> = ({ title, findings }) => {
  if (findings.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{title} ({findings.length})</h4>
      {findings.sort(sortBySeverity).map((f, i) => <LeakCheckFindingCard key={i} f={f} />)}
    </div>
  );
};

const LeakCheckSection: React.FC<{ findings: LeakCheckFinding[]; quotaRemaining?: number }> = ({ findings, quotaRemaining }) => {
  const [open, setOpen] = useState(true);
  const count = findings.length;
  const domainBreaches = findings.filter(f => f.type === 'domain_breach');
  const emailBreaches = findings.filter(f => f.type === 'email_breach');
  const keywordMentions = findings.filter(f => f.type === 'keyword_mention');

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border bg-card">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Unlock className="w-4 h-4 text-yellow-400" />
                🔍 LeakCheck Pro Intelligence
              </CardTitle>
              <div className="flex items-center gap-2">
                {count > 0 ? (
                  <Badge variant="outline" className="text-red-400 border-red-400/30 bg-red-400/10 font-mono text-[10px]">
                    {count} found
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10 font-mono text-[10px]">
                    clean
                  </Badge>
                )}
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {count === 0 ? (
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm py-6 justify-center">
                <Check className="w-4 h-4" />
                No credential leaks detected
              </div>
            ) : (
              <>
                <LeakCheckGroup title="Domain Breaches" findings={domainBreaches} />
                <LeakCheckGroup title="Email Breaches" findings={emailBreaches} />
                <LeakCheckGroup title="Keyword Mentions" findings={keywordMentions} />
              </>
            )}
            {quotaRemaining !== undefined && (
              <p className="text-[10px] font-mono text-muted-foreground text-right">API quota remaining: {quotaRemaining} queries</p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

/* ── Cavalier Infostealer Section ─────────────────── */
interface CavalierFinding {
  type?: string;
  stealer?: string;
  computer_name?: string;
  os?: string;
  date_uploaded?: string;
  email?: string;
  username?: string;
  domain?: string;
  credentials?: { url?: string; password?: string }[];
  severity?: string;
  message?: string;
  [key: string]: unknown;
}

const CavalierSection: React.FC<{ findings: CavalierFinding[] }> = ({ findings }) => {
  const [open, setOpen] = useState(true);
  const count = findings.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border bg-card">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Bug className="w-4 h-4 text-red-400" />
                🦠 Infostealer Intelligence (Hudson Rock)
              </CardTitle>
              <div className="flex items-center gap-2">
                {count > 0 ? (
                  <Badge variant="outline" className="text-red-400 border-red-400/30 bg-red-400/10 font-mono text-[10px]">
                    {count} found
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10 font-mono text-[10px]">
                    clean
                  </Badge>
                )}
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {count === 0 ? (
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm py-6 justify-center">
                <Check className="w-4 h-4" />
                No infostealer infections detected
              </div>
            ) : (
              findings.map((f, i) => {
                const isCritical = f.severity?.toUpperCase() === 'CRITICAL';
                const borderClass = isCritical ? 'border-l-red-500' : 'border-l-orange-500';
                return (
                  <div key={i} className={`border border-border rounded-lg p-3 space-y-2 border-l-4 ${borderClass} bg-card`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {f.stealer && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono text-[10px]">
                            {f.stealer} Stealer
                          </Badge>
                        )}
                        <Badge variant="outline" className={isCritical ? 'text-red-400 border-red-400/30' : 'text-orange-400 border-orange-400/30'}>
                          {f.severity?.toUpperCase() ?? 'HIGH'}
                        </Badge>
                      </div>
                      {f.type && <span className="font-mono text-[10px] text-muted-foreground">{f.type}</span>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-xs font-mono text-muted-foreground">
                      {f.computer_name && <span>Machine: <span className="text-foreground">{f.computer_name}</span></span>}
                      {f.os && <span>OS: <span className="text-foreground">{f.os}</span></span>}
                      {f.date_uploaded && <span>Uploaded: <span className="text-foreground">{f.date_uploaded}</span></span>}
                    </div>

                    {f.message && <p className="text-xs text-muted-foreground font-mono">{f.message}</p>}

                    {f.credentials && f.credentials.length > 0 && (
                      <div className="mt-1 space-y-1">
                        <span className="text-[10px] font-mono uppercase text-muted-foreground">Credentials</span>
                        {f.credentials.map((cred, ci) => (
                          <div key={ci} className="flex items-center gap-2 text-xs font-mono bg-muted/30 rounded px-2 py-1">
                            <span className="truncate text-foreground">{cred.url ?? '—'}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-muted-foreground">••••••••</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

const DarkWebMonitor: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [emails, setEmails] = useState('');
  const [keywords, setKeywords] = useState('');
  const [usernames, setUsernames] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [currentScan, setCurrentScan] = useState<DarkWebScan | null>(null);
  const [scanHistory, setScanHistory] = useState<DarkWebScanListItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [exporting, setExporting] = useState(false);
  const stopPollRef = useRef<(() => void) | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const scans = await listDarkWebScans();
      setScanHistory(scans);
    } catch (err) {
      console.error('[DarkWeb] Failed to load history', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    return () => { stopPollRef.current?.(); };
  }, [fetchHistory]);

  const handleStartScan = async () => {
    if (!domain.trim()) { toast.error('Domain is required'); return; }
    setScanning(true);
    try {
      const emailList = emails.split(',').map(e => e.trim()).filter(Boolean);
      const kwList = keywords.split(',').map(k => k.trim()).filter(Boolean);
      const { scan_id } = await startDarkWebScan(domain.trim(), emailList, kwList, usernames);
      toast.success(`Scan started: ${scan_id.slice(0, 8)}…`);

      stopPollRef.current?.();
      stopPollRef.current = pollDarkWebScan(scan_id, (scan) => {
        setCurrentScan(scan);
        if (scan.darkweb_status === 'done' || scan.darkweb_status === 'error') {
          setScanning(false);
          fetchHistory();
          if (scan.darkweb_status === 'done') toast.success('Dark web scan complete');
          if (scan.darkweb_status === 'error') toast.error('Scan failed');
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start scan';
      toast.error(msg);
      setScanning(false);
    }
  };

  const handleViewScan = async (scanId: string) => {
    try {
      const scan = await getDarkWebScan(scanId);
      setCurrentScan(scan);
      if (scan.darkweb_status === 'queued' || scan.darkweb_status === 'running') {
        setScanning(true);
        stopPollRef.current?.();
        stopPollRef.current = pollDarkWebScan(scanId, (s) => {
          setCurrentScan(s);
          if (s.darkweb_status === 'done' || s.darkweb_status === 'error') {
            setScanning(false);
            fetchHistory();
          }
        });
      }
    } catch (err) {
      toast.error('Failed to load scan');
    }
  };

  const handleExport = async (downloadOnly: boolean) => {
    if (!currentScan) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-darkweb-report', {
        body: { scan: currentScan },
      });

      if (error) throw error;
      if (!data?.success && data?.error) throw new Error(data.error);

      if (data?.pdf) {
        const byteChars = atob(data.pdf);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteArray[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dom = currentScan.domain || currentScan.target || 'scan';
        a.download = `DarkWeb-Report-${dom}-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast.success(downloadOnly ? 'PDF downloaded' : 'Report sent and downloaded');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  const summary = currentScan?.darkweb_summary;
  const isDone = currentScan?.darkweb_status === 'done';

  // Cavalier findings
  const cavalierFindings = ((currentScan?.darkweb_results as unknown as Record<string, { findings?: CavalierFinding[] }>)?.cavalier?.findings ?? []) as CavalierFinding[];
  const cavalierCount = cavalierFindings.length;

  // LeakCheck findings
  const leakcheckSource = (currentScan?.darkweb_results as unknown as Record<string, { findings?: LeakCheckFinding[]; quota_remaining?: number }>)?.leakcheck;
  const leakcheckFindings = (leakcheckSource?.findings ?? []) as LeakCheckFinding[];
  const leakcheckQuota = leakcheckSource?.quota_remaining;
  const leakcheckCount = leakcheckFindings.length;

  // Augmented totals (cavalier + leakcheck)
  const augmentedTotal = (summary?.total_findings ?? 0) + cavalierCount + leakcheckCount;
  const augmentedCritical = (summary?.critical ?? 0)
    + cavalierFindings.filter(f => f.severity?.toUpperCase() === 'CRITICAL').length
    + leakcheckFindings.filter(f => f.severity?.toUpperCase() === 'CRITICAL').length;
  const augmentedHigh = (summary?.high ?? 0)
    + cavalierFindings.filter(f => f.severity?.toUpperCase() === 'HIGH').length
    + leakcheckFindings.filter(f => f.severity?.toUpperCase() === 'HIGH').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Eye className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono tracking-tight">Dark Web Monitor</h1>
            <p className="text-sm text-muted-foreground">Scan for exposed data across the dark web, breaches, and code repositories</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDone && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport(true)}
                disabled={exporting}
                className="font-mono text-xs"
              >
                {exporting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport(false)}
                disabled={exporting}
                className="font-mono text-xs"
              >
                {exporting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
                Email
              </Button>
            </>
          )}
          <Badge variant="outline" className={scanning ? 'text-yellow-400 border-yellow-400/30 animate-pulse' : 'text-emerald-400 border-emerald-400/30'}>
            {scanning ? 'SCANNING' : 'READY'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form + History */}
        <div className="space-y-4">
          {/* Scan Form */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Search className="w-4 h-4" />
                New Scan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Domain</Label>
                <Input placeholder="example.com" value={domain} onChange={e => setDomain(e.target.value)} className="font-mono text-sm mt-1" disabled={scanning} />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Emails (comma-separated)</Label>
                <Input placeholder="admin@example.com, info@example.com" value={emails} onChange={e => setEmails(e.target.value)} className="font-mono text-sm mt-1" disabled={scanning} />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Keywords (comma-separated)</Label>
                <Input placeholder="company name, brand" value={keywords} onChange={e => setKeywords(e.target.value)} className="font-mono text-sm mt-1" disabled={scanning} />
              </div>
              <ChipInput
                label="Usernames to check"
                placeholder="Type a username and press Enter"
                chips={usernames}
                onChange={setUsernames}
                disabled={scanning}
                icon={<User className="w-3 h-3" />}
              />
              <Button onClick={handleStartScan} disabled={scanning || !domain.trim()} className="w-full font-mono">
                {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {scanning ? 'Scanning…' : 'Start Scan'}
              </Button>
            </CardContent>
          </Card>

          {/* Scan History */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Scan History
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={fetchHistory} className="h-7 w-7">
                  <RefreshCw className={`w-3 h-3 ${loadingHistory ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {scanHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground font-mono text-center py-4">No scans yet</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-auto">
                  {scanHistory.map(s => (
                    <button
                      key={s.scan_id}
                      onClick={() => handleViewScan(s.scan_id)}
                      className="w-full text-left p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-medium truncate">{s.domain}</span>
                        <Badge variant="outline" className={`text-[10px] ${s.darkweb_status === 'done' ? 'text-emerald-400 border-emerald-400/30' : s.darkweb_status === 'running' ? 'text-yellow-400 border-yellow-400/30' : 'text-muted-foreground'}`}>
                          {s.darkweb_status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {s.created_at ? format(new Date(s.created_at), 'MMM d, HH:mm') : '—'}
                        </span>
                        {s.darkweb_summary && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {s.darkweb_summary.total_findings} findings
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-2 space-y-4">
          {scanning && currentScan && (
            <Card className="border-yellow-400/20 bg-yellow-400/5">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                <span className="font-mono text-sm text-yellow-400">{currentScan.darkweb_phase || 'Initializing…'}</span>
              </CardContent>
            </Card>
          )}

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total', value: augmentedTotal, icon: Activity, color: 'text-foreground' },
                { label: 'Critical', value: augmentedCritical, icon: AlertTriangle, color: 'text-red-400' },
                { label: 'High', value: augmentedHigh, icon: Shield, color: 'text-orange-400' },
                { label: 'Medium', value: summary.medium, icon: Shield, color: 'text-yellow-400' },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="border-border bg-card">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">{label}</span>
                    </div>
                    <span className={`text-2xl font-bold font-mono ${color}`}>{value ?? 0}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {currentScan?.darkweb_results ? (
            <>
              <Card className="border-border bg-card">
                <Tabs defaultValue="ransomware">
                  <CardHeader className="pb-0">
                    <TabsList className="bg-muted/50 w-full flex-wrap h-auto gap-1 p-1">
                      {sourceConfig.map(({ key, label, icon: Icon }) => {
                        const count = (currentScan.darkweb_results as unknown as Record<string, { findings?: unknown[] }>)?.[key]?.findings?.length ?? 0;
                        return (
                          <TabsTrigger key={key} value={key} className="font-mono text-xs gap-1.5 data-[state=active]:bg-background">
                            <Icon className="w-3 h-3" />
                            {label}
                            {count > 0 && (
                              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px]">{count}</span>
                            )}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {sourceConfig.map(({ key }) => (
                      <TabsContent key={key} value={key} className="mt-0">
                        {key === 'leakcheck' ? (
                          <LeakCheckSection findings={leakcheckFindings} quotaRemaining={leakcheckQuota} />
                        ) : (
                          <FindingsTable
                            sourceKey={key}
                            findings={(currentScan.darkweb_results as unknown as Record<string, { findings?: DarkWebFinding[] }>)?.[key]?.findings ?? []}
                          />
                        )}
                      </TabsContent>
                    ))}
                  </CardContent>
                </Tabs>
              </Card>

              {/* Cavalier Infostealer Section */}
              <CavalierSection findings={cavalierFindings} />
            </>
          ) : !scanning && !currentScan ? (
            <Card className="border-border bg-card">
              <CardContent className="py-16 text-center">
                <Eye className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="font-mono text-sm text-muted-foreground">Start a scan or select a past scan to view results</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DarkWebMonitor;
