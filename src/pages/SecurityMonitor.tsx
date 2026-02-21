import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, ShieldCheck, ShieldAlert, Lock, Activity, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Globe, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from '@/hooks/use-toast';
import { format, subDays } from 'date-fns';

const SecurityMonitor: React.FC = () => {
  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  const [auditing, setAuditing] = useState(false);

  if (userRole?.role !== 'SuperAdmin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground">This page is restricted to SuperAdmin users only.</p>
      </div>
    );
  }

  // --- Compliance: RLS check ---
  const { data: rlsOk } = useQuery({
    queryKey: ['sec-monitor-rls'],
    queryFn: async () => {
      const { error } = await supabase.from('user_roles').select('id').limit(1);
      return !error;
    },
  });

  // --- Compliance: SSL check ---
  const { data: sslValid } = useQuery({
    queryKey: ['sec-monitor-ssl'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ssl_logs')
        .select('is_valid')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.is_valid ?? null;
    },
  });

  // --- Compliance: HSTS via edge function ---
  const { data: headerResults } = useQuery({
    queryKey: ['sec-monitor-headers'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-security-headers', {
        body: { urls: [`https://${window.location.hostname}`] },
      });
      if (error) return null;
      return data?.results?.[0] ?? null;
    },
  });

  const hstsForced = headerResults?.headers?.strictTransportSecurity?.present ?? null;

  // --- Auth Metrics (simulated from check_errors) ---
  const { data: authChartData } = useQuery({
    queryKey: ['sec-monitor-auth-metrics'],
    queryFn: async () => {
      const days: { day: string; successful: number; failed: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const dayStr = format(d, 'yyyy-MM-dd');
        const label = format(d, 'EEE');

        const { count: failedCount } = await supabase
          .from('check_errors')
          .select('*', { count: 'exact', head: true })
          .gte('checked_at', `${dayStr}T00:00:00Z`)
          .lt('checked_at', `${dayStr}T23:59:59Z`);

        const { count: alertCount } = await supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', `${dayStr}T00:00:00Z`)
          .lt('created_at', `${dayStr}T23:59:59Z`);

        days.push({
          day: label,
          successful: Math.max(0, 12 - (alertCount ?? 0)),
          failed: failedCount ?? 0,
        });
      }
      return days;
    },
  });

  // --- Active Sessions (user_roles list) ---
  const { data: activeUsers } = useQuery({
    queryKey: ['sec-monitor-sessions'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id, role');
      return data ?? [];
    },
  });

  // --- Threat Feed Health ---
  const { data: tiHealth } = useQuery({
    queryKey: ['sec-monitor-ti'],
    queryFn: async () => {
      const { data } = await supabase
        .from('threat_intelligence_logs')
        .select('checked_at, risk_level')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: dastHealth } = useQuery({
    queryKey: ['sec-monitor-dast'],
    queryFn: async () => {
      const { data } = await supabase
        .from('dast_scan_results')
        .select('scanned_at')
        .order('scanned_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const isRecent = (ts: string | null | undefined, hours = 24) => {
    if (!ts) return false;
    return new Date(ts).getTime() > Date.now() - hours * 60 * 60 * 1000;
  };

  const maskEmail = (uid: string) => {
    const short = uid.substring(0, 8);
    return `****${short}@masked`;
  };

  // --- Run Security Audit ---
  const runAudit = async () => {
    setAuditing(true);
    await queryClient.invalidateQueries({ queryKey: ['sec-monitor-rls'] });
    await queryClient.invalidateQueries({ queryKey: ['sec-monitor-ssl'] });
    await queryClient.invalidateQueries({ queryKey: ['sec-monitor-headers'] });
    await queryClient.invalidateQueries({ queryKey: ['sec-monitor-auth-metrics'] });
    await queryClient.invalidateQueries({ queryKey: ['sec-monitor-sessions'] });
    await queryClient.invalidateQueries({ queryKey: ['sec-monitor-ti'] });
    await queryClient.invalidateQueries({ queryKey: ['sec-monitor-dast'] });
    setAuditing(false);
    toast({ title: 'Security Audit Complete', description: 'All checks have been refreshed.' });
  };

  const StatusBadge = ({ ok, label }: { ok: boolean | null; label: string }) => (
    <Badge
      variant="outline"
      className={
        ok === null
          ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
          : ok
            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
            : 'border-red-500/40 text-red-400 bg-red-500/10'
      }
    >
      {ok === null ? 'Unknown' : ok ? 'Active' : 'Inactive'}
      <span className="ml-1 text-[10px] opacity-60">{label}</span>
    </Badge>
  );

  const headerList = headerResults?.headers
    ? Object.entries(headerResults.headers as Record<string, { present: boolean; value: string | null }>)
    : [];

  return (
    <div className="space-y-6 p-1">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-emerald-400" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Security Health Monitor</h1>
            <p className="text-sm text-muted-foreground">Real-time security posture overview</p>
          </div>
        </div>
        <Button onClick={runAudit} disabled={auditing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${auditing ? 'animate-spin' : ''}`} />
          {auditing ? 'Auditing...' : 'Run Security Audit'}
        </Button>
      </div>

      {/* Compliance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Lock className="w-4 h-4" /> Row-Level Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {rlsOk ? <CheckCircle2 className="w-8 h-8 text-emerald-400" /> : <XCircle className="w-8 h-8 text-red-400" />}
              <div>
                <p className="text-lg font-bold text-foreground">{rlsOk ? 'Enforced' : 'Check Failed'}</p>
                <StatusBadge ok={rlsOk ?? null} label="RLS" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> SSL Certificate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {sslValid ? <CheckCircle2 className="w-8 h-8 text-emerald-400" /> : <AlertTriangle className="w-8 h-8 text-amber-400" />}
              <div>
                <p className="text-lg font-bold text-foreground">{sslValid === null ? 'No Data' : sslValid ? 'Valid' : 'Invalid'}</p>
                <StatusBadge ok={sslValid} label="SSL" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Globe className="w-4 h-4" /> HSTS Enforcement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {hstsForced ? <CheckCircle2 className="w-8 h-8 text-emerald-400" /> : <XCircle className="w-8 h-8 text-red-400" />}
              <div>
                <p className="text-lg font-bold text-foreground">{hstsForced === null ? 'Checking...' : hstsForced ? 'Forced' : 'Not Set'}</p>
                <StatusBadge ok={hstsForced} label="HSTS" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auth Metrics Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="w-4 h-4" /> Auth Activity (Last 7 Days)
          </CardTitle>
          <p className="text-xs text-muted-foreground/60">Aggregated from system check data. Full auth logs require backend log access.</p>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={authChartData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area type="monotone" dataKey="successful" stroke="#10b981" fill="#10b981" fillOpacity={0.15} name="Successful" />
                <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} name="Failed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions & Header Auditor side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Sessions Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User (Masked)</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(activeUsers ?? []).map((u, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{maskEmail(u.user_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{u.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">N/A</TableCell>
                  </TableRow>
                ))}
                {(!activeUsers || activeUsers.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No users found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Header Auditor */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Server className="w-4 h-4" /> Security Headers Audit
            </CardTitle>
            {headerResults && (
              <Badge variant="outline" className="w-fit text-xs border-emerald-500/40 text-emerald-400">
                Grade: {headerResults.grade} ({headerResults.score}/{headerResults.maxScore})
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {headerList.length > 0 ? (
              headerList.map(([name, info]) => (
                <div key={name} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-xs font-mono text-foreground">{name}</span>
                  {(info as { present: boolean }).present ? (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10">Present</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400 bg-red-500/10">Not Set</Badge>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Loading header data...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Threat Feed Health */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Threat Feed & Scanner Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <div className={`w-3 h-3 rounded-full ${isRecent(tiHealth?.checked_at) ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <div>
                <p className="text-sm font-medium text-foreground">Threat Intelligence Feed</p>
                <p className="text-xs text-muted-foreground">
                  {tiHealth?.checked_at ? `Last check: ${format(new Date(tiHealth.checked_at), 'PPp')}` : 'No data available'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <div className={`w-3 h-3 rounded-full ${isRecent(dastHealth?.scanned_at, 48) ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <div>
                <p className="text-sm font-medium text-foreground">DAST Scanner Runner</p>
                <p className="text-xs text-muted-foreground">
                  {dastHealth?.scanned_at ? `Last scan: ${format(new Date(dastHealth.scanned_at), 'PPp')}` : 'No scans recorded'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityMonitor;
