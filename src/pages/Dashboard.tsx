import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2, AlertTriangle, ShieldAlert, TrendingUp, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, subDays } from 'date-fns';
import CircularGauge from '@/components/dashboard/CircularGauge';
import StatCard from '@/components/dashboard/StatCard';
import AlertSidebar from '@/components/dashboard/AlertSidebar';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('*').order('risk_score', { ascending: true });
      return data || [];
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['active-alerts'],
    queryFn: async () => {
      const { data } = await supabase.from('alerts').select('*').eq('status', 'open').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: scoreHistory = [] } = useQuery({
    queryKey: ['score-history-all'],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data } = await supabase
        .from('risk_history')
        .select('score, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      const grouped: Record<string, number[]> = {};
      (data || []).forEach((r: any) => {
        const day = format(new Date(r.created_at), 'MMM dd');
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(r.score);
      });

      return Object.entries(grouped).map(([day, scores]) => ({
        day,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }));
    },
  });

  const { data: threatEvents = [] } = useQuery({
    queryKey: ['threat-events-recent'],
    queryFn: async () => {
      const since = subDays(new Date(), 1).toISOString();
      const { data } = await supabase.from('threat_events').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(20);
      return data || [];
    },
  });

  // Realtime
  useEffect(() => {
    const ch1 = supabase.channel('orgs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['organizations'] });
      }).subscribe();

    const ch2 = supabase.channel('alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
        queryClient.invalidateQueries({ queryKey: ['alerts-sidebar'] });
      }).subscribe();

    const ch3 = supabase.channel('threats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threat_events' }, () => {
        queryClient.invalidateQueries({ queryKey: ['threat-events-recent'] });
      }).subscribe();

    return () => { ch1.unsubscribe(); ch2.unsubscribe(); ch3.unsubscribe(); };
  }, [queryClient]);

  const avgScore = orgs.length
    ? Math.round(orgs.reduce((a: number, o: any) => a + o.risk_score, 0) / orgs.length)
    : 0;

  const criticalOrgs = (orgs as any[]).filter((o) => o.status === 'Critical').length;
  const atRiskOrgs = (orgs as any[]).filter((o) => o.status !== 'Secure').length;

  // Top 5 critical orgs
  const topCritical = (orgs as any[]).slice(0, 5);

  const severityCounts = {
    critical: (alerts as any[]).filter(a => a.severity === 'critical').length,
    high: (alerts as any[]).filter(a => a.severity === 'high').length,
    medium: (alerts as any[]).filter(a => a.severity === 'medium').length,
    low: (alerts as any[]).filter(a => a.severity === 'low').length,
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card rounded-lg p-3 border border-neon-cyan/30 text-xs">
          <p className="text-muted-foreground font-mono">{label}</p>
          <p className="text-neon-cyan font-bold mt-1">Score: {payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-wide">
            National Cyber Defense Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5 font-mono">
            Somalia · Real-time security posture monitoring
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Activity className="w-3.5 h-3.5 text-neon-green" />
          <span className="text-neon-green">{threatEvents.length} threats</span>
          <span>in last 24h</span>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 space-y-6 min-w-0">
          {/* National Score + Stats */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center border border-neon-cyan/20 xl:col-span-1">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-4">National Score</p>
              <CircularGauge score={avgScore} />
              <p className="text-xs text-muted-foreground mt-3 font-mono">avg · {orgs.length} orgs</p>
            </div>
            <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard title="Monitored Orgs" value={orgs.length} subtitle="Gov't & Banks" icon={Building2} color="cyan" />
              <StatCard title="Open Alerts" value={alerts.length} subtitle={`${severityCounts.critical} critical · ${severityCounts.high} high`} icon={AlertTriangle} color={severityCounts.critical > 0 ? 'red' : alerts.length > 0 ? 'amber' : 'green'} pulse={alerts.length > 0} />
              <StatCard title="At Risk" value={atRiskOrgs} subtitle={`${criticalOrgs} critical status`} icon={ShieldAlert} color={criticalOrgs > 0 ? 'red' : atRiskOrgs > 0 ? 'amber' : 'green'} />
            </div>
          </div>

          {/* Alert severity breakdown */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Critical', count: severityCounts.critical, color: 'text-neon-red', bg: 'bg-neon-red/10 border-neon-red/20' },
              { label: 'High', count: severityCounts.high, color: 'text-neon-red', bg: 'bg-neon-red/5 border-neon-red/10' },
              { label: 'Medium', count: severityCounts.medium, color: 'text-neon-amber', bg: 'bg-neon-amber/10 border-neon-amber/20' },
              { label: 'Low', count: severityCounts.low, color: 'text-neon-cyan', bg: 'bg-neon-cyan/5 border-neon-cyan/10' },
            ].map(s => (
              <div key={s.label} className={cn('glass-card rounded-xl p-4 border text-center', s.bg)}>
                <p className={cn('text-2xl font-bold font-mono', s.color)}>{s.count}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Trend chart */}
          <div className="glass-card rounded-xl p-5 border border-border">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-neon-cyan" />
              <h2 className="font-semibold text-sm text-foreground">30-Day National Risk Trend</h2>
              <span className="ml-auto text-xs text-muted-foreground font-mono">Average Score</span>
            </div>
            {scoreHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={scoreHistory} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(186 100% 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(186 100% 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 28% 16%)" />
                  <XAxis dataKey="day" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="score" stroke="hsl(186 100% 50%)" strokeWidth={2} fill="url(#scoreGrad)" dot={false} activeDot={{ r: 4, fill: 'hsl(186 100% 50%)', stroke: 'hsl(216 28% 7%)', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                <div className="text-center">
                  <p>No trend data yet.</p>
                  <p className="text-xs mt-1">Run a scan to populate score history.</p>
                </div>
              </div>
            )}
          </div>

          {/* Top critical orgs */}
          <div className="glass-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-neon-red" />
              <h2 className="font-semibold text-sm text-foreground">Organization Risk Overview</h2>
              <Link to="/organizations" className="ml-auto text-xs text-neon-cyan hover:underline">View all →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Organization</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider hidden sm:table-cell">Sector</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider hidden md:table-cell">Region</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Score</th>
                    <th className="text-center p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topCritical.map((org: any) => (
                    <tr key={org.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer">
                      <td className="p-3">
                        <Link to={`/organizations/${org.id}`} className="font-medium hover:text-neon-cyan transition-colors">{org.name}</Link>
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <span className="text-xs px-2 py-0.5 rounded border font-mono text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5 capitalize">{org.sector}</span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs hidden md:table-cell">{org.region}</td>
                      <td className="p-3 text-right">
                        <span className={cn('font-bold font-mono text-base',
                          org.risk_score >= 75 ? 'text-neon-green' :
                          org.risk_score >= 50 ? 'text-neon-amber' : 'text-neon-red'
                        )}>{org.risk_score}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={cn('text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider',
                          org.status === 'Secure' ? 'bg-neon-green/10 text-neon-green border border-neon-green/30' :
                          org.status === 'Warning' ? 'bg-neon-amber/10 text-neon-amber border border-neon-amber/30' :
                          'bg-neon-red/10 text-neon-red border border-neon-red/30'
                        )}>{org.status}</span>
                      </td>
                    </tr>
                  ))}
                  {orgs.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">No organizations. Add some in Admin settings.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Alert sidebar */}
        <div className="hidden xl:flex h-fit" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          <AlertSidebar />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
