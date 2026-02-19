import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Calendar, Building2, Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';

const Reports: React.FC = () => {
  const [selectedOrg, setSelectedOrg] = useState('');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [generating, setGenerating] = useState(false);

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('id, name, sector').order('name');
      return data || [];
    },
  });

  const org = orgs.find((o: any) => o.id === selectedOrg);

  const { data: preview } = useQuery({
    queryKey: ['report-preview', selectedOrg, dateFrom, dateTo],
    enabled: !!selectedOrg,
    queryFn: async () => {
      const [orgData, checksData, alertsData, historyData] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', selectedOrg).single(),
        supabase.from('security_checks').select('*').eq('org_id', selectedOrg).gte('checked_at', dateFrom).lte('checked_at', dateTo + 'T23:59:59').order('checked_at', { ascending: false }),
        supabase.from('alerts').select('*').eq('org_id', selectedOrg).gte('created_at', dateFrom).lte('created_at', dateTo + 'T23:59:59').order('created_at', { ascending: false }),
        supabase.from('risk_score_history').select('*').eq('org_id', selectedOrg).gte('recorded_at', dateFrom).order('recorded_at', { ascending: true }),
      ]);
      return {
        org: orgData.data,
        checks: checksData.data || [],
        alerts: alertsData.data || [],
        history: historyData.data || [],
      };
    },
  });

  const handleDownloadPDF = async () => {
    if (!selectedOrg) { toast.error('Please select an organization'); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { org_id: selectedOrg, date_from: dateFrom, date_to: dateTo },
      });
      if (error) throw error;

      // The edge function returns base64 PDF
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
      toast.success('PDF report downloaded successfully');
    } catch (err: any) {
      toast.error('Failed to generate report: ' + (err.message || 'Unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  const passRate = preview?.checks.length
    ? Math.round((preview.checks.filter((c: any) => c.result === 'pass').length / preview.checks.length) * 100)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Report Generator</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Generate downloadable PDF security reports</p>
      </div>

      {/* Config */}
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
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all"
            >
              <option value="">Select organization...</option>
              {orgs.map((o: any) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date From
            </label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date To
            </label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all" />
          </div>
        </div>

        <button
          onClick={handleDownloadPDF}
          disabled={generating || !selectedOrg}
          className="flex items-center gap-2 px-6 py-2.5 bg-neon-cyan text-background font-bold text-sm rounded-lg hover:brightness-110 transition-all disabled:opacity-50 glow-cyan"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? 'Generating PDF...' : 'Download PDF Report'}
        </button>
      </div>

      {/* Preview */}
      {preview && preview.org && (
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2 bg-neon-cyan/5">
            <FileText className="w-4 h-4 text-neon-cyan" />
            <h3 className="text-sm font-semibold text-foreground">Report Preview</h3>
            <span className="ml-auto text-xs text-muted-foreground font-mono">{dateFrom} → {dateTo}</span>
          </div>

          <div className="p-6 space-y-6">
            {/* Org header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">{preview.org.name}</h2>
                <p className="text-muted-foreground text-sm font-mono">{preview.org.domain} · {preview.org.sector}</p>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-bold font-mono ${
                  preview.org.risk_score >= 75 ? 'text-neon-green' :
                  preview.org.risk_score >= 50 ? 'text-neon-amber' : 'text-neon-red'
                }`}>{preview.org.risk_score}</p>
                <p className="text-xs text-muted-foreground">Current Risk Score</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Scans', value: preview.checks.length },
                { label: 'Pass Rate', value: passRate !== null ? `${passRate}%` : 'N/A' },
                { label: 'Active Alerts', value: preview.alerts.filter((a: any) => !a.is_read).length },
                { label: 'Total Alerts', value: preview.alerts.length },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold font-mono text-neon-cyan">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Recommendations</h4>
              <div className="space-y-2">
                {preview.checks.filter((c: any) => c.result !== 'pass').length === 0 ? (
                  <p className="text-sm text-neon-green">✓ All security checks passed. Maintain current security posture.</p>
                ) : (
                  preview.checks.filter((c: any, i: number, arr: any[]) =>
                    arr.findIndex((x: any) => x.check_type === c.check_type) === i && c.result !== 'pass'
                  ).map((c: any) => (
                    <div key={c.check_type} className="flex items-start gap-2 text-sm p-3 rounded-lg bg-neon-amber/5 border border-neon-amber/20">
                      <span className="text-neon-amber font-bold flex-shrink-0">→</span>
                      <p className="text-foreground">
                        {c.check_type === 'ssl' && 'Renew or fix SSL certificate to ensure encrypted communications.'}
                        {c.check_type === 'https' && 'Enforce HTTPS redirection to prevent unencrypted traffic.'}
                        {c.check_type === 'headers' && 'Implement missing security headers (HSTS, CSP, X-Frame-Options).'}
                        {c.check_type === 'dns' && 'Investigate DNS resolution issues — domain may be misconfigured.'}
                        {c.check_type === 'uptime' && 'Address website downtime immediately. Implement redundancy.'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
