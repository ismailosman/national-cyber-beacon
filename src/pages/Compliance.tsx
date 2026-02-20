import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CheckSquare, Building2, Play, ClipboardEdit, Clock, Loader2, ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { FRAMEWORKS, getFramework, type FrameworkControl } from '@/lib/compliance/frameworks';
import { runAssessment } from '@/lib/compliance/assess';

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
  Identity: 'text-blue-400', Network: 'text-cyan-400', Endpoint: 'text-emerald-400',
  App: 'text-purple-400', Data: 'text-yellow-400', IR: 'text-red-400', Backup: 'text-emerald-400',
  // NIST CSF 2.0
  Govern: 'text-indigo-400', Identify: 'text-blue-400', Protect: 'text-emerald-400',
  Detect: 'text-amber-400', Respond: 'text-red-400', Recover: 'text-teal-400',
  // ITU
  Legal: 'text-orange-400', Technical: 'text-cyan-400', Organizational: 'text-violet-400',
  Capacity: 'text-pink-400', Cooperation: 'text-lime-400',
};

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ─── Component ─── */
const Compliance: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedFrameworkKey, setSelectedFrameworkKey] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [assessing, setAssessing] = useState(false);
  const [assessProgress, setAssessProgress] = useState('');
  const [expandedControl, setExpandedControl] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  // Manual assessment modal
  const [manualCtrl, setManualCtrl] = useState<FrameworkControl | null>(null);
  const [manualStatus, setManualStatus] = useState('passing');
  const [manualEvidence, setManualEvidence] = useState('');

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations-monitored'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations_monitored').select('id, name, url, sector').order('name');
      return data || [];
    },
  });

  const framework = getFramework(selectedFrameworkKey);
  const controls = framework?.controls || [];
  const domains = framework?.domains || ['all'];

  const { data: assessments = [], refetch: refetchAssessments } = useQuery({
    queryKey: ['compliance-assessments', selectedOrg, selectedFrameworkKey],
    enabled: !!selectedOrg && !!selectedFrameworkKey,
    queryFn: async () => {
      const { data } = await supabase.from('compliance_assessments' as any)
        .select('*').eq('organization_id', selectedOrg).eq('framework', selectedFrameworkKey);
      return (data || []) as any[];
    },
  });

  // Compare view: fetch all frameworks for this org
  const { data: allAssessments = [] } = useQuery({
    queryKey: ['compliance-all-assessments', selectedOrg],
    enabled: !!selectedOrg && showCompare,
    queryFn: async () => {
      const { data } = await supabase.from('compliance_assessments' as any)
        .select('*').eq('organization_id', selectedOrg);
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

  const filtered = controls.filter(c => domainFilter === 'all' || c.domain === domainFilter);

  // Run auto-assessment
  const handleRunAssessment = useCallback(async () => {
    if (!selectedOrg || !selectedFrameworkKey) return;
    setAssessing(true);
    try {
      const count = await runAssessment(selectedFrameworkKey, selectedOrg, setAssessProgress);
      await refetchAssessments();
      const autoCount = controls.filter(c => c.type !== 'manual').length;
      const manualCount = controls.length - autoCount;
      toast({ title: 'Assessment complete', description: `${count} auto-assessed, ${manualCount} require manual assessment` });
    } catch (err) {
      console.error('Assessment error:', err);
      toast({ title: 'Assessment failed', variant: 'destructive' });
    } finally {
      setAssessing(false);
      setAssessProgress('');
    }
  }, [selectedOrg, selectedFrameworkKey, controls, refetchAssessments, toast]);

  // Save manual assessment
  const handleSaveManual = async () => {
    if (!manualCtrl || !selectedOrg || !selectedFrameworkKey) return;
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('compliance_assessments' as any).upsert({
      organization_id: selectedOrg, control_code: manualCtrl.code, framework: selectedFrameworkKey,
      status: manualStatus, assessment_type: 'manual', evidence: manualEvidence,
      evidence_data: {}, assessed_by: 'Manual', assessed_at: new Date().toISOString(), expires_at: expiresAt,
    }, { onConflict: 'organization_id,control_code,framework' });
    setManualCtrl(null);
    setManualEvidence('');
    refetchAssessments();
    toast({ title: 'Assessment saved' });
  };

  // Compare data
  const compareData = FRAMEWORKS.map(fw => {
    const fwAssessments = allAssessments.filter((a: any) => a.framework === fw.key);
    const fwAssessed = fwAssessments.filter((a: any) => a.status !== 'not_assessed' && a.status !== 'check_failed');
    const fwPassing = fwAssessed.filter((a: any) => a.status === 'passing').length;
    const fwPartial = fwAssessed.filter((a: any) => a.status === 'partial').length;
    const fwFailing = fwAssessed.filter((a: any) => a.status === 'failing').length;
    const fwScore = fwAssessed.length > 0 ? Math.round(((fwPassing + fwPartial * 0.5) / fwAssessed.length) * 100) : null;
    return { ...fw, total: fw.controls.length, assessed: fwAssessed.length, passing: fwPassing, partial: fwPartial, failing: fwFailing, score: fwScore };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compliance</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Framework-based control assessment and scoring</p>
        </div>
        {selectedOrg && (
          <Button variant="outline" size="sm" onClick={() => setShowCompare(!showCompare)}
            className={cn(showCompare && 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan')}>
            <BarChart3 className="w-4 h-4 mr-1.5" /> Compare
          </Button>
        )}
      </div>

      {/* Selectors + Run Assessment */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Organization</label>
          <select value={selectedOrg} onChange={e => { setSelectedOrg(e.target.value); setShowCompare(false); }}
            className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all">
            <option value="">Select organization...</option>
            {(orgs as any[]).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5" /> Framework</label>
          <select value={selectedFrameworkKey} onChange={e => { setSelectedFrameworkKey(e.target.value); setDomainFilter('all'); setExpandedControl(null); }}
            className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all">
            <option value="">Select framework...</option>
            {FRAMEWORKS.map(f => <option key={f.key} value={f.key}>{f.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5 flex items-end">
          <Button onClick={handleRunAssessment} disabled={!selectedOrg || !selectedFrameworkKey || assessing}
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

      {/* Compare View */}
      {showCompare && selectedOrg && (
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-neon-cyan flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Framework Comparison
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left p-3 text-xs text-muted-foreground font-mono">Framework</th>
                  <th className="text-center p-3 text-xs text-muted-foreground font-mono">Controls</th>
                  <th className="text-center p-3 text-xs text-muted-foreground font-mono">Assessed</th>
                  <th className="text-center p-3 text-xs text-muted-foreground font-mono">Passing</th>
                  <th className="text-center p-3 text-xs text-muted-foreground font-mono">Partial</th>
                  <th className="text-center p-3 text-xs text-muted-foreground font-mono">Failing</th>
                  <th className="text-center p-3 text-xs text-muted-foreground font-mono">Score</th>
                </tr>
              </thead>
              <tbody>
                {compareData.map(fw => (
                  <tr key={fw.key} className="border-b border-border/50 hover:bg-accent/10 cursor-pointer"
                    onClick={() => { setSelectedFrameworkKey(fw.key); setShowCompare(false); setDomainFilter('all'); }}>
                    <td className="p-3 font-medium">{fw.name}</td>
                    <td className="p-3 text-center text-muted-foreground">{fw.total}</td>
                    <td className="p-3 text-center text-blue-400">{fw.assessed}/{fw.total}</td>
                    <td className="p-3 text-center text-emerald-400">{fw.passing}</td>
                    <td className="p-3 text-center text-yellow-400">{fw.partial}</td>
                    <td className="p-3 text-center text-red-400">{fw.failing}</td>
                    <td className="p-3 text-center">
                      <span className={cn('font-bold font-mono',
                        fw.score === null ? 'text-muted-foreground' : fw.score >= 70 ? 'text-emerald-400' : fw.score >= 50 ? 'text-yellow-400' : 'text-red-400')}>
                        {fw.score !== null ? `${fw.score}%` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Score summary + controls table */}
      {selectedOrg && selectedFrameworkKey && !showCompare && (
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
                  {filtered.map((ctrl) => {
                    const assessment = getAssessment(ctrl.code);
                    const st = assessment ? (statusStyles[assessment.status] || statusStyles.not_assessed) : statusStyles.not_assessed;
                    const isAuto = ctrl.type !== 'manual';
                    const isExpanded = expandedControl === ctrl.code;

                    return (
                      <React.Fragment key={ctrl.code}>
                        <tr
                          className={cn(
                            'border-b border-border/50 hover:bg-accent/20 transition-colors cursor-pointer',
                            isExpanded && 'bg-accent/10 border-b-0'
                          )}
                          onClick={() => setExpandedControl(isExpanded ? null : ctrl.code)}
                        >
                          <td className="p-3 font-mono text-xs text-neon-cyan">
                            <span className="flex items-center gap-1.5">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                              {ctrl.code}
                            </span>
                          </td>
                          <td className="p-3">
                            <p className="font-medium text-sm">{ctrl.title}</p>
                          </td>
                          <td className="p-3 hidden sm:table-cell">
                            <span className={cn('text-xs font-medium', domainColors[ctrl.domain] || 'text-muted-foreground')}>{ctrl.domain}</span>
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            <Badge variant="outline" className={cn('text-[10px]',
                              ctrl.type === 'auto' ? 'border-blue-500/30 text-blue-400'
                              : ctrl.type === 'hybrid' ? 'border-violet-500/30 text-violet-400'
                              : 'border-border text-muted-foreground')}>
                              {ctrl.type === 'auto' ? 'Auto' : ctrl.type === 'hybrid' ? 'Hybrid' : 'Manual'}
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
                              ) : ctrl.type === 'manual' ? (
                                <Button size="sm" variant="ghost" className="text-[10px] h-5 px-2 text-neon-cyan"
                                  onClick={(e) => { e.stopPropagation(); setManualCtrl(ctrl); setManualStatus('passing'); setManualEvidence(''); }}>
                                  <ClipboardEdit className="w-3 h-3 mr-1" /> Assess
                                </Button>
                              ) : null}
                            </div>
                          </td>
                          <td className="p-3 hidden lg:table-cell">
                            <p className="text-xs text-muted-foreground line-clamp-2 max-w-xs">{assessment?.evidence || '—'}</p>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-border/50 bg-accent/5">
                            <td colSpan={6} className="p-0">
                              <div className="px-5 py-4 space-y-4">
                                <p className="text-xs text-muted-foreground italic">{ctrl.description}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-mono uppercase tracking-wider text-neon-cyan flex items-center gap-1.5">
                                      <CheckSquare className="w-3.5 h-3.5" /> Requirements
                                    </h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{ctrl.requirements}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-mono uppercase tracking-wider text-neon-cyan flex items-center gap-1.5">
                                      <ClipboardEdit className="w-3.5 h-3.5" /> Recommendations
                                    </h4>
                                    <ul className="space-y-1.5">
                                      {ctrl.recommendations.map((rec, i) => (
                                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                          <span className="text-neon-cyan mt-1 text-xs">•</span>
                                          {rec}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                                {assessment?.evidence && (
                                  <div className="pt-2 border-t border-border/30">
                                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Assessment Evidence</h4>
                                    <p className="text-xs text-muted-foreground">{assessment.evidence}</p>
                                  </div>
                                )}
                                {/* Manual assess button in expanded view for manual/hybrid controls */}
                                {(ctrl.type === 'manual' || (ctrl.type === 'hybrid' && !assessment)) && (
                                  <div className="pt-2">
                                    <Button size="sm" variant="outline" className="text-xs text-neon-cyan border-neon-cyan/30"
                                      onClick={(e) => { e.stopPropagation(); setManualCtrl(ctrl); setManualStatus('passing'); setManualEvidence(''); }}>
                                      <ClipboardEdit className="w-3 h-3 mr-1.5" /> Manual Assessment
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selectedOrg && !selectedFrameworkKey && !showCompare && (
        <div className="glass-card rounded-xl py-20 text-center text-muted-foreground border border-border">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Select an organization and framework to view compliance status.</p>
        </div>
      )}

      {/* Manual Assessment Dialog */}
      <Dialog open={!!manualCtrl} onOpenChange={() => setManualCtrl(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Assess: {manualCtrl?.code}</DialogTitle>
          </DialogHeader>
          {manualCtrl && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{manualCtrl.title}</p>
              <p className="text-xs text-muted-foreground">{manualCtrl.description}</p>

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
