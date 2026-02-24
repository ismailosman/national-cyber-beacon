import React, { useState } from 'react';
import { ScanResult, NucleiFinding, SemgrepFinding } from "@/types/security";
import StatusBadge from "./StatusBadge";
import ScanReportCharts from "./ScanReportCharts";
import { Loader2, ChevronDown, ChevronRight, CheckCircle, XCircle, Info, Shield, Download, Send, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { sendReportDeliveryEmail } from "@/services/emailService";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  info: "bg-muted text-muted-foreground border-border",
  informational: "bg-muted text-muted-foreground border-border",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  return (
    <Badge className={`text-xs border ${SEVERITY_COLORS[s] || SEVERITY_COLORS.info}`}>
      {severity.toUpperCase()}
    </Badge>
  );
}

const statusIcon = (status: string) => {
  if (status === 'fail') return <XCircle className="w-4 h-4 text-red-400" />;
  if (status === 'pass') return <CheckCircle className="w-4 h-4 text-green-400" />;
  return <Info className="w-4 h-4 text-muted-foreground" />;
};

interface UnifiedFinding {
  tool: string;
  severity: string;
  name: string;
  description: string;
  location: string;
  status: string;
  recommendation?: string;
  evidence?: any;
}

function normalizeFindings(result: ScanResult): { tools: { name: string; icon: string; findings: UnifiedFinding[] }[] } {
  const tools: { name: string; icon: string; findings: UnifiedFinding[] }[] = [];

  // Semgrep (SAST)
  const semgrepFindings = result.sast_results?.semgrep?.findings || [];
  if (semgrepFindings.length > 0 || result.sast_results) {
    tools.push({
      name: 'Semgrep (SAST)',
      icon: '🔍',
      findings: semgrepFindings.map((f: SemgrepFinding) => ({
        tool: 'Semgrep',
        severity: f.extra.severity || 'info',
        name: f.check_id.split('.').slice(-1)[0],
        description: f.extra.message,
        location: `${f.path}:${f.start.line}`,
        status: 'fail',
      })),
    });
  }

  // Nuclei (DAST)
  const nucleiFindings = result.dast_results?.nuclei?.findings || [];
  if (nucleiFindings.length > 0 || result.dast_results?.nuclei) {
    tools.push({
      name: 'Nuclei (DAST)',
      icon: '🔬',
      findings: nucleiFindings.map((f: NucleiFinding) => ({
        tool: 'Nuclei',
        severity: f.info.severity || 'info',
        name: f.info.name,
        description: f.info.description || '',
        location: f.matched_at,
        status: 'fail',
      })),
    });
  }

  // ZAP (DAST)
  const zapAlerts = result.dast_results?.zap?.site?.[0]?.alerts || [];
  if (zapAlerts.length > 0 || result.dast_results?.zap) {
    tools.push({
      name: 'ZAP (DAST)',
      icon: '⚡',
      findings: zapAlerts.map((a: any) => {
        const risk = (a.riskdesc || '').split(' ')[0]?.toLowerCase() || 'info';
        return {
          tool: 'ZAP',
          severity: risk,
          name: a.alert || 'Unknown',
          description: a.desc || '',
          location: a.url || '',
          status: risk === 'informational' ? 'info' : 'fail',
          recommendation: a.solution || undefined,
          evidence: a.reference ? { reference: a.reference } : undefined,
        };
      }),
    });
  }

  // Nikto (DAST)
  if (result.dast_results?.nikto) {
    const niktoData = result.dast_results.nikto;
    const vulns = niktoData.vulnerabilities || [];
    tools.push({
      name: 'Nikto (DAST)',
      icon: '🛡️',
      findings: vulns.length > 0 ? vulns.map((v: any, i: number) => ({
        tool: 'Nikto',
        severity: v.severity || 'medium',
        name: v.id || `Finding ${i + 1}`,
        description: v.msg || v.message || JSON.stringify(v),
        location: v.url || result.target,
        status: 'fail',
      })) : niktoData.raw ? [{
        tool: 'Nikto',
        severity: 'info',
        name: 'Raw Nikto Output',
        description: typeof niktoData.raw === 'string' ? niktoData.raw.slice(0, 500) : JSON.stringify(niktoData.raw).slice(0, 500),
        location: result.target,
        status: 'info',
      }] : [],
    });
  }

  return { tools };
}

function getTestStatus(findings: UnifiedFinding[]) {
  const fails = findings.filter(f => f.status === 'fail');
  if (fails.some(f => f.severity === 'critical')) return 'critical';
  if (fails.some(f => f.severity === 'high')) return 'high';
  if (fails.some(f => f.severity === 'medium')) return 'warning';
  if (findings.length === 0) return 'clean';
  return fails.length > 0 ? 'warning' : 'clean';
}

interface ScanResultsProps {
  result: ScanResult;
  clientEmail?: string;
  clientName?: string;
}

export default function ScanResults({ result, clientEmail, clientName }: ScanResultsProps) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [popoverEmail, setPopoverEmail] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const toggleTool = (name: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  async function handleExportPDF() {
    setExporting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-scan-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scan-report-${result.scan_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF report downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleSendReport(email?: string) {
    const targetEmail = email || clientEmail;
    if (!targetEmail) {
      setPopoverOpen(true);
      return;
    }
    setSendingReport(true);
    try {
      const reportUrl = `https://cyberdefense.so/scan/${result.scan_id}`;
      await sendReportDeliveryEmail(result, reportUrl, targetEmail, clientName);
      toast.success(`Report sent to ${targetEmail}`);
      setPopoverOpen(false);
      setPopoverEmail("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send report");
    } finally {
      setSendingReport(false);
    }
  }

  const { tools } = normalizeFindings(result);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground font-mono">Scan Report</h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{result.scan_id}</p>
          </div>
          <div className="flex items-center gap-2">
            {result.status === "done" && (
              <div className="flex items-center gap-2">
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendReport()}
                      disabled={sendingReport}
                      className="gap-1.5"
                    >
                      {sendingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Send Report
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="end">
                    <p className="text-xs text-muted-foreground mb-2">Enter recipient email:</p>
                    <form onSubmit={(e) => { e.preventDefault(); handleSendReport(popoverEmail); }} className="flex gap-2">
                      <Input
                        type="email"
                        value={popoverEmail}
                        onChange={(e) => setPopoverEmail(e.target.value)}
                        placeholder="client@example.com"
                        required
                        className="h-8 text-sm"
                      />
                      <Button type="submit" size="sm" disabled={sendingReport} className="h-8 px-3">
                        {sendingReport ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send"}
                      </Button>
                    </form>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-1.5"
                >
                  <a
                    href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/scan-reports/${result.scan_id}/report.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Download PDF
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="gap-1.5"
                >
                  {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Export PDF
                </Button>
              </div>
            )}
            <StatusBadge status={result.status} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Type", value: result.type.toUpperCase() },
            { label: "Target", value: result.target.replace("https://", "") },
            { label: "Started", value: new Date(result.created_at).toLocaleTimeString() },
            { label: "Status", value: result.status.toUpperCase() },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-xs text-muted-foreground font-mono">{item.label}</p>
              <p className="text-sm text-foreground font-medium font-mono">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Progress bars for running scans */}
        {result.status === "running" && (
          <div className="mt-4 space-y-2">
            {result.sast_status && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-10 font-mono">SAST</span>
                <div className="flex-1 bg-muted rounded-full h-1.5">
                  <div className={`h-full rounded-full transition-all ${result.sast_status === "done" ? "bg-green-500 w-full" : "bg-yellow-500 w-1/2 animate-pulse"}`} />
                </div>
                <span className="text-muted-foreground font-mono">{result.sast_status}</span>
              </div>
            )}
            {result.dast_status && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-10 font-mono">DAST</span>
                <div className="flex-1 bg-muted rounded-full h-1.5">
                  <div className={`h-full rounded-full transition-all ${result.dast_status === "done" ? "bg-green-500 w-full" : "bg-yellow-500 w-1/3 animate-pulse"}`} />
                </div>
                <span className="text-muted-foreground font-mono">{result.dast_status}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Charts (only when done) */}
      {result.status === "done" && <ScanReportCharts result={result} />}

      {/* Findings Table */}
      {result.status === "done" && tools.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground font-mono">Detailed Findings</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="font-mono">Scanner / Finding</TableHead>
                <TableHead className="text-center font-mono">Findings</TableHead>
                <TableHead className="text-center font-mono">Critical</TableHead>
                <TableHead className="text-center font-mono">High</TableHead>
                <TableHead className="text-center font-mono">Medium</TableHead>
                <TableHead className="text-center font-mono">Low</TableHead>
                <TableHead className="text-center font-mono">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools.map(tool => {
                const isExpanded = expandedTools.has(tool.name);
                const testStatus = getTestStatus(tool.findings);
                const fails = tool.findings.filter(f => f.status === 'fail');

                return (
                  <React.Fragment key={tool.name}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => toggleTool(tool.name)}
                    >
                      <TableCell>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{tool.icon}</span>
                          <div>
                            <div className="font-medium text-sm">{tool.name}</div>
                            <div className="text-xs text-muted-foreground">{tool.findings.length} finding(s)</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono">{tool.findings.length || '—'}</TableCell>
                      <TableCell className="text-center font-mono text-red-400">{fails.filter(f => f.severity === 'critical').length || '—'}</TableCell>
                      <TableCell className="text-center font-mono text-orange-400">{fails.filter(f => f.severity === 'high').length || '—'}</TableCell>
                      <TableCell className="text-center font-mono text-yellow-400">{fails.filter(f => f.severity === 'medium').length || '—'}</TableCell>
                      <TableCell className="text-center font-mono text-blue-400">{fails.filter(f => f.severity === 'low').length || '—'}</TableCell>
                      <TableCell className="text-center">
                        {testStatus === 'critical' && <Badge variant="destructive" className="text-xs">🔴 Critical</Badge>}
                        {testStatus === 'high' && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">🟠 High</Badge>}
                        {testStatus === 'warning' && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">⚠ Issues</Badge>}
                        {testStatus === 'clean' && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">✓ Clean</Badge>}
                      </TableCell>
                    </TableRow>

                    {isExpanded && tool.findings.map((f, fi) => (
                      <TableRow key={`${tool.name}-${fi}`} className="bg-muted/10">
                        <TableCell />
                        <TableCell colSpan={7}>
                          <div className="py-2 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {statusIcon(f.status)}
                              <SeverityBadge severity={f.severity} />
                              <span className="text-sm font-medium">{f.name}</span>
                            </div>
                            {f.description && (
                              <p className="text-sm text-muted-foreground">{f.description.slice(0, 300)}</p>
                            )}
                            <p className="text-xs text-muted-foreground font-mono">{f.location}</p>
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
        </div>
      )}

      {/* Running state */}
      {result.status === "running" && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-green-500 mx-auto mb-3" />
          <p className="text-sm text-foreground font-medium font-mono">Scan in progress...</p>
          <p className="text-xs text-muted-foreground mt-1">This can take 5–15 minutes</p>
        </div>
      )}
    </div>
  );
}
