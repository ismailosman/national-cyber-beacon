import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CheckSquare, Building2, Play, ClipboardEdit, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

/* ─── Status Styles ─── */
const statusStyles: Record<string, { label: string; icon: string; className: string }> = {
  passing: { label: 'Passing', icon: '✓', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  partial: { label: 'Partial', icon: '◐', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  failing: { label: 'Failing', icon: '✗', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
  not_assessed: { label: 'Not Assessed', icon: '⊘', className: 'bg-muted text-muted-foreground border-border' },
  not_applicable: { label: 'N/A', icon: '—', className: 'bg-muted text-muted-foreground border-border' },
  check_failed: { label: 'Check Failed', icon: '⚠', className: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
};

const domainColors: Record<string, string> = {
  Identity: 'text-blue-400',
  Network: 'text-cyan-400',
  Endpoint: 'text-emerald-400',
  App: 'text-purple-400',
  Data: 'text-yellow-400',
  IR: 'text-red-400',
  Backup: 'text-emerald-400',
};

/* ─── Auto-assessable controls ─── */
const AUTO_CONTROLS = new Set([
  'CIS-1.1', 'CIS-2.1', 'CIS-3.10', 'CIS-4.1', 'CIS-4.2',
  'CIS-7.1', 'CIS-12.1', 'CIS-13.1', 'CIS-16.1', 'CIS-16.11',
]);

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ─── Auto-Assessment Engine ─── */
async function assessOrganization(orgId: string) {
  // Fetch all monitoring data in parallel
  const [uptimeRes, sslRes, ddosRes, ewRes, techRes, tiRes, orgRes] = await Promise.all([
    supabase.from('uptime_logs').select('*').eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(10),
    supabase.from('ssl_logs').select('*').eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(1),
    supabase.from('ddos_risk_logs').select('*').eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(1),
    supabase.from('early_warning_logs').select('*').eq('organization_id', orgId).order('checked_at', { ascending: false }),
    supabase.from('tech_fingerprints' as any).select('*').eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(1),
    supabase.from('threat_intelligence_logs').select('*').eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(5),
    supabase.from('organizations_monitored').select('*').eq('id', orgId).limit(1),
  ]);

  const uptime = uptimeRes.data || [];
  const ssl = sslRes.data?.[0] as any;
  const ddos = ddosRes.data?.[0] as any;
  const ew = ewRes.data || [];
  const tech = (techRes.data as any)?.[0] as any;
  const ti = tiRes.data || [];
  const org = orgRes.data?.[0] as any;

  const secHeaders = ew.find(e => e.check_type === 'security_headers');
  const openPorts = ew.find(e => e.check_type === 'open_ports');

  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  const assessments: any[] = [];

  const push = (code: string, status: string, evidence: string, evidenceData: any) => {
    assessments.push({
      organization_id: orgId, control_code: code, framework: 'cis-v8',
      status, assessment_type: 'auto', evidence, evidence_data: evidenceData,
      assessed_by: 'System (Auto)', assessed_at: new Date().toISOString(), expires_at: expiresAt,
    });
  };

  // CIS-1.1: Asset Inventory
  const orgComplete = org && org.name && org.url && org.sector;
  const hasTech = !!tech;
  push('CIS-1.1',
    orgComplete && hasTech ? 'passing' : orgComplete ? 'partial' : 'failing',
    `Org record: ${orgComplete ? 'Complete' : 'Incomplete'}, Tech fingerprint: ${hasTech ? 'Yes' : 'No'}`,
    { orgComplete, hasTech }
  );

  // CIS-2.1: Software Inventory
  const hasSoftware = tech && (tech.web_server || tech.language || tech.cms || (tech.js_libraries?.length > 0));
  push('CIS-2.1',
    hasSoftware ? 'passing' : tech ? 'partial' : 'failing',
    hasSoftware ? `Detected: ${[tech?.web_server, tech?.language, tech?.cms].filter(Boolean).join(', ')}` : 'No tech fingerprint',
    { tech }
  );

  // CIS-3.10: Encrypt Data in Transit
  const hstsHeader = (secHeaders?.details as any)?.headers?.strictTransportSecurity;
  push('CIS-3.10',
    ssl?.is_valid && hstsHeader ? 'passing' : ssl?.is_valid ? 'partial' : 'failing',
    `SSL: ${ssl?.is_valid ? 'Valid' : 'Invalid/Missing'}, HSTS: ${hstsHeader ? 'Present' : 'Missing'}`,
    { ssl: ssl ? { is_valid: ssl.is_valid, days_until_expiry: ssl.days_until_expiry } : null, hsts: !!hstsHeader }
  );

  // CIS-4.1: Secure Configuration
  const headerScore = (secHeaders?.details as any)?.score || 0;
  const portsData = openPorts?.details as any;
  const criticalPorts = portsData?.criticalPorts || 0;
  push('CIS-4.1',
    headerScore >= 5 && criticalPorts === 0 ? 'passing' : (headerScore >= 3 || criticalPorts === 0) ? 'partial' : 'failing',
    `Security headers: ${headerScore}/7, Critical ports exposed: ${criticalPorts}`,
    { headerScore, criticalPorts, openPorts: portsData?.openPorts }
  );

  // CIS-4.2: Network Secure Config
  push('CIS-4.2',
    ddos?.has_cdn && ddos?.has_waf && ddos?.has_rate_limiting ? 'passing'
    : ddos?.has_cdn ? 'partial' : ddos ? 'failing' : 'check_failed',
    ddos ? `CDN: ${ddos.has_cdn ? '✓' : '✗'}, WAF: ${ddos.has_waf ? '✓' : '✗'}, Rate Limiting: ${ddos.has_rate_limiting ? '✓' : '✗'}` : 'No DDoS data',
    { ddos: ddos ? { has_cdn: ddos.has_cdn, has_waf: ddos.has_waf, has_rate_limiting: ddos.has_rate_limiting, cdn_provider: ddos.cdn_provider } : null }
  );

  // CIS-7.1: Vulnerability Management
  const vulnCount = tech?.vulnerabilities_count || 0;
  const outdatedCount = tech?.outdated_count || 0;
  push('CIS-7.1',
    tech && vulnCount === 0 && outdatedCount === 0 ? 'passing'
    : tech && outdatedCount > 0 ? 'partial' : tech ? 'failing' : 'check_failed',
    tech ? `Vulnerabilities: ${vulnCount}, Outdated: ${outdatedCount}` : 'No tech fingerprint',
    { vulnCount, outdatedCount }
  );

  // CIS-12.1: Network Infrastructure Up-to-Date
  const webServerVersion = tech?.web_server_version;
  let versionStatus = 'check_failed';
  let versionEvidence = 'No version data';
  if (tech) {
    const outdated = tech.outdated_count > 0;
    versionStatus = outdated ? 'failing' : 'passing';
    versionEvidence = `${tech.web_server || 'Unknown'} ${webServerVersion || '?'}, Outdated count: ${tech.outdated_count}`;
  }
  push('CIS-12.1', versionStatus, versionEvidence, { tech: tech ? { web_server: tech.web_server, web_server_version: tech.web_server_version } : null });

  // CIS-13.1: Centralize Security Alerting
  const hasUptime = uptime.length > 0;
  const hasSsl = !!ssl;
  const hasDdos = !!ddos;
  const hasEw = ew.length > 0;
  const monitorCount = [hasUptime, hasSsl, hasDdos, hasEw].filter(Boolean).length;
  push('CIS-13.1',
    monitorCount === 4 ? 'passing' : monitorCount >= 2 ? 'partial' : 'failing',
    `Monitored by: Uptime ${hasUptime ? '✓' : '✗'}, SSL ${hasSsl ? '✓' : '✗'}, DDoS ${hasDdos ? '✓' : '✗'}, Early Warning ${hasEw ? '✓' : '✗'}`,
    { hasUptime, hasSsl, hasDdos, hasEw, monitorCount }
  );

  // CIS-16.1: App Security Headers
  const headers = (secHeaders?.details as any)?.headers || {};
  const hasCSP = !!headers.contentSecurityPolicy;
  const hasXFO = !!headers.xFrameOptions;
  const hasXCTO = !!headers.xContentTypeOptions;
  push('CIS-16.1',
    hasCSP && hasXFO && hasXCTO ? 'passing' : (hasXFO || hasXCTO) ? 'partial' : secHeaders ? 'failing' : 'check_failed',
    `CSP: ${hasCSP ? '✓' : '✗'}, X-Frame-Options: ${hasXFO ? '✓' : '✗'}, X-Content-Type-Options: ${hasXCTO ? '✓' : '✗'}`,
    { hasCSP, hasXFO, hasXCTO }
  );

  // CIS-16.11: Database Hardening
  const openPortsList = (portsData?.openPorts || []) as any[];
  const dbPorts = [3306, 5432, 27017];
  const exposedDbPorts = openPortsList.filter((p: any) => dbPorts.includes(p.port));
  push('CIS-16.11',
    openPorts ? (exposedDbPorts.length === 0 ? 'passing' : 'failing') : 'check_failed',
    openPorts ? (exposedDbPorts.length === 0 ? 'No database ports exposed' : `Exposed: ${exposedDbPorts.map((p: any) => `${p.service}(${p.port})`).join(', ')}`) : 'No port scan data',
    { exposedDbPorts }
  );

  // Upsert all assessments
  for (const a of assessments) {
    await supabase.from('compliance_assessments' as any).upsert(a, { onConflict: 'organization_id,control_code,framework' });
  }

  return assessments;
}

/* ─── Component ─── */
const Compliance: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedFramework, setSelectedFramework] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [assessing, setAssessing] = useState(false);
  const [assessProgress, setAssessProgress] = useState('');

  // Manual assessment modal
  const [manualCtrl, setManualCtrl] = useState<any>(null);
  const [manualStatus, setManualStatus] = useState('passing');
  const [manualEvidence, setManualEvidence] = useState('');

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations-monitored'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations_monitored').select('id, name, url, sector').order('name');
      return data || [];
    },
  });

  const { data: frameworks = [] } = useQuery({
    queryKey: ['frameworks'],
    queryFn: async () => {
      const { data } = await supabase.from('compliance_frameworks').select('*').order('name');
      return data || [];
    },
  });

  const { data: controls = [] } = useQuery({
    queryKey: ['controls', selectedFramework],
    enabled: !!selectedFramework,
    queryFn: async () => {
      const { data } = await supabase.from('controls').select('*').eq('framework_id', selectedFramework).order('control_code');
      return data || [];
    },
  });

  const { data: assessments = [], refetch: refetchAssessments } = useQuery({
    queryKey: ['compliance-assessments', selectedOrg, selectedFramework],
    enabled: !!selectedOrg && !!selectedFramework,
    queryFn: async () => {
      const { data } = await supabase.from('compliance_assessments' as any).select('*').eq('organization_id', selectedOrg).eq('framework', 'cis-v8');
      return (data || []) as any[];
    },
  });

  const getAssessment = (controlCode: string) => assessments.find((a: any) => a.control_code === controlCode);

  // Score calculation
  const assessed = assessments.filter((a: any) => a.status !== 'not_assessed' && a.status !== 'check_failed');
  const passingCount = assessed.filter((a: any) => a.status === 'passing').length;
  const partialCount = assessed.filter((a: any) => a.status === 'partial').length;
  const failingCount = assessed.filter((a: any) => a.status === 'failing').length;
  const totalAssessed = assessed.length;
  const score = totalAssessed > 0 ? Math.round(((passingCount * 1.0 + partialCount * 0.5) / totalAssessed) * 100) : null;

  const gradeLabel = score !== null
    ? score >= 90 ? 'Compliant' : score >= 70 ? 'Partially Compliant' : score >= 50 ? 'Needs Improvement' : 'Non-Compliant'
    : null;
  const gradeColor = score !== null
    ? score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-yellow-400' : score >= 50 ? 'text-orange-400' : 'text-red-400'
    : 'text-muted-foreground';

  const domains = ['all', ...Array.from(new Set((controls as any[]).map(c => c.domain)))];
  const filtered = (controls as any[]).filter(c => domainFilter === 'all' || c.domain === domainFilter);

  // Run auto-assessment
  const handleRunAssessment = useCallback(async () => {
    if (!selectedOrg) return;
    setAssessing(true);
    try {
      setAssessProgress('Querying monitoring data...');
      await assessOrganization(selectedOrg);
      setAssessProgress('Assessment complete!');
      await refetchAssessments();
      toast({ title: 'Assessment complete', description: `${AUTO_CONTROLS.size} auto-assessed, ${(controls as any[]).length - AUTO_CONTROLS.size} require manual assessment` });
    } catch (err) {
      console.error('Assessment error:', err);
      toast({ title: 'Assessment failed', variant: 'destructive' });
    } finally {
      setAssessing(false);
      setAssessProgress('');
    }
  }, [selectedOrg, controls, refetchAssessments, toast]);

  // Save manual assessment
  const handleSaveManual = async () => {
    if (!manualCtrl || !selectedOrg) return;
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('compliance_assessments' as any).upsert({
      organization_id: selectedOrg, control_code: manualCtrl.control_code, framework: 'cis-v8',
      status: manualStatus, assessment_type: 'manual', evidence: manualEvidence,
      evidence_data: {}, assessed_by: 'Manual', assessed_at: new Date().toISOString(), expires_at: expiresAt,
    }, { onConflict: 'organization_id,control_code,framework' });
    setManualCtrl(null);
    setManualEvidence('');
    refetchAssessments();
    toast({ title: 'Assessment saved' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Compliance</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Framework-based control assessment and scoring</p>
      </div>

      {/* Selectors + Run Assessment */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Organization</label>
          <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}
            className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all">
            <option value="">Select organization...</option>
            {(orgs as any[]).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5" /> Framework</label>
          <select value={selectedFramework} onChange={e => setSelectedFramework(e.target.value)}
            className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all">
            <option value="">Select framework...</option>
            {(frameworks as any[]).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5 flex items-end">
          <Button onClick={handleRunAssessment} disabled={!selectedOrg || !selectedFramework || assessing}
            className="w-full bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30">
            {assessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            {assessing ? 'Assessing...' : 'Run Assessment'}
          </Button>
        </div>
      </div>

      {/* Progress */}
      {assessProgress && (
        <div className="text-xs text-muted-foreground font-mono animate-pulse">{assessProgress}</div>
      )}

      {/* Score summary */}
      {selectedOrg && selectedFramework && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Compliance Score', value: score !== null ? `${score}%` : 'N/A', sub: gradeLabel, color: gradeColor },
              { label: 'Controls Total', value: controls.length, color: 'text-neon-cyan' },
              { label: 'Assessed', value: `${totalAssessed}/${controls.length}`, color: 'text-blue-400' },
              { label: 'Passing', value: passingCount, color: 'text-emerald-400' },
              { label: 'Failing', value: failingCount, color: 'text-red-400' },
            ].map(c => (
              <div key={c.label} className="glass-card rounded-xl p-4 border border-border text-center">
                <p className={cn('text-2xl font-bold font-mono', c.color)}>{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
                {'sub' in c && c.sub && <p className={cn('text-[10px] mt-0.5', c.color)}>{c.sub}</p>}
              </div>
            ))}
          </div>

          {/* Domain filter */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit flex-wrap">
            {domains.map(d => (
              <button key={d} onClick={() => setDomainFilter(d)}
                className={cn('px-3 py-1.5 text-xs font-medium rounded transition-all',
                  domainFilter === d ? 'bg-neon-cyan text-background font-bold' : 'text-muted-foreground hover:text-foreground')}>
                {d}
              </button>
            ))}
          </div>

          {/* Controls table */}
          <div className="glass-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Code</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Control</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider hidden sm:table-cell">Domain</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider hidden md:table-cell">Type</th>
                    <th className="text-center p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Status</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider hidden lg:table-cell">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ctrl: any) => {
                    const assessment = getAssessment(ctrl.control_code);
                    const st = assessment ? (statusStyles[assessment.status] || statusStyles.not_assessed) : statusStyles.not_assessed;
                    const isAuto = AUTO_CONTROLS.has(ctrl.control_code);

                    return (
                      <tr key={ctrl.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                        <td className="p-3 font-mono text-xs text-neon-cyan">{ctrl.control_code}</td>
                        <td className="p-3">
                          <p className="font-medium text-sm">{ctrl.title}</p>
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          <span className={cn('text-xs font-medium', domainColors[ctrl.domain] || 'text-muted-foreground')}>{ctrl.domain}</span>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <Badge variant="outline" className={cn('text-[10px]', isAuto ? 'border-blue-500/30 text-blue-400' : 'border-border text-muted-foreground')}>
                            {isAuto ? 'Auto' : 'Manual'}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={cn('text-xs px-2 py-1 rounded-full font-bold uppercase border', st.className)}>
                              {st.icon} {st.label}
                            </span>
                            {assessment ? (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" /> {timeAgo(assessment.assessed_at)}
                              </span>
                            ) : !isAuto ? (
                              <Button size="sm" variant="ghost" className="text-[10px] h-5 px-2 text-neon-cyan"
                                onClick={() => { setManualCtrl(ctrl); setManualStatus('passing'); setManualEvidence(''); }}>
                                <ClipboardEdit className="w-3 h-3 mr-1" /> Assess
                              </Button>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          <p className="text-xs text-muted-foreground line-clamp-2 max-w-xs">{assessment?.evidence || '—'}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selectedOrg && !selectedFramework && (
        <div className="glass-card rounded-xl py-20 text-center text-muted-foreground border border-border">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Select an organization and framework to view compliance status.</p>
        </div>
      )}

      {/* Manual Assessment Dialog */}
      <Dialog open={!!manualCtrl} onOpenChange={() => setManualCtrl(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Assess: {manualCtrl?.control_code}</DialogTitle>
          </DialogHeader>
          {manualCtrl && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{manualCtrl.title}</p>
              {manualCtrl.description && <p className="text-xs text-muted-foreground">{manualCtrl.description}</p>}

              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase tracking-wider">Status</Label>
                <RadioGroup value={manualStatus} onValueChange={setManualStatus} className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'passing', label: '✓ Passing' },
                    { value: 'partial', label: '◐ Partial' },
                    { value: 'failing', label: '✗ Failing' },
                    { value: 'not_applicable', label: '— N/A' },
                  ].map(opt => (
                    <div key={opt.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={opt.value} id={opt.value} />
                      <Label htmlFor={opt.value} className="text-sm cursor-pointer">{opt.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase tracking-wider">Evidence / Notes</Label>
                <Textarea value={manualEvidence} onChange={e => setManualEvidence(e.target.value)}
                  placeholder="Describe the evidence supporting this assessment..."
                  className="min-h-[80px] text-sm" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualCtrl(null)}>Cancel</Button>
            <Button onClick={handleSaveManual} className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30">Save Assessment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Compliance;
