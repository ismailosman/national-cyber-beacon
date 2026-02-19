import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2, AlertTriangle, ShieldAlert, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, subDays } from 'date-fns';
import CircularGauge from '@/components/dashboard/CircularGauge';
import StatCard from '@/components/dashboard/StatCard';
import AlertSidebar from '@/components/dashboard/AlertSidebar';

const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('*').order('name');
      return data || [];
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['active-alerts'],
    queryFn: async () => {
      const { data } = await supabase.from('alerts').select('*').eq('is_read', false);
      return data || [];
    },
  });

  const { data: scoreHistory = [] } = useQuery({
    queryKey: ['score-history-all'],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data } = await supabase
        .from('risk_score_history')
        .select('score, recorded_at')
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true });

      // Group by day and average
      const grouped: Record<string, number[]> = {};
      (data || []).forEach((r: any) => {
        const day = format(new Date(r.recorded_at), 'MMM dd');
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(r.score);
      });

      return Object.entries(grouped).map(([day, scores]) => ({
        day,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }));
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    const ch1 = supabase.channel('orgs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['organizations'] });
      })
      .subscribe();

    const ch2 = supabase.channel('alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
        queryClient.invalidateQueries({ queryKey: ['alerts-sidebar'] });
      })
      .subscribe();

    return () => {
      ch1.unsubscribe();
      ch2.unsubscribe();
    };
  }, [queryClient]);

  const avgScore = orgs.length
    ? Math.round(orgs.reduce((a: number, o: any) => a + o.risk_score, 0) / orgs.length)
    : 0;

  const criticalOrgs = orgs.filter((o: any) => o.status === 'Critical').length;
  const atRiskOrgs = orgs.filter((o: any) => o.status !== 'Secure').length;

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-wide">
          National Cyber Defense Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5 font-mono">
          Real-time security posture monitoring · Somalia
        </p>
      </div>

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* National Score + Stats */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            {/* Gauge */}
            <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center border border-neon-cyan/20 xl:col-span-1">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-4">
                National Security Score
              </p>
              <CircularGauge score={avgScore} />
              <p className="text-xs text-muted-foreground mt-3 font-mono">
                avg across {orgs.length} organizations
              </p>
            </div>

            {/* Stats */}
            <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="Monitored Orgs"
                value={orgs.length}
                subtitle="Government & Banks"
                icon={Building2}
                color="cyan"
              />
              <StatCard
                title="Active Alerts"
                value={alerts.length}
                subtitle="Requires attention"
                icon={AlertTriangle}
                color={alerts.length > 5 ? 'red' : alerts.length > 0 ? 'amber' : 'green'}
                pulse={alerts.length > 0}
              />
              <StatCard
                title="Orgs at Risk"
                value={atRiskOrgs}
                subtitle={`${criticalOrgs} critical`}
                icon={ShieldAlert}
                color={criticalOrgs > 0 ? 'red' : atRiskOrgs > 0 ? 'amber' : 'green'}
              />
            </div>
          </div>

          {/* Trend chart */}
          <div className="glass-card rounded-xl p-5 border border-border">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-neon-cyan" />
              <h2 className="font-semibold text-sm text-foreground">30-Day Risk Score Trend</h2>
              <span className="ml-auto text-xs text-muted-foreground font-mono">National Average</span>
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
                  <Area
                    type="monotone" dataKey="score"
                    stroke="hsl(186 100% 50%)" strokeWidth={2}
                    fill="url(#scoreGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: 'hsl(186 100% 50%)', stroke: 'hsl(216 28% 7%)', strokeWidth: 2 }}
                  />
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

          {/* Organization status table */}
          <div className="glass-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-sm text-foreground">Organization Status Overview</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Organization</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Sector</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Domain</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Score</th>
                    <th className="text-center p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org: any) => (
                    <tr key={org.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="p-3 font-medium">{org.name}</td>
                      <td className="p-3">
                        <span className="text-xs px-2 py-0.5 rounded border font-mono text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5">
                          {org.sector}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">{org.domain}</td>
                      <td className="p-3 text-right">
                        <span className={`font-bold font-mono text-base ${
                          org.risk_score >= 75 ? 'text-neon-green' :
                          org.risk_score >= 50 ? 'text-neon-amber' : 'text-neon-red'
                        }`}>{org.risk_score}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider ${
                          org.status === 'Secure' ? 'bg-neon-green/10 text-neon-green border border-neon-green/30' :
                          org.status === 'Warning' ? 'bg-neon-amber/10 text-neon-amber border border-neon-amber/30' :
                          'bg-neon-red/10 text-neon-red border border-neon-red/30'
                        }`}>{org.status}</span>
                      </td>
                    </tr>
                  ))}
                  {orgs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">
                        No organizations found. Add organizations in Settings.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Alert sidebar - hidden on mobile */}
        <div className="hidden xl:flex h-fit" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          <AlertSidebar />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
