import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CircularGauge from '@/components/dashboard/CircularGauge';
import { Search, Play, Download, ChevronDown, ChevronRight, XCircle, CheckCircle, Info, Shield, Clock, Calendar, FileDown, Loader2, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const downloadPdfFromBase64 = (base64: string, filename: string) => {
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

interface Finding {
  id: string;
  test: string;
  severity: string;
  status: string;
  detail: string;
  recommendation?: string;
  evidence?: any;
}

interface TestResult {
  testName: string;
  functionName: string;
  success: boolean;
  findings: Finding[];
  error: string | null;
  checkedAt: string;
}

interface ScanResult {
  id: string;
  organization_id: string;
  organization_name: string;
  url: string;
  results: TestResult[];
  summary: any;
  dast_score: number;
  scanned_at: string;
}

interface Org {
  id: string;
  name: string;
  domain: string;
}

const TESTS = [
  { name: 'Information Disclosure', fn: 'dast-info-disclosure', icon: '🔍', desc: 'Exposed files, version leaks, sensitive paths' },
  { name: 'HTTP Methods', fn: 'dast-http-methods', icon: '📡', desc: 'Dangerous methods (PUT, DELETE, TRACE)' },
  { name: 'Cookie Security', fn: 'dast-cookie-security', icon: '🍪', desc: 'Missing Secure, HttpOnly, SameSite flags' },
  { name: 'CORS Configuration', fn: 'dast-cors-check', icon: '🔗', desc: 'Cross-origin access misconfiguration' },
  { name: 'Redirect Security', fn: 'dast-redirect-check', icon: '↪️', desc: 'Open redirects, HTTPS enforcement' },
  { name: 'Error Handling', fn: 'dast-error-handling', icon: '⚠️', desc: 'Verbose errors, exposed admin panels' },
  { name: 'TLS/SSL Deep Scan', fn: 'dast-tls-deep-scan', icon: '🔐', desc: 'HSTS, mixed content, CAA records, cert transparency' },
  { name: 'Subdomain Discovery', fn: 'dast-subdomain-discovery', icon: '🌐', desc: 'CT log enumeration, live subdomain checks' },
  { name: 'CMS Vulnerabilities', fn: 'dast-cms-vulns', icon: '🏗️', desc: 'WordPress, Joomla, Drupal specific checks' },
  { name: 'JS Library Audit', fn: 'dast-js-libraries', icon: '📦', desc: 'Outdated libraries with known CVEs, SRI checks' },
  { name: 'API Discovery', fn: 'dast-api-discovery', icon: '🔌', desc: 'Exposed Swagger, GraphQL, debug endpoints' },
  { name: 'DNS Security', fn: 'dast-dns-security', icon: '🧭', desc: 'DNSSEC, SPF, DMARC, DNS provider analysis' },
  { name: 'Content Security', fn: 'dast-content-security', icon: '🛡️', desc: 'CSP analysis, clickjacking, MIME sniffing' },
  { name: 'WAF Detection', fn: 'dast-waf-detection', icon: '🧱', desc: 'WAF fingerprinting, rate limiting, server info' },
];

const severityColor: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  info: 'bg-muted text-muted-foreground border-border',
};

const statusIcon = (status: string) => {
  if (status === 'fail') return <XCircle className="w-4 h-4 text-red-400" />;
  if (status === 'pass') return <CheckCircle className="w-4 h-4 text-green-400" />;
  return <Info className="w-4 h-4 text-muted-foreground" />;
};

const getGrade = (score: number) => {
  if (score >= 90) return { grade: 'A', label: 'Excellent', color: 'text-green-400' };
  if (score >= 75) return { grade: 'B', label: 'Good', color: 'text-emerald-400' };
  if (score >= 60) return { grade: 'C', label: 'Fair', color: 'text-yellow-400' };
  if (score >= 40) return { grade: 'D', label: 'Needs Work', color: 'text-orange-400' };
  return { grade: 'F', label: 'Critical', color: 'text-red-400' };
};

const DastScanner: React.FC = () => {
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [scanning, setScanning] = useState(false);
  const [scanningOrgId, setScanningOrgId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, testName: '', orgName: '' });
  const [cachedResults, setCachedResults] = useState<ScanResult[]>([]);
  const [currentResults, setCurrentResults] = useState<TestResult[]>([]);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [emailingPdf, setEmailingPdf] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('osmando@gmail.com');

  useEffect(() => {
    loadOrgs();
    loadCachedResults();
  }, []);

  const loadOrgs = async () => {
    const { data } = await supabase.from('organizations').select('id, name, domain');
    if (data) setOrgs(data);
  };

  const loadCachedResults = async () => {
    const { data } = await supabase.from('dast_scan_results').select('*') as { data: ScanResult[] | null };
    if (data) setCachedResults(data);
  };

  const runScan = useCallback(async (orgList: Org[]) => {
    setScanning(true);
    setCurrentResults([]);
    setCurrentScore(null);

    // Collect scan data locally for email sending (avoids stale closure on cachedResults)
    const completedScans: { org: Org; url: string; dastScore: number; summary: any; results: TestResult[] }[] = [];

    for (const org of orgList) {
      setScanningOrgId(org.id);
      const url = org.domain.startsWith('http') ? org.domain : `https://${org.domain}`;
      const allResults: TestResult[] = [];

      for (let i = 0; i < TESTS.length; i++) {
        const test = TESTS[i];
        setProgress({ current: i + 1, total: TESTS.length, testName: test.name, orgName: org.name });

        try {
          const { data, error } = await supabase.functions.invoke(test.fn, { body: { url } });
          allResults.push({
            testName: test.name, functionName: test.fn, success: data?.success || false,
            findings: data?.findings || [], error: error?.message || data?.error || null,
            checkedAt: data?.checkedAt || new Date().toISOString(),
          });
        } catch (err: any) {
          allResults.push({
            testName: test.name, functionName: test.fn, success: false,
            findings: [], error: err.message, checkedAt: new Date().toISOString(),
          });
        }

        setCurrentResults([...allResults]);
        if (i < TESTS.length - 1) await new Promise(r => setTimeout(r, 2000));
      }

      const allFindings = allResults.flatMap(r => r.findings);
      const summary = {
        totalFindings: allFindings.length,
        critical: allFindings.filter(f => f.severity === 'critical' && f.status === 'fail').length,
        high: allFindings.filter(f => f.severity === 'high' && f.status === 'fail').length,
        medium: allFindings.filter(f => f.severity === 'medium' && f.status === 'fail').length,
        low: allFindings.filter(f => f.severity === 'low' && f.status === 'fail').length,
        passed: allFindings.filter(f => f.status === 'pass').length,
      };

      const dastScore = Math.max(0, 100 - (summary.critical * 15 + summary.high * 8 + summary.medium * 3 + summary.low * 1));
      setCurrentScore(dastScore);

      await supabase.from('dast_scan_results').upsert({
        organization_id: org.id, organization_name: org.name, url,
        results: allResults as any, summary, dast_score: dastScore,
        scanned_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' });

      completedScans.push({ org, url, dastScore, summary, results: allResults });
    }

    await loadCachedResults();
    setScanning(false);
    setScanningOrgId(null);
    toast({ title: 'DAST Scan Complete', description: `Scanned ${orgList.length} organization(s)` });

    // Send email reports using locally collected data (not stale state)
    for (const scan of completedScans) {
      try {
        const { data: reportData } = await supabase.functions.invoke('send-dast-report', {
          body: {
            organizationName: scan.org.name,
            url: scan.url,
            dastScore: scan.dastScore,
            summary: scan.summary,
            results: scan.results,
            to: recipientEmail,
          },
        });
        toast({ title: 'Report Sent', description: `PDF report emailed for ${scan.org.name}` });
      } catch (emailErr) {
        console.error('Email report failed:', emailErr);
      }
    }
  }, [toast]);

  const handleScan = () => {
    if (selectedOrgId === 'all') {
      runScan(orgs);
    } else {
      const org = orgs.find(o => o.id === selectedOrgId);
      if (org) runScan([org]);
    }
  };

  const handleScanSingleOrg = (e: React.MouseEvent, org: Org) => {
    e.stopPropagation();
    if (scanning) return;
    setSelectedOrgId(org.id);
    runScan([org]);
  };

  const handleDownloadPdf = async (scan: ScanResult) => {
    setDownloadingPdf(scan.organization_id);
    try {
      const { data } = await supabase.functions.invoke('send-dast-report', {
        body: {
          organizationName: scan.organization_name,
          url: scan.url,
          dastScore: scan.dast_score,
          summary: scan.summary,
          results: scan.results,
        },
      });
      if (data?.pdf) {
        downloadPdfFromBase64(data.pdf, `DAST-Report-${scan.organization_name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date(scan.scanned_at).toISOString().slice(0, 10)}.pdf`);
        toast({ title: 'PDF Downloaded', description: `Report for ${scan.organization_name}` });
      }
    } catch (err) {
      console.error('PDF download failed:', err);
      toast({ title: 'PDF Failed', description: 'Could not generate PDF report', variant: 'destructive' });
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleEmailPdf = async (scan: ScanResult) => {
    setEmailingPdf(scan.organization_id);
    try {
      await supabase.functions.invoke('send-dast-report', {
        body: {
          organizationName: scan.organization_name,
          url: scan.url,
          dastScore: scan.dast_score,
          summary: scan.summary,
          results: scan.results,
          to: recipientEmail,
        },
      });
      toast({ title: 'Report Emailed', description: `PDF report sent to ${recipientEmail}` });
    } catch (err) {
      console.error('Email report failed:', err);
      toast({ title: 'Email Failed', description: 'Could not send PDF report', variant: 'destructive' });
    } finally {
      setEmailingPdf(null);
    }
  };

  const toggleTest = (name: string) => {
    setExpandedTests(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const displayResults = selectedOrgId !== 'all'
    ? cachedResults.find(r => r.organization_id === selectedOrgId)
    : null;

  const summaryData = (() => {
    const results = displayResults ? [displayResults] : cachedResults;
    return {
      totalScans: results.length,
      critical: results.reduce((s, r) => s + (r.summary?.critical || 0), 0),
      high: results.reduce((s, r) => s + (r.summary?.high || 0), 0),
      medium: results.reduce((s, r) => s + (r.summary?.medium || 0), 0),
      low: results.reduce((s, r) => s + (r.summary?.low || 0), 0),
      lastScan: results.length > 0 ? results.sort((a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime())[0]?.scanned_at : null,
    };
  })();

  const activeResults = scanning ? currentResults : (displayResults?.results as TestResult[] || []);
  const activeScore = scanning ? currentScore : displayResults?.dast_score;

  const exportReport = () => {
    const target = displayResults ? [displayResults] : cachedResults;
    if (target.length === 0) return;
    let report = 'DAST Security Scanner Report\n' + '='.repeat(50) + '\n\n';
    for (const scan of target) {
      const grade = getGrade(scan.dast_score);
      report += `Organization: ${scan.organization_name}\nURL: ${scan.url}\nScan Date: ${new Date(scan.scanned_at).toLocaleString()}\n`;
      report += `DAST Score: ${scan.dast_score}/100 (${grade.grade} — ${grade.label})\n`;
      report += `Summary: ${scan.summary?.critical || 0} Critical, ${scan.summary?.high || 0} High, ${scan.summary?.medium || 0} Medium, ${scan.summary?.low || 0} Low\n\n`;
      for (const test of (scan.results as TestResult[])) {
        report += `--- ${test.testName} ---\n`;
        for (const f of test.findings) {
          if (f.status === 'fail') {
            report += `  [${f.severity.toUpperCase()}] ${f.test}: ${f.detail}\n`;
            if (f.recommendation) report += `    Fix: ${f.recommendation}\n`;
          }
        }
        report += '\n';
      }
      report += '\n';
    }
    const blob = new Blob([report], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dast-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
  };

  const getTestStatus = (findings: Finding[]) => {
    const fails = findings.filter(f => f.status === 'fail');
    if (fails.some(f => f.severity === 'critical')) return 'critical';
    if (fails.some(f => f.severity === 'high')) return 'high';
    if (fails.some(f => f.severity === 'medium')) return 'warning';
    return 'clean';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
            <Search className="w-6 h-6 text-neon-cyan" /> DAST Security Scanner
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Lightweight Dynamic Application Security Testing — Passive Vulnerability Discovery.
            This scanner does <strong>not</strong> send malicious payloads or attempt to exploit vulnerabilities.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger className="w-[220px] bg-card border-border">
              <SelectValue placeholder="Select Organization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleScan} disabled={scanning} className="bg-neon-green/20 text-neon-green border border-neon-green/30 hover:bg-neon-green/30">
            <Play className="w-4 h-4 mr-1" /> {scanning ? 'Scanning...' : selectedOrgId === 'all' ? 'Scan All' : 'Scan Selected'}
          </Button>
          <Button variant="outline" onClick={exportReport} disabled={cachedResults.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Export TXT
          </Button>
          <Input
            type="email"
            placeholder="Recipient email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            className="w-[220px] bg-card border-border"
          />
          {displayResults && (
            <>
              <Button
                variant="outline"
                onClick={() => handleDownloadPdf(displayResults)}
                disabled={downloadingPdf === displayResults.organization_id}
              >
                {downloadingPdf === displayResults.organization_id ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating...</>
                ) : (
                  <><FileDown className="w-4 h-4 mr-1" /> Download PDF</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleEmailPdf(displayResults)}
                disabled={emailingPdf === displayResults.organization_id}
              >
                {emailingPdf === displayResults.organization_id ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Sending...</>
                ) : (
                  <><Mail className="w-4 h-4 mr-1" /> Email PDF</>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Schedule Info Banner */}
      <Card className="p-3 border-border bg-muted/30 flex items-center gap-3 flex-wrap">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-mono text-muted-foreground">
          Automated scans run weekly (Sundays 2:00 AM UTC) · {orgs.length} organizations monitored
        </span>
        {summaryData.lastScan && (
          <>
            <span className="text-muted-foreground">·</span>
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-mono text-muted-foreground">
              Last scan: {new Date(summaryData.lastScan).toLocaleString()}
            </span>
          </>
        )}
      </Card>

      {/* Progress */}
      {scanning && (
        <Card className="p-4 border-neon-cyan/20 bg-neon-cyan/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-mono text-neon-cyan">
              Scanning {progress.orgName}... Test {progress.current}/{progress.total}: {progress.testName}
            </span>
            <span className="text-xs text-muted-foreground">{Math.round((progress.current / progress.total) * 100)}%</span>
          </div>
          <Progress value={(progress.current / progress.total) * 100} className="h-2" />
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground font-mono">Total Scans</div>
          <div className="text-2xl font-bold font-mono">{summaryData.totalScans}</div>
        </Card>
        <Card className="p-3 text-center border-red-500/20">
          <div className="text-xs text-red-400 font-mono">Critical</div>
          <div className="text-2xl font-bold font-mono text-red-400">{summaryData.critical}</div>
        </Card>
        <Card className="p-3 text-center border-orange-500/20">
          <div className="text-xs text-orange-400 font-mono">High</div>
          <div className="text-2xl font-bold font-mono text-orange-400">{summaryData.high}</div>
        </Card>
        <Card className="p-3 text-center border-yellow-500/20">
          <div className="text-xs text-yellow-400 font-mono">Medium</div>
          <div className="text-2xl font-bold font-mono text-yellow-400">{summaryData.medium}</div>
        </Card>
        <Card className="p-3 text-center border-blue-500/20">
          <div className="text-xs text-blue-400 font-mono">Low / Info</div>
          <div className="text-2xl font-bold font-mono text-blue-400">{summaryData.low}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground font-mono">Last Scan</div>
          <div className="text-sm font-mono">{summaryData.lastScan ? new Date(summaryData.lastScan).toLocaleDateString() : '—'}</div>
        </Card>
      </div>

      {/* Score + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {activeScore !== null && activeScore !== undefined && (
          <Card className="p-6 flex flex-col items-center justify-center">
            <CircularGauge score={activeScore} size={180} />
            <div className="mt-3 text-center">
              <span className={`text-lg font-bold font-mono ${getGrade(activeScore).color}`}>
                Grade {getGrade(activeScore).grade}
              </span>
              <p className="text-xs text-muted-foreground">{getGrade(activeScore).label}</p>
            </div>
          </Card>
        )}

        <div className={activeScore !== null && activeScore !== undefined ? 'lg:col-span-3' : 'lg:col-span-4'}>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead className="text-center">Findings</TableHead>
                  <TableHead className="text-center">Critical</TableHead>
                  <TableHead className="text-center">High</TableHead>
                  <TableHead className="text-center">Medium</TableHead>
                  <TableHead className="text-center">Low</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TESTS.map(test => {
                  const result = activeResults.find(r => r.testName === test.name);
                  const findings = result?.findings || [];
                  const fails = findings.filter(f => f.status === 'fail');
                  const testStatus = result ? getTestStatus(findings) : 'pending';
                  const isExpanded = expandedTests.has(test.name);

                  return (
                    <React.Fragment key={test.name}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => result && toggleTest(test.name)}
                      >
                        <TableCell>
                          {result ? (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{test.icon}</span>
                            <div>
                              <div className="font-medium text-sm">{test.name}</div>
                              <div className="text-xs text-muted-foreground">{test.desc}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">{findings.length || '—'}</TableCell>
                        <TableCell className="text-center font-mono text-red-400">{fails.filter(f => f.severity === 'critical').length || '—'}</TableCell>
                        <TableCell className="text-center font-mono text-orange-400">{fails.filter(f => f.severity === 'high').length || '—'}</TableCell>
                        <TableCell className="text-center font-mono text-yellow-400">{fails.filter(f => f.severity === 'medium').length || '—'}</TableCell>
                        <TableCell className="text-center font-mono text-blue-400">{fails.filter(f => f.severity === 'low').length || '—'}</TableCell>
                        <TableCell className="text-center">
                          {testStatus === 'critical' && <Badge variant="destructive" className="text-xs">🔴 Critical</Badge>}
                          {testStatus === 'high' && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">🟠 High</Badge>}
                          {testStatus === 'warning' && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">⚠ Issues</Badge>}
                          {testStatus === 'clean' && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">✓ Clean</Badge>}
                          {testStatus === 'pending' && <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>

                      {isExpanded && findings.map((f, fi) => (
                        <TableRow key={`${test.name}-${fi}`} className="bg-muted/10">
                          <TableCell />
                          <TableCell colSpan={7}>
                            <div className="py-2 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {statusIcon(f.status)}
                                <Badge className={`text-xs border ${severityColor[f.severity] || severityColor.info}`}>
                                  {f.severity.toUpperCase()}
                                </Badge>
                                <code className="text-xs text-muted-foreground">{f.id}</code>
                                <span className="text-sm font-medium">{f.test}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{f.detail}</p>
                              {f.recommendation && (
                                <div className="text-sm bg-neon-cyan/5 border border-neon-cyan/10 rounded p-2">
                                  <Shield className="w-3 h-3 inline mr-1 text-neon-cyan" />
                                  <strong className="text-neon-cyan">Fix:</strong> {f.recommendation}
                                </div>
                              )}
                              {f.evidence && (
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Evidence</summary>
                                  <pre className="mt-1 p-2 rounded bg-muted/30 overflow-auto text-xs">{JSON.stringify(f.evidence, null, 2)}</pre>
                                </details>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>

      {/* Cached results per-org list */}
      {!scanning && selectedOrgId === 'all' && cachedResults.length > 0 && (
        <div>
          <h2 className="text-lg font-bold font-mono mb-3">Organization Scores</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cachedResults.map(scan => {
              const grade = getGrade(scan.dast_score);
              const isScanningThis = scanningOrgId === scan.organization_id;
              return (
                <Card key={scan.id} className="p-4 cursor-pointer hover:border-neon-cyan/30 transition-colors"
                  onClick={() => setSelectedOrgId(scan.organization_id)}>
                  <div className="flex items-center gap-3">
                    <CircularGauge score={scan.dast_score} size={80} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{scan.organization_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{scan.url}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm font-bold font-mono ${grade.color}`}>Grade {grade.grade}</span>
                        <span className="text-xs text-muted-foreground">{new Date(scan.scanned_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2 mt-1 text-xs font-mono">
                        {scan.summary?.critical > 0 && <span className="text-red-400">{scan.summary.critical}C</span>}
                        {scan.summary?.high > 0 && <span className="text-orange-400">{scan.summary.high}H</span>}
                        {scan.summary?.medium > 0 && <span className="text-yellow-400">{scan.summary.medium}M</span>}
                        {scan.summary?.low > 0 && <span className="text-blue-400">{scan.summary.low}L</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={scanning}
                        onClick={(e) => {
                          const org = orgs.find(o => o.id === scan.organization_id);
                          if (org) handleScanSingleOrg(e, org);
                        }}
                      >
                        {isScanningThis ? (
                          <span className="text-xs">Scanning...</span>
                        ) : (
                          <><Play className="w-3 h-3 mr-1" /> Scan</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={downloadingPdf === scan.organization_id}
                        onClick={(e) => { e.stopPropagation(); handleDownloadPdf(scan); }}
                      >
                        {downloadingPdf === scan.organization_id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <><FileDown className="w-3 h-3 mr-1" /> PDF</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={emailingPdf === scan.organization_id}
                        onClick={(e) => { e.stopPropagation(); handleEmailPdf(scan); }}
                      >
                        {emailingPdf === scan.organization_id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <><Mail className="w-3 h-3 mr-1" /> Email</>
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DastScanner;
