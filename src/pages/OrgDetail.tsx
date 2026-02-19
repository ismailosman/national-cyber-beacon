import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Play, Shield, Globe, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from 'recharts';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const checkTypeLabels: Record<string, string> = {
  ssl: 'SSL Certificate',
  https: 'HTTPS Enforcement',
  headers: 'Security Headers',
  dns: 'DNS Resolution',
  uptime: 'Uptime Check',
};

const resultConfig = {
  pass: { icon: CheckCircle, color: 'text-neon-green', bg: 'bg-neon-green/10 border-neon-green/30' },
  warn: { icon: AlertTriangle, color: 'text-neon-amber', bg: 'bg-neon-amber/10 border-neon-amber/30' },
  fail: { icon: XCircle, color: 'text-neon-red', bg: 'bg-neon-red/10 border-neon-red/30' },
};

const OrgDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);

  const { data: org } = useQuery({
    queryKey: ['org', id],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('*').eq('id', id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: checks = [] } = useQuery({
    queryKey: ['security-checks', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('security_checks')
        .select('*')
        .eq('org_id', id!)
        .order('checked_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: orgAlerts = [] } = useQuery({
    queryKey: ['org-alerts', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('org_id', id!)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: scoreHistory = [] } = useQuery({
    queryKey: ['org-score-history', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('risk_score_history')
        .select('score, recorded_at')
        .eq('org_id', id!)
        .order('recorded_at', { ascending: false })
        .limit(6);
      return (data || []).reverse();
    },
    enabled: !!id,
  });

  const handleRunScan = async () => {
    if (!org) return;
    setScanning(true);
    try {
      const { error } = await supabase.functions.invoke('run-security-checks', {
        body: { org_id: id },
      });
      if (error) throw error;
      toast.success('Scan completed successfully');
      queryClient.invalidateQueries({ queryKey: ['org', id] });
      queryClient.invalidateQueries({ queryKey: ['security-checks', id] });
      queryClient.invalidateQueries({ queryKey: ['org-alerts', id] });
    } catch (err: any) {
      toast.error('Scan failed: ' + (err.message || 'Unknown error'));
    } finally {
      setScanning(false);
    }
  };

  // Radar data from score history or current score
  const radarData = [
    { subject: 'TLS', value: checks.find((c: any) => c.check_type === 'ssl')?.result === 'pass' ? 85 : checks.find((c: any) => c.check_type === 'ssl')?.result === 'warn' ? 50 : 20 },
    { subject: 'Headers', value: checks.find((c: any) => c.check_type === 'headers')?.result === 'pass' ? 85 : checks.find((c: any) => c.check_type === 'headers')?.result === 'warn' ? 50 : 20 },
    { subject: 'Uptime', value: checks.find((c: any) => c.check_type === 'uptime')?.result === 'pass' ? 90 : 20 },
    { subject: 'HTTPS', value: checks.find((c: any) => c.check_type === 'https')?.result === 'pass' ? 80 : 15 },
    { subject: 'DNS', value: checks.find((c: any) => c.check_type === 'dns')?.result === 'pass' ? 88 : 20 },
    { subject: 'Overall', value: org?.risk_score || 50 },
  ];

  if (!org) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="text-center">
        <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p>Loading organization...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/organizations')} className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{org.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Globe className="w-3 h-3 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-mono">{org.domain}</span>
          </div>
        </div>
        <button
          onClick={handleRunScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 bg-neon-cyan text-background font-bold text-sm rounded-lg hover:brightness-110 transition-all disabled:opacity-50 glow-cyan"
        >
          <Play className="w-4 h-4" />
          {scanning ? 'Scanning...' : 'Run Scan Now'}
        </button>
      </div>

      {/* Score + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Security Score Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(216 28% 20%)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 9 }} />
              <Radar name="Score" dataKey="value" stroke="hsl(186 100% 50%)" fill="hsl(186 100% 50%)" fillOpacity={0.15} />
              <Tooltip formatter={(v) => [`${v}`, 'Score']} contentStyle={{ background: 'hsl(216 28% 10%)', border: '1px solid hsl(186 100% 50% / 0.3)', borderRadius: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5 border border-border space-y-3">
          <h3 className="text-sm font-semibold text-foreground mb-4">Organization Details</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1 font-mono uppercase">Sector</p>
              <p className="font-medium">{org.sector}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1 font-mono uppercase">Status</p>
              <span className={cn('text-xs px-2 py-1 rounded font-bold uppercase',
                org.status === 'Secure' ? 'text-neon-green bg-neon-green/10' :
                org.status === 'Warning' ? 'text-neon-amber bg-neon-amber/10' :
                'text-neon-red bg-neon-red/10'
              )}>{org.status}</span>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1 font-mono uppercase">Risk Score</p>
              <p className={cn('text-2xl font-bold font-mono',
                org.risk_score >= 75 ? 'text-neon-green' :
                org.risk_score >= 50 ? 'text-neon-amber' : 'text-neon-red'
              )}>{org.risk_score}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1 font-mono uppercase">Last Scan</p>
              <p className="text-xs font-mono text-foreground">
                {org.last_scanned_at
                  ? format(new Date(org.last_scanned_at), 'MMM dd, HH:mm')
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Checks Table */}
      <div className="glass-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Shield className="w-4 h-4 text-neon-cyan" />
          <h3 className="text-sm font-semibold">Security Check Results</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Check</th>
                <th className="text-center p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Result</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Details</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((chk: any) => {
                const cfg = resultConfig[chk.result as keyof typeof resultConfig] || resultConfig.warn;
                const Icon = cfg.icon;
                return (
                  <tr key={chk.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                    <td className="p-3 font-medium">{checkTypeLabels[chk.check_type] || chk.check_type}</td>
                    <td className="p-3 text-center">
                      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border', cfg.bg, cfg.color)}>
                        <Icon className="w-3 h-3" />
                        {chk.result.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs font-mono max-w-xs truncate">
                      {typeof chk.details === 'object' ? JSON.stringify(chk.details) : chk.details || '-'}
                    </td>
                    <td className="p-3 text-right text-xs text-muted-foreground font-mono">
                      {format(new Date(chk.checked_at), 'MMM dd HH:mm')}
                    </td>
                  </tr>
                );
              })}
              {checks.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground text-sm">
                    No security checks yet. Click "Run Scan Now" to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert history */}
      {orgAlerts.length > 0 && (
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Alert History</h3>
          </div>
          <div className="p-4 space-y-2">
            {orgAlerts.map((alert: any) => (
              <div key={alert.id} className={cn('p-3 rounded-lg border text-sm flex items-start gap-3',
                alert.severity === 'critical' || alert.severity === 'high' ? 'bg-neon-red/5 border-neon-red/20' :
                alert.severity === 'medium' ? 'bg-neon-amber/5 border-neon-amber/20' :
                'bg-neon-cyan/5 border-neon-cyan/20'
              )}>
                <span className={cn('text-xs font-bold uppercase px-1.5 py-0.5 rounded font-mono',
                  alert.severity === 'critical' || alert.severity === 'high' ? 'bg-neon-red/20 text-neon-red' :
                  alert.severity === 'medium' ? 'bg-neon-amber/20 text-neon-amber' :
                  'bg-neon-cyan/20 text-neon-cyan'
                )}>{alert.severity}</span>
                <div className="flex-1">
                  <p className="text-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(alert.created_at), 'MMM dd yyyy, HH:mm')}
                    {alert.is_read && <span className="ml-2 text-neon-green">✓ Read</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgDetail;
