import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import { Activity, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateSecurityScore, ScoreBreakdown } from '@/lib/dashboard/calculateScore';
import { snapshotDailyScores } from '@/lib/dashboard/snapshotScores';

import TopStatsBar from '@/components/dashboard/TopStatsBar';
import OrgScoresBarChart from '@/components/dashboard/OrgScoresBarChart';
import ThreatDonutChart from '@/components/dashboard/ThreatDonutChart';
import ScoreTrendChart from '@/components/dashboard/ScoreTrendChart';
import ThreatTimelineChart from '@/components/dashboard/ThreatTimelineChart';
import OrgCard from '@/components/dashboard/OrgCard';
import SectorComparison from '@/components/dashboard/SectorComparison';
import RiskHeatMap from '@/components/dashboard/RiskHeatMap';
import AlertSidebar from '@/components/dashboard/AlertSidebar';
import { TopStatsBarSkeleton, BarChartSkeleton, DonutChartSkeleton, TrendChartSkeleton, OrgGridSkeleton, HeatMapSkeleton } from '@/components/dashboard/DashboardSkeletons';

const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 min

const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('score-desc');

  // Snapshot daily scores on mount
  useEffect(() => { snapshotDailyScores().catch(console.error); }, []);

  // ── Data queries ──────────────────────────────────────────────────────

  const { data: monitoredOrgs = [], isLoading: loadingOrgs } = useQuery({
    queryKey: ['dashboard-monitored-orgs'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations_monitored').select('*').eq('is_active', true);
      return data || [];
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const { data: orgScores = [], isLoading: loadingScores } = useQuery({
    queryKey: ['dashboard-org-scores', monitoredOrgs.length],
    queryFn: async () => {
      if (monitoredOrgs.length === 0) return [];
      const results = [];
      for (const org of monitoredOrgs) {
        try {
          const score = await calculateSecurityScore(org.id);
          results.push({ id: org.id, name: org.name, sector: org.sector, url: org.url, ...score });
        } catch { results.push({ id: org.id, name: org.name, sector: org.sector, url: org.url, total: 0 } as any); }
      }
      setLastUpdated(new Date());
      return results;
    },
    enabled: monitoredOrgs.length > 0,
    refetchInterval: REFETCH_INTERVAL,
  });

  // SSL summary
  const { data: sslSummary = { valid: 0, total: 0 } } = useQuery({
    queryKey: ['dashboard-ssl-summary'],
    queryFn: async () => {
      const { data } = await supabase.from('ssl_logs').select('organization_id, is_valid')
        .order('checked_at', { ascending: false });
      if (!data) return { valid: 0, total: 0 };
      const latest = new Map<string, boolean>();
      data.forEach(r => { if (!latest.has(r.organization_id!)) latest.set(r.organization_id!, r.is_valid); });
      return { valid: [...latest.values()].filter(Boolean).length, total: latest.size };
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Uptime rate
  const { data: uptimeRate = 0 } = useQuery({
    queryKey: ['dashboard-uptime-rate'],
    queryFn: async () => {
      const { data } = await supabase.from('uptime_logs').select('status')
        .order('checked_at', { ascending: false }).limit(500);
      if (!data || data.length === 0) return 0;
      return Math.round((data.filter(u => u.status === 'up').length / data.length) * 1000) / 10;
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Alerts
  const { data: alerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: async () => {
      const { data } = await supabase.from('alerts').select('*').eq('status', 'open').order('created_at', { ascending: false });
      return data || [];
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Early warning logs for threats
  const { data: earlyWarnings = [] } = useQuery({
    queryKey: ['dashboard-early-warnings'],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data } = await supabase.from('early_warning_logs').select('id, risk_level, checked_at, check_type, organization_id, details')
        .gte('checked_at', since);
      return data || [];
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Security score history for trends
  const { data: scoreHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['dashboard-score-history'],
    queryFn: async () => {
      const { data } = await supabase.from('security_score_history').select('*')
        .order('recorded_date', { ascending: true });
      return data || [];
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // DDoS logs for WAF/CDN info
  const { data: ddosLogs = [] } = useQuery({
    queryKey: ['dashboard-ddos-logs'],
    queryFn: async () => {
      const { data } = await supabase.from('ddos_risk_logs').select('organization_id, has_cdn, has_waf')
        .order('checked_at', { ascending: false });
      return data || [];
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // DAST results
  const { data: dastResults = [] } = useQuery({
    queryKey: ['dashboard-dast-results'],
    queryFn: async () => {
      const { data } = await supabase.from('dast_scan_results').select('organization_id, dast_score, summary, scanned_at')
        .order('scanned_at', { ascending: false });
      return data || [];
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Realtime subscriptions
  useEffect(() => {
    const channels = [
      supabase.channel('dash-orgs').on('postgres_changes', { event: '*', schema: 'public', table: 'organizations_monitored' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-monitored-orgs'] });
      }).subscribe(),
      supabase.channel('dash-alerts').on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
      }).subscribe(),
      supabase.channel('dash-history').on('postgres_changes', { event: '*', schema: 'public', table: 'security_score_history' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-score-history'] });
      }).subscribe(),
    ];
    return () => { channels.forEach(ch => ch.unsubscribe()); };
  }, [queryClient]);

  // ── Computed data ─────────────────────────────────────────────────────

  const avgScore = orgScores.length > 0
    ? Math.round(orgScores.reduce((a, o) => a + (o.total || 0), 0) / orgScores.length) : 0;

  const severityCounts = useMemo(() => ({
    critical: alerts.filter((a: any) => a.severity === 'critical').length,
    high: alerts.filter((a: any) => a.severity === 'high').length,
    medium: alerts.filter((a: any) => a.severity === 'medium').length,
    low: alerts.filter((a: any) => a.severity === 'low').length,
  }), [alerts]);

  // Bar chart data
  const barChartData = useMemo(() =>
    orgScores.map(o => ({
      id: o.id, name: o.name, sector: o.sector, score: o.total || 0,
      sslValid: o.sslValid, uptimePercent: o.uptimePercent, threatsCount: o.threatsCount,
    })), [orgScores]);

  // Score trend data
  const trendData = useMemo(() => {
    const grouped: Record<string, { scores: number[]; sectors: Record<string, number[]> }> = {};
    (scoreHistory as any[]).forEach(r => {
      const day = format(new Date(r.recorded_date), 'MMM dd');
      if (!grouped[day]) grouped[day] = { scores: [], sectors: {} };
      grouped[day].scores.push(r.security_score);
      if (!grouped[day].sectors[r.sector]) grouped[day].sectors[r.sector] = [];
      grouped[day].sectors[r.sector].push(r.security_score);
    });
    return Object.entries(grouped).map(([day, g]) => {
      const sectorAvgs = Object.values(g.sectors).map(scores => scores.reduce((a, b) => a + b, 0) / scores.length);
      return {
        day,
        avg: Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length),
        best: Math.round(Math.max(...sectorAvgs, 0)),
        worst: Math.round(Math.min(...sectorAvgs, 100)),
      };
    });
  }, [scoreHistory]);

  // Threat timeline data
  const threatTimeline = useMemo(() => {
    const days: Record<string, { critical: number; high: number; medium: number; low: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'MMM dd');
      days[d] = { critical: 0, high: 0, medium: 0, low: 0 };
    }
    earlyWarnings.forEach((w: any) => {
      const day = format(new Date(w.checked_at), 'MMM dd');
      if (days[day]) {
        const level = w.risk_level === 'critical' ? 'critical' : w.risk_level === 'high' ? 'high' :
          w.risk_level === 'medium' || w.risk_level === 'warning' ? 'medium' : 'low';
        days[day][level]++;
      }
    });
    alerts.forEach((a: any) => {
      const day = format(new Date(a.created_at), 'MMM dd');
      if (days[day] && a.severity) days[day][a.severity as keyof typeof days[string]]++;
    });
    return Object.entries(days).map(([day, counts]) => ({ day, ...counts }));
  }, [earlyWarnings, alerts]);

  // Org cards data
  const orgCardsData = useMemo(() => {
    const latestDdos = new Map<string, any>();
    ddosLogs.forEach((d: any) => { if (!latestDdos.has(d.organization_id)) latestDdos.set(d.organization_id, d); });
    const latestDast = new Map<string, any>();
    dastResults.forEach((d: any) => { if (!latestDast.has(d.organization_id)) latestDast.set(d.organization_id, d); });

    return orgScores.map(org => {
      const sparkData = (scoreHistory as any[])
        .filter(h => h.organization_id === org.id)
        .slice(-14)
        .map(h => ({ score: h.security_score }));
      const ddos = latestDdos.get(org.id);
      const dastEntry = latestDast.get(org.id);
      const dastScore = dastEntry?.dast_score;
      const grade = dastScore !== undefined
        ? dastScore >= 90 ? 'A' : dastScore >= 75 ? 'B' : dastScore >= 60 ? 'C' : dastScore >= 40 ? 'D' : 'F'
        : undefined;
      const dastSummary = dastEntry?.summary as { critical?: number; high?: number; medium?: number; low?: number; passed?: number } | undefined;
      const dastScannedAt = dastEntry?.scanned_at as string | undefined;

      return {
        id: org.id, name: org.name, domain: org.url || '', sector: org.sector,
        score: org.total || 0, sslValid: org.sslValid || false, sslDaysLeft: null,
        uptimePercent: org.uptimePercent || 0, threatsCount: org.threatsCount || 0,
        dastGrade: grade, dastSummary, dastScannedAt, sparkline: sparkData,
        checks: {
          headers: (org.headersCount || 0) >= 3,
          ports: !org.portsExposed,
          email: org.emailAuth || false,
          dns: true,
          waf: ddos?.has_waf || ddos?.has_cdn || false,
        },
      };
    });
  }, [orgScores, scoreHistory, ddosLogs, dastResults]);

  // Apply sort and filter
  const filteredCards = useMemo(() => {
    let cards = sectorFilter ? orgCardsData.filter(c => c.sector.toLowerCase() === sectorFilter.toLowerCase()) : orgCardsData;
    switch (sortBy) {
      case 'score-asc': return [...cards].sort((a, b) => a.score - b.score);
      case 'name': return [...cards].sort((a, b) => a.name.localeCompare(b.name));
      case 'threats': return [...cards].sort((a, b) => b.threatsCount - a.threatsCount);
      default: return [...cards].sort((a, b) => b.score - a.score);
    }
  }, [orgCardsData, sectorFilter, sortBy]);

  // Sector comparison data
  const sectorData = useMemo(() => {
    const sectors: Record<string, any[]> = {};
    orgCardsData.forEach(o => {
      if (!sectors[o.sector]) sectors[o.sector] = [];
      sectors[o.sector].push(o);
    });
    return Object.entries(sectors).map(([sector, orgs]) => ({
      sector,
      orgCount: orgs.length,
      avgScore: Math.round(orgs.reduce((a, o) => a + o.score, 0) / orgs.length),
      sslValid: orgs.filter(o => o.sslValid).length,
      sslTotal: orgs.length,
      uptimeAvg: orgs.reduce((a, o) => a + o.uptimePercent, 0) / orgs.length,
      threatsCount: orgs.reduce((a, o) => a + o.threatsCount, 0),
      trend: 'stable' as 'up' | 'down' | 'stable',
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [orgCardsData]);

  // Heat map data
  const heatMapData = useMemo(() => {
    return orgCardsData.map(org => {
      const ssl: 'green' | 'yellow' | 'red' = org.sslValid ? 'green' : 'red';
      const uptime: 'green' | 'yellow' | 'red' = org.uptimePercent >= 99 ? 'green' : org.uptimePercent >= 95 ? 'yellow' : 'red';
      const headers: 'green' | 'yellow' | 'red' = org.checks.headers ? 'green' : 'red';
      const ports: 'green' | 'yellow' | 'red' = org.checks.ports ? 'green' : 'red';
      const email: 'green' | 'yellow' | 'red' = org.checks.email ? 'green' : 'red';
      const dns: 'green' | 'yellow' | 'red' = org.checks.dns ? 'green' : 'yellow';
      const waf: 'green' | 'yellow' | 'red' = org.checks.waf ? 'green' : 'red';
      const dast: 'green' | 'yellow' | 'red' = org.dastGrade === 'A' || org.dastGrade === 'B' ? 'green'
        : org.dastGrade === 'C' ? 'yellow' : org.dastGrade ? 'red' : 'unknown' as any;

      return {
        id: org.id, name: org.name, ssl, uptime, headers, ports, email, dns, waf, dast,
        details: {
          ssl: org.sslValid ? 'Valid' : 'Invalid/Missing',
          uptime: `${org.uptimePercent.toFixed(1)}%`,
          headers: org.checks.headers ? 'Sufficient headers' : 'Insufficient headers',
          ports: org.checks.ports ? 'No exposed ports' : 'Exposed ports detected',
          email: org.checks.email ? 'SPF/DMARC present' : 'Missing email auth',
          dns: 'DNS check',
          waf: org.checks.waf ? 'CDN/WAF present' : 'No WAF detected',
          dast: org.dastGrade ? `Grade ${org.dastGrade}` : 'Not scanned',
        },
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [orgCardsData]);

  const isInitialLoad = loadingOrgs || loadingScores;
  const minutesAgo = Math.round((Date.now() - lastUpdated.getTime()) / 60000);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-wide">National Cyber Defense Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5 font-mono">Somalia · Real-time security posture monitoring</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Updated {minutesAgo < 1 ? 'just now' : `${minutesAgo}m ago`}
          </span>
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-neon-green" />
            <span className="text-neon-green">{monitoredOrgs.length} orgs</span>
          </span>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 space-y-6 min-w-0">
          {/* Section 1: Top Stats */}
          {isInitialLoad ? <TopStatsBarSkeleton /> : (
            <TopStatsBar
              orgCount={monitoredOrgs.length}
              uptimeRate={uptimeRate}
              sslValid={sslSummary.valid}
              sslTotal={sslSummary.total}
              avgScore={avgScore}
              activeAlerts={alerts.length}
              criticalAlerts={severityCounts.critical}
            />
          )}

          {/* Section 2: Main Charts Row */}
          {isInitialLoad ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3"><BarChartSkeleton /></div>
              <div className="lg:col-span-2"><DonutChartSkeleton /></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3">
                <OrgScoresBarChart data={barChartData} />
              </div>
              <div className="lg:col-span-2">
                <ThreatDonutChart
                  critical={severityCounts.critical}
                  high={severityCounts.high}
                  medium={severityCounts.medium}
                  low={severityCounts.low}
                />
              </div>
            </div>
          )}

          {/* Section 3: Trend Charts Row */}
          {loadingHistory ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TrendChartSkeleton />
              <TrendChartSkeleton />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ScoreTrendChart data={trendData} />
              <ThreatTimelineChart data={threatTimeline} />
            </div>
          )}

          {/* Section 4: Organization Grid */}
          {isInitialLoad ? <OrgGridSkeleton /> : (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="font-semibold text-sm text-foreground">Organization Security Overview</h2>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex gap-1">
                    {['All', 'Government', 'Bank', 'Telecom', 'Education', 'Health'].map(s => (
                      <button key={s} onClick={() => setSectorFilter(s === 'All' ? null : s)}
                        className={cn('px-2 py-0.5 rounded text-[10px] font-mono transition-colors border',
                          (s === 'All' && !sectorFilter) || sectorFilter?.toLowerCase() === s.toLowerCase()
                            ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40'
                            : 'bg-transparent text-muted-foreground border-border hover:border-neon-cyan/20'
                        )}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    className="text-[10px] font-mono bg-accent border border-border rounded px-2 py-0.5 text-muted-foreground">
                    <option value="score-desc">Score ↓</option>
                    <option value="score-asc">Score ↑</option>
                    <option value="name">Name</option>
                    <option value="threats">Threats</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCards.map(card => (
                  <OrgCard key={card.id} {...card} />
                ))}
                {filteredCards.length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground text-sm py-8">
                    No organizations found.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sector Comparison */}
          {!isInitialLoad && <SectorComparison data={sectorData} onSectorClick={s => setSectorFilter(s)} />}

          {/* Risk Heat Map */}
          {isInitialLoad ? <HeatMapSkeleton /> : <RiskHeatMap data={heatMapData} />}
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
