import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Calendar, Building2, Loader2, Shield, AlertTriangle, Clock, Check, X } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
  const [includeEarlyWarning, setIncludeEarlyWarning] = useState(true);
  const [includeThreatIntel, setIncludeThreatIntel] = useState(true);
  const [includeAlertHistory, setIncludeAlertHistory] = useState(true);
  const [remediations, setRemediations] = useState<Remediation[]>([]);

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('id, name, sector').order('name');
      return data || [];
    },
  });

  const org = (orgs as any[]).find((o) => o.id === selectedOrg);

  // Fetch real monitoring data for preview
  const { data: preview } = useQuery({
    queryKey: ['report-preview', selectedOrg, dateFrom, dateTo],
    enabled: !!selectedOrg,
    queryFn: async () => {
      const dateToFilter = dateTo + 'T23:59:59';
      const [orgData, alertsData, sslData, ddosData, ewData, uptimeData] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', selectedOrg).single(),
        supabase.from('alerts').select('*').eq('organization_id', selectedOrg).gte('created_at', dateFrom).lte('created_at', dateToFilter).order('created_at', { ascending: false }),
        supabase.from('ssl_logs').select('*').eq('organization_id', selectedOrg).order('checked_at', { ascending: false }).limit(1),
        supabase.from('ddos_risk_logs').select('*').eq('organization_id', selectedOrg).order('checked_at', { ascending: false }).limit(1),
        supabase.from('early_warning_logs').select('*').eq('organization_id', selectedOrg).gte('checked_at', dateFrom).lte('checked_at', dateToFilter).order('checked_at', { ascending: false }).limit(200),
        supabase.from('uptime_logs').select('*').eq('organization_id', selectedOrg).gte('checked_at', dateFrom).lte('checked_at', dateToFilter).order('checked_at', { ascending: false }).limit(500),
      ]);

      const ssl = sslData.data?.[0];
      const ddos = ddosData.data?.[0];
      const ew = ewData.data || [];
      const uptime = uptimeData.data || [];

      // Calculate uptime percentage
      const upCount = uptime.filter((u: any) => u.status === 'up').length;
      const uptimePct = uptime.length > 0 ? Math.round((upCount / uptime.length) * 100) : null;

      // Group EW logs by check_type (latest per type)
      const ewByType: Record<string, any> = {};
      for (const log of ew) {
        if (!ewByType[log.check_type]) ewByType[log.check_type] = log;
      }

      return {
        org: orgData.data,
        alerts: alertsData.data || [],
        ssl, ddos, ewByType, uptimePct,
        ewCount: ew.length,
        uptimeCount: uptime.length,
      };
    },
  });

  const handleDownloadPDF = async () => {
    if (!selectedOrg) { toast.error('Please select an organization'); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { org_id: selectedOrg, date_from: dateFrom, date_to: dateTo, includeRemediation, includeEarlyWarning, includeThreatIntel, includeAlertHistory },
      });
      if (error) throw error;
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

  // Helper for check status badge
  const CheckStatusBadge = ({ status, label }: { status: 'pass' | 'warn' | 'fail' | 'none'; label: string }) => (
    <div className="flex items-center gap-1.5">
      {status === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> :
       status === 'warn' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> :
       status === 'fail' ? <X className="w-3.5 h-3.5 text-red-400" /> :
       <span className="w-3.5 h-3.5 text-muted-foreground">—</span>}
      <span className="text-xs text-foreground/80">{label}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Report Generator</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Generate downloadable PDF security reports with Early Warning, Threat Intelligence, and Remediation</p>
      </div>

      <div className="glass-card rounded-xl p-6 border border-border space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Report Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Organization
            </label>
            <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-all">
              <option value="">Select organization...</option>
              {(orgs as any[]).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
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

        {/* Section Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Early Warning Details', desc: 'Security headers, email, DNS, ports, defacement, blacklist checks', checked: includeEarlyWarning, onChange: setIncludeEarlyWarning, icon: Shield },
            { label: 'Threat Intelligence', desc: 'Phishing domains, breach exposure, technology risks', checked: includeThreatIntel, onChange: setIncludeThreatIntel, icon: AlertTriangle },
            { label: 'Alert History', desc: 'All alerts with severity and status breakdown', checked: includeAlertHistory, onChange: setIncludeAlertHistory, icon: Clock },
            { label: 'Remediation Plan', desc: 'Step-by-step fix instructions for each security issue', checked: includeRemediation, onChange: setIncludeRemediation, icon: Shield },
          ].map(t => (
            <div key={t.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <t.icon className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground truncate">{t.desc}</p>
              </div>
              <Switch checked={t.checked} onCheckedChange={t.onChange} />
            </div>
          ))}
        </div>

        <button onClick={handleDownloadPDF} disabled={generating || !selectedOrg}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:brightness-110 transition-all disabled:opacity-50">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? 'Generating PDF...' : 'Download PDF Report'}
        </button>
      </div>

      {/* Preview with real monitoring data */}
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

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Alerts', value: preview.alerts.length },
                { label: 'Open Alerts', value: openAlerts },
                { label: 'EW Checks', value: preview.ewCount },
                { label: 'Uptime Logs', value: preview.uptimeCount },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold font-mono text-primary capitalize">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Security Posture Preview */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Security Posture</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <CheckStatusBadge
                  status={preview.ssl ? (preview.ssl.is_valid && !preview.ssl.is_expired ? 'pass' : 'fail') : 'none'}
                  label={preview.ssl ? `SSL: ${preview.ssl.is_valid ? 'Valid' : 'Invalid'}${preview.ssl.days_until_expiry ? ` (${preview.ssl.days_until_expiry}d)` : ''}` : 'SSL: No data'}
                />
                <CheckStatusBadge
                  status={preview.uptimePct !== null ? (preview.uptimePct >= 95 ? 'pass' : preview.uptimePct >= 80 ? 'warn' : 'fail') : 'none'}
                  label={preview.uptimePct !== null ? `Uptime: ${preview.uptimePct}%` : 'Uptime: No data'}
                />
                <CheckStatusBadge
                  status={preview.ddos ? (preview.ddos.has_cdn && preview.ddos.has_waf ? 'pass' : preview.ddos.has_cdn || preview.ddos.has_waf ? 'warn' : 'fail') : 'none'}
                  label={preview.ddos ? `DDoS: ${[preview.ddos.has_cdn && 'CDN', preview.ddos.has_waf && 'WAF', preview.ddos.has_rate_limiting && 'RL'].filter(Boolean).join('+') || 'None'}` : 'DDoS: No data'}
                />
                {['security_headers', 'email_security', 'open_ports', 'defacement', 'dns', 'blacklist'].map(ct => {
                  const log = preview.ewByType[ct];
                  const labels: Record<string, string> = { security_headers: 'Headers', email_security: 'Email', open_ports: 'Ports', defacement: 'Defacement', dns: 'DNS', blacklist: 'Blacklist' };
                  let detail = 'No data';
                  let status: 'pass' | 'warn' | 'fail' | 'none' = 'none';
                  if (log) {
                    status = log.risk_level === 'safe' ? 'pass' : log.risk_level === 'warning' ? 'warn' : 'fail';
                    if (ct === 'security_headers') detail = `Grade ${(log.details as any)?.grade || '?'}`;
                    else if (ct === 'email_security') {
                      const es = (log.details as any)?.emailSecurity;
                      detail = es ? [es.spfExists && 'SPF', es.dmarcExists && 'DMARC', es.dkimFound && 'DKIM'].filter(Boolean).join('+') || 'None' : log.risk_level;
                    }
                    else detail = log.risk_level.charAt(0).toUpperCase() + log.risk_level.slice(1);
                  }
                  return <CheckStatusBadge key={ct} status={status} label={`${labels[ct]}: ${detail}`} />;
                })}
              </div>
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
