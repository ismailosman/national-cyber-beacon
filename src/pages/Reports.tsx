import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Calendar, Building2, Loader2, Shield, AlertTriangle, Clock } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface Remediation {
  issue: string;
  severity: 'critical' | 'high' | 'medium';
  steps: string[];
  estimatedTime: string;
}

const severityBadge: Record<string, string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

const Reports: React.FC = () => {
  const [selectedOrg, setSelectedOrg] = useState('');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [generating, setGenerating] = useState(false);
  const [includeRemediation, setIncludeRemediation] = useState(true);
  const [remediations, setRemediations] = useState<Remediation[]>([]);

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('id, name, sector').order('name');
      return data || [];
    },
  });

  const org = (orgs as any[]).find((o) => o.id === selectedOrg);

  const { data: preview } = useQuery({
    queryKey: ['report-preview', selectedOrg, dateFrom, dateTo],
    enabled: !!selectedOrg,
    queryFn: async () => {
      const [orgData, alertsData] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', selectedOrg).single(),
        supabase.from('alerts').select('*').eq('organization_id', selectedOrg).gte('created_at', dateFrom).lte('created_at', dateTo + 'T23:59:59').order('created_at', { ascending: false }),
      ]);
      return { org: orgData.data, alerts: alertsData.data || [] };
    },
  });

  const handleDownloadPDF = async () => {
    if (!selectedOrg) { toast.error('Please select an organization'); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { org_id: selectedOrg, date_from: dateFrom, date_to: dateTo, includeRemediation },
      });
      if (error) throw error;

      // Save remediations for preview
      if (data?.remediations) setRemediations(data.remediations);

      const base64 = data?.pdf;
      if (!base64) throw new Error('No PDF data returned');

      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${org?.name || 'report'}-${dateFrom}-${dateTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF report downloaded');
    } catch (err: any) {
      toast.error('Failed to generate report: ' + (err.message || 'Unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  const openAlerts = preview?.alerts.filter((a: any) => a.status === 'open').length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Report Generator</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Generate downloadable PDF security reports with remediation instructions</p>
      </div>

      <div className="glass-card rounded-xl p-6 border border-border space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Report Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Organization
            </label>
            <select
              value={selectedOrg}
              onChange={e => setSelectedOrg(e.target.value)}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-all"
            >
              <option value="">Select organization...</option>
              {(orgs as any[]).map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date From
            </label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date To
            </label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-all" />
          </div>
        </div>

        {/* Remediation Toggle */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
          <Shield className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Include Remediation Plan</p>
            <p className="text-xs text-muted-foreground">Adds step-by-step fix instructions for each security issue</p>
          </div>
          <Switch checked={includeRemediation} onCheckedChange={setIncludeRemediation} />
        </div>

        <button
          onClick={handleDownloadPDF}
          disabled={generating || !selectedOrg}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? 'Generating PDF...' : 'Download PDF Report'}
        </button>
      </div>

      {preview && preview.org && (
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2 bg-primary/5">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Report Preview</h3>
            <span className="ml-auto text-xs text-muted-foreground font-mono">{dateFrom} → {dateTo}</span>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">{preview.org.name}</h2>
                <p className="text-muted-foreground text-sm font-mono capitalize">{preview.org.domain} · {preview.org.sector} · {preview.org.region}</p>
              </div>
              <div className="text-right">
                <p className={cn('text-4xl font-bold font-mono',
                  preview.org.risk_score >= 75 ? 'text-neon-green' :
                  preview.org.risk_score >= 50 ? 'text-neon-amber' : 'text-neon-red'
                )}>{preview.org.risk_score}</p>
                <p className="text-xs text-muted-foreground">Current Risk Score</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Alerts', value: preview.alerts.length },
                { label: 'Open Alerts', value: openAlerts },
                { label: 'Status', value: preview.org.status },
                { label: 'Sector', value: preview.org.sector },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold font-mono text-primary capitalize">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Remediation Preview */}
      {remediations.length > 0 && (
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2 bg-destructive/5">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-semibold text-foreground">Remediation Recommendations</h3>
            <span className="ml-auto text-xs text-muted-foreground font-mono">{remediations.length} issues</span>
          </div>
          <div className="divide-y divide-border/50">
            {remediations.map((rem, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-mono uppercase px-2 py-0.5 rounded border', severityBadge[rem.severity])}>
                    {rem.severity}
                  </span>
                  <h4 className="text-sm font-semibold text-foreground">{rem.issue}</h4>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> {rem.estimatedTime}
                  </span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-sm text-foreground/80 pl-2">
                  {rem.steps.map((step, si) => (
                    <li key={si} className="text-xs leading-relaxed">{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
