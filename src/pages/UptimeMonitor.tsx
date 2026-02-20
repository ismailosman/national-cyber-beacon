import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Activity, Globe, Wifi, WifiOff, Clock, Plus, Trash2, RefreshCw,
  ExternalLink, ArrowUpDown, Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonitoredOrg {
  id: string;
  name: string;
  url: string;
  sector: string;
  is_active: boolean;
}

interface PingResult {
  url: string;
  status: 'up' | 'down';
  responseTime: number | null;
  statusCode: number | null;
  checkedAt: string;
}

interface OrgStatus extends MonitoredOrg {
  currentStatus: 'up' | 'down' | 'checking' | 'unknown';
  responseTime: number | null;
  statusCode: number | null;
  lastChecked: string | null;
  uptimePercent: number | null;
  recentPings: ('up' | 'down')[];
}

const SECTORS = ['All', 'Government', 'Telecom', 'Banking', 'Education', 'Healthcare'];
const STATUS_FILTERS = ['All', 'Online', 'Offline'];
const PING_INTERVAL = 60;

const sectorColors: Record<string, string> = {
  Government: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Telecom: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Banking: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Education: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Healthcare: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

const UptimeMonitor: React.FC = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<MonitoredOrg[]>([]);
  const [statuses, setStatuses] = useState<Map<string, Omit<OrgStatus, keyof MonitoredOrg>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);
  const [countdown, setCountdown] = useState(PING_INTERVAL);
  const [sectorFilter, setSectorFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'responseTime' | 'uptime'>('name');
  const [addOpen, setAddOpen] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: '', url: '', sector: 'Government' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSuperAdmin = userRole?.role === 'SuperAdmin';

  // Load orgs
  const loadOrgs = useCallback(async () => {
    const { data } = await supabase
      .from('organizations_monitored')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setOrgs(data as MonitoredOrg[]);
    setLoading(false);
  }, []);

  // Load historical uptime data
  const loadUptimeHistory = useCallback(async (orgList: MonitoredOrg[]) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabase
      .from('uptime_logs')
      .select('organization_id, status, checked_at')
      .gte('checked_at', since)
      .order('checked_at', { ascending: false });

    if (!logs) return;

    const map = new Map<string, { ups: number; total: number; recent: ('up' | 'down')[] }>();
    for (const log of logs) {
      const id = log.organization_id;
      if (!id) continue;
      if (!map.has(id)) map.set(id, { ups: 0, total: 0, recent: [] });
      const entry = map.get(id)!;
      entry.total++;
      if (log.status === 'up') entry.ups++;
      if (entry.recent.length < 10) entry.recent.push(log.status as 'up' | 'down');
    }

    setStatuses(prev => {
      const next = new Map(prev);
      for (const org of orgList) {
        const hist = map.get(org.id);
        const existing = next.get(org.id) || {
          currentStatus: 'unknown' as const,
          responseTime: null,
          statusCode: null,
          lastChecked: null,
          uptimePercent: null,
          recentPings: [],
        };
        if (hist) {
          existing.uptimePercent = hist.total > 0 ? (hist.ups / hist.total) * 100 : null;
          existing.recentPings = hist.recent;
        }
        next.set(org.id, existing);
      }
      return next;
    });
  }, []);

  // Ping all orgs
  const pingAll = useCallback(async (orgList?: MonitoredOrg[]) => {
    const list = orgList || orgs;
    if (list.length === 0) return;

    setPinging(true);
    // Set all to checking
    setStatuses(prev => {
      const next = new Map(prev);
      for (const org of list) {
        const existing = next.get(org.id) || {
          currentStatus: 'checking' as const,
          responseTime: null,
          statusCode: null,
          lastChecked: null,
          uptimePercent: null,
          recentPings: [],
        };
        existing.currentStatus = 'checking';
        next.set(org.id, existing);
      }
      return next;
    });

    try {
      const urls = list.map(o => o.url);
      const { data, error } = await supabase.functions.invoke('ping-website', {
        body: { urls },
      });

      if (error || !data?.results) {
        toast({ title: 'Ping failed', description: 'Could not reach the ping service.', variant: 'destructive' });
        setPinging(false);
        return;
      }

      const results: PingResult[] = data.results;
      const urlToResult = new Map(results.map(r => [r.url, r]));

      // Store logs
      const logsToInsert = list.map(org => {
        const r = urlToResult.get(org.url);
        return {
          organization_id: org.id,
          organization_name: org.name,
          url: org.url,
          status: r?.status || 'down',
          status_code: r?.statusCode || null,
          response_time_ms: r?.responseTime || null,
          checked_at: r?.checkedAt || new Date().toISOString(),
        };
      });

      await supabase.from('uptime_logs').insert(logsToInsert);

      // Update statuses
      setStatuses(prev => {
        const next = new Map(prev);
        for (const org of list) {
          const r = urlToResult.get(org.url);
          const existing = next.get(org.id) || {
            currentStatus: 'unknown' as const,
            responseTime: null,
            statusCode: null,
            lastChecked: null,
            uptimePercent: null,
            recentPings: [],
          };
          const prevStatus = existing.currentStatus;
          existing.currentStatus = r?.status || 'down';
          existing.responseTime = r?.responseTime || null;
          existing.statusCode = r?.statusCode || null;
          existing.lastChecked = r?.checkedAt || new Date().toISOString();
          // Prepend to recent pings
          existing.recentPings = [r?.status || 'down', ...existing.recentPings].slice(0, 10);
          // Recalc uptime
          const ups = existing.recentPings.filter(p => p === 'up').length;
          existing.uptimePercent = existing.recentPings.length > 0 ? (ups / existing.recentPings.length) * 100 : null;

          // Alert on transition to down
          if (prevStatus === 'up' && existing.currentStatus === 'down') {
            supabase.from('alerts').insert({
              title: `Website Offline: ${org.name}`,
              description: `${org.url} is not responding. Last status code: ${r?.statusCode || 'timeout'}`,
              severity: 'critical',
              source: 'uptime_monitor',
              status: 'open',
            }).then();
          }

          next.set(org.id, existing);
        }
        return next;
      });
    } catch {
      toast({ title: 'Ping error', description: 'An unexpected error occurred.', variant: 'destructive' });
    }

    setPinging(false);
    setCountdown(PING_INTERVAL);
  }, [orgs, toast]);

  // Init
  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  // After orgs loaded, ping and load history
  useEffect(() => {
    if (orgs.length > 0 && loading === false) {
      loadUptimeHistory(orgs);
      pingAll(orgs);
    }
  }, [orgs.length, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown + auto re-ping
  useEffect(() => {
    if (loading || orgs.length === 0) return;
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          pingAll();
          return PING_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [loading, orgs.length, pingAll]);

  // Add org
  const handleAddOrg = async () => {
    if (!newOrg.name || !newOrg.url) return;
    const { error } = await supabase.from('organizations_monitored').insert({
      name: newOrg.name,
      url: newOrg.url,
      sector: newOrg.sector,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Added', description: `${newOrg.name} added to monitoring.` });
      setNewOrg({ name: '', url: '', sector: 'Government' });
      setAddOpen(false);
      loadOrgs();
    }
  };

  // Remove org
  const handleRemoveOrg = async (id: string, name: string) => {
    const { error } = await supabase.from('organizations_monitored').update({ is_active: false }).eq('id', id);
    if (!error) {
      toast({ title: 'Removed', description: `${name} removed from monitoring.` });
      loadOrgs();
    }
  };

  // Build display list
  const displayOrgs: OrgStatus[] = orgs.map(org => {
    const s = statuses.get(org.id);
    return {
      ...org,
      currentStatus: s?.currentStatus || 'unknown',
      responseTime: s?.responseTime || null,
      statusCode: s?.statusCode || null,
      lastChecked: s?.lastChecked || null,
      uptimePercent: s?.uptimePercent ?? null,
      recentPings: s?.recentPings || [],
    };
  });

  // Filter
  const filtered = displayOrgs.filter(o => {
    if (sectorFilter !== 'All' && o.sector !== sectorFilter) return false;
    if (statusFilter === 'Online' && o.currentStatus !== 'up') return false;
    if (statusFilter === 'Offline' && o.currentStatus !== 'down') return false;
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'status': return (a.currentStatus === 'up' ? 0 : 1) - (b.currentStatus === 'up' ? 0 : 1);
      case 'responseTime': return (a.responseTime || 99999) - (b.responseTime || 99999);
      case 'uptime': return (b.uptimePercent || 0) - (a.uptimePercent || 0);
      default: return a.name.localeCompare(b.name);
    }
  });

  // Stats
  const online = displayOrgs.filter(o => o.currentStatus === 'up').length;
  const offline = displayOrgs.filter(o => o.currentStatus === 'down').length;
  const avgResponse = displayOrgs.filter(o => o.responseTime).reduce((sum, o) => sum + (o.responseTime || 0), 0) / (displayOrgs.filter(o => o.responseTime).length || 1);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <div className="space-y-3">
          {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-neon-cyan" />
            Uptime Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time website status for all monitored organizations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <Timer className="w-4 h-4" />
            <span>Next ping: {countdown}s</span>
          </div>
          <Button
            onClick={() => { setCountdown(PING_INTERVAL); pingAll(); }}
            disabled={pinging}
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', pinging && 'animate-spin')} />
            Ping Now
          </Button>
          {isSuperAdmin && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" /> Add Site
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Organization to Monitor</DialogTitle>
                  <DialogDescription>Enter the details of the website to monitor.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input value={newOrg.name} onChange={e => setNewOrg(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Ministry of Finance" />
                  </div>
                  <div className="space-y-2">
                    <Label>URL</Label>
                    <Input value={newOrg.url} onChange={e => setNewOrg(p => ({ ...p, url: e.target.value }))} placeholder="https://example.gov.so" />
                  </div>
                  <div className="space-y-2">
                    <Label>Sector</Label>
                    <Select value={newOrg.sector} onValueChange={v => setNewOrg(p => ({ ...p, sector: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SECTORS.filter(s => s !== 'All').map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddOrg}>Add Organization</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Monitored</div>
            <div className="text-2xl font-bold text-foreground mt-1">{displayOrgs.length}</div>
            <Globe className="w-4 h-4 text-muted-foreground mt-1" />
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Online</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{online}</div>
            <div className="text-xs text-emerald-400/70">{displayOrgs.length ? ((online / displayOrgs.length) * 100).toFixed(0) : 0}%</div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Offline</div>
            <div className="text-2xl font-bold text-red-400 mt-1">{offline}</div>
            <div className="text-xs text-red-400/70">{displayOrgs.length ? ((offline / displayOrgs.length) * 100).toFixed(0) : 0}%</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Avg Response</div>
            <div className="text-2xl font-bold text-foreground mt-1">{avgResponse > 0 ? `${Math.round(avgResponse)}ms` : '—'}</div>
            <Clock className="w-4 h-4 text-muted-foreground mt-1" />
          </CardContent>
        </Card>
        <Card className="border-neon-cyan/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Next Ping</div>
            <div className="text-2xl font-bold text-neon-cyan mt-1 font-mono">{countdown}s</div>
            {pinging && <div className="text-xs text-amber-400 animate-pulse">Pinging...</div>}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sector" /></SelectTrigger>
          <SelectContent>
            {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3 h-3" />
              <SelectValue placeholder="Sort by" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="responseTime">Response Time</SelectItem>
            <SelectItem value="uptime">Uptime %</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase">Status</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase">Organization</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase">URL</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase">Sector</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase">Response</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase">Uptime</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase">Last 10</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase">Checked</th>
                {isSuperAdmin && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(org => (
                <tr key={org.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="p-3">
                    <StatusDot status={org.currentStatus} />
                  </td>
                  <td className="p-3 font-medium text-sm text-foreground">{org.name}</td>
                  <td className="p-3">
                    <a href={org.url} target="_blank" rel="noopener noreferrer" className="text-sm text-neon-cyan hover:underline flex items-center gap-1">
                      {org.url.replace(/^https?:\/\//, '')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={cn('text-xs', sectorColors[org.sector] || '')}>
                      {org.sector}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm font-mono text-muted-foreground">
                    {org.currentStatus === 'up' && org.responseTime ? `${org.responseTime}ms` : '—'}
                  </td>
                  <td className="p-3">
                    <UptimeBadge percent={org.uptimePercent} />
                  </td>
                  <td className="p-3">
                    <MiniPingBar pings={org.recentPings} />
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {org.lastChecked ? new Date(org.lastChecked).toLocaleTimeString() : '—'}
                  </td>
                  {isSuperAdmin && (
                    <td className="p-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveOrg(org.id, org.name)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(org => (
          <Card key={org.id} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <StatusDot status={org.currentStatus} />
                  <span className="font-medium text-sm text-foreground">{org.name}</span>
                </div>
                <Badge variant="outline" className={cn('text-xs', sectorColors[org.sector] || '')}>
                  {org.sector}
                </Badge>
              </div>
              <a href={org.url} target="_blank" rel="noopener noreferrer" className="text-xs text-neon-cyan hover:underline flex items-center gap-1 mb-2">
                {org.url} <ExternalLink className="w-3 h-3" />
              </a>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{org.currentStatus === 'up' && org.responseTime ? `${org.responseTime}ms` : '—'}</span>
                <UptimeBadge percent={org.uptimePercent} />
                <MiniPingBar pings={org.recentPings} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Sub-components
const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'checking') {
    return (
      <div className="relative w-3 h-3">
        <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
        <div className="relative w-3 h-3 rounded-full bg-amber-400" />
      </div>
    );
  }
  const isUp = status === 'up';
  return (
    <div className="relative w-3 h-3">
      {isUp && <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />}
      <div className={cn('relative w-3 h-3 rounded-full', isUp ? 'bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]')} />
    </div>
  );
};

const UptimeBadge: React.FC<{ percent: number | null }> = ({ percent }) => {
  if (percent === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = percent >= 99 ? 'text-emerald-400' : percent >= 95 ? 'text-amber-400' : 'text-red-400';
  return <span className={cn('text-sm font-mono font-medium', color)}>{percent.toFixed(1)}%</span>;
};

const MiniPingBar: React.FC<{ pings: ('up' | 'down')[] }> = ({ pings }) => {
  if (pings.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {pings.map((p, i) => (
        <div key={i} className={cn('w-2 h-4 rounded-sm', p === 'up' ? 'bg-emerald-500' : 'bg-red-500')} />
      ))}
    </div>
  );
};

export default UptimeMonitor;
