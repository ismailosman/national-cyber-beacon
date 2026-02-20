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
  ExternalLink, ArrowUpDown, Timer, Lock, AlertTriangle, ShieldAlert, ShieldCheck
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

interface SslResult {
  isValid: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  issuer: string | null;
  protocol: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysUntilExpiry: number | null;
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
const SSL_FILTERS = ['All', 'Secure', 'Expiring Soon', 'Expired/Invalid'];
const PING_INTERVAL = 60;
const SSL_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

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
  const [sslFilter, setSslFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'responseTime' | 'uptime' | 'sslExpiry'>('name');
  const [addOpen, setAddOpen] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: '', url: '', sector: 'Government' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSuperAdmin = userRole?.role === 'SuperAdmin';

  // SSL state
  const [sslStatuses, setSslStatuses] = useState<Map<string, SslResult>>(new Map());
  const [sslChecking, setSslChecking] = useState(false);
  const lastSslCheckRef = useRef<number>(0);

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

  // Load latest SSL logs from DB
  const loadSslHistory = useCallback(async (orgList: MonitoredOrg[]) => {
    // Get the latest SSL log per org
    const { data: logs } = await supabase
      .from('ssl_logs')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(200);

    if (!logs || logs.length === 0) return;

    const seen = new Set<string>();
    const map = new Map<string, SslResult>();
    for (const log of logs) {
      const orgId = log.organization_id;
      if (!orgId || seen.has(orgId)) continue;
      seen.add(orgId);
      map.set(orgId, {
        isValid: log.is_valid,
        isExpired: log.is_expired,
        isExpiringSoon: log.is_expiring_soon,
        issuer: log.issuer,
        protocol: log.protocol,
        validFrom: log.valid_from,
        validTo: log.valid_to,
        daysUntilExpiry: log.days_until_expiry,
      });
    }
    setSslStatuses(map);

    // Check if we need a fresh SSL check (last check > 6 hours ago)
    if (logs.length > 0) {
      const latestCheck = new Date(logs[0].checked_at).getTime();
      lastSslCheckRef.current = latestCheck;
    }
  }, []);

  // Check SSL for all orgs
  const checkAllSsl = useCallback(async (orgList?: MonitoredOrg[]) => {
    const list = orgList || orgs;
    if (list.length === 0) return;

    setSslChecking(true);
    try {
      const urls = list.map(o => o.url);
      const { data, error } = await supabase.functions.invoke('check-ssl', {
        body: { urls },
      });

      if (error || !data?.results) {
        toast({ title: 'SSL Check Failed', description: 'Could not reach the SSL check service.', variant: 'destructive' });
        setSslChecking(false);
        return;
      }

      const results = data.results as Array<{ url: string; ssl: SslResult }>;
      const urlToResult = new Map(results.map(r => [r.url, r.ssl]));

      // Store logs
      const logsToInsert = list.map(org => {
        const ssl = urlToResult.get(org.url);
        return {
          organization_id: org.id,
          organization_name: org.name,
          url: org.url,
          is_valid: ssl?.isValid ?? false,
          is_expired: ssl?.isExpired ?? false,
          is_expiring_soon: ssl?.isExpiringSoon ?? false,
          issuer: ssl?.issuer || null,
          protocol: ssl?.protocol || null,
          valid_from: ssl?.validFrom || null,
          valid_to: ssl?.validTo || null,
          days_until_expiry: ssl?.daysUntilExpiry ?? null,
        };
      });

      await supabase.from('ssl_logs').insert(logsToInsert);

      // Update state
      const newMap = new Map<string, SslResult>();
      for (const org of list) {
        const ssl = urlToResult.get(org.url);
        if (ssl) {
          newMap.set(org.id, ssl);
        }
      }
      setSslStatuses(newMap);
      lastSslCheckRef.current = Date.now();

      toast({ title: 'SSL Check Complete', description: `Checked ${list.length} certificates.` });
    } catch {
      toast({ title: 'SSL Check Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    }

    setSslChecking(false);
  }, [orgs, toast]);

  // Check SSL for single org
  const checkSingleSsl = useCallback(async (org: MonitoredOrg) => {
    try {
      const { data, error } = await supabase.functions.invoke('check-ssl', {
        body: { url: org.url },
      });
      if (error || !data?.results?.[0]) return;
      const ssl: SslResult = data.results[0].ssl;

      await supabase.from('ssl_logs').insert({
        organization_id: org.id,
        organization_name: org.name,
        url: org.url,
        is_valid: ssl.isValid,
        is_expired: ssl.isExpired,
        is_expiring_soon: ssl.isExpiringSoon,
        issuer: ssl.issuer,
        protocol: ssl.protocol,
        valid_from: ssl.validFrom,
        valid_to: ssl.validTo,
        days_until_expiry: ssl.daysUntilExpiry,
      });

      setSslStatuses(prev => {
        const next = new Map(prev);
        next.set(org.id, ssl);
        return next;
      });
    } catch {
      // silently fail for individual checks
    }
  }, []);

  // Ping all orgs
  const pingAll = useCallback(async (orgList?: MonitoredOrg[]) => {
    const list = orgList || orgs;
    if (list.length === 0) return;

    setPinging(true);
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
          existing.recentPings = [r?.status || 'down', ...existing.recentPings].slice(0, 10);
          const ups = existing.recentPings.filter(p => p === 'up').length;
          existing.uptimePercent = existing.recentPings.length > 0 ? (ups / existing.recentPings.length) * 100 : null;

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
      loadSslHistory(orgs);
      pingAll(orgs);
    }
  }, [orgs.length, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // SSL check on load (after history is loaded) - check if stale
  useEffect(() => {
    if (orgs.length === 0 || loading) return;
    const timeSinceLastCheck = Date.now() - lastSslCheckRef.current;
    if (timeSinceLastCheck > SSL_CHECK_INTERVAL || lastSslCheckRef.current === 0) {
      // Delay slightly so ping goes first
      const timer = setTimeout(() => checkAllSsl(orgs), 3000);
      return () => clearTimeout(timer);
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
    if (sslFilter !== 'All') {
      const ssl = sslStatuses.get(o.id);
      if (sslFilter === 'Secure' && (!ssl || !ssl.isValid || ssl.isExpiringSoon || ssl.isExpired)) return false;
      if (sslFilter === 'Expiring Soon' && (!ssl || !ssl.isExpiringSoon)) return false;
      if (sslFilter === 'Expired/Invalid' && (!ssl || (!ssl.isExpired && ssl.isValid))) return false;
    }
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'status': return (a.currentStatus === 'up' ? 0 : 1) - (b.currentStatus === 'up' ? 0 : 1);
      case 'responseTime': return (a.responseTime || 99999) - (b.responseTime || 99999);
      case 'uptime': return (b.uptimePercent || 0) - (a.uptimePercent || 0);
      case 'sslExpiry': {
        const aDays = sslStatuses.get(a.id)?.daysUntilExpiry ?? 99999;
        const bDays = sslStatuses.get(b.id)?.daysUntilExpiry ?? 99999;
        return aDays - bDays;
      }
      default: return a.name.localeCompare(b.name);
    }
  });

  // Stats
  const online = displayOrgs.filter(o => o.currentStatus === 'up').length;
  const offline = displayOrgs.filter(o => o.currentStatus === 'down').length;
  const avgResponse = displayOrgs.filter(o => o.responseTime).reduce((sum, o) => sum + (o.responseTime || 0), 0) / (displayOrgs.filter(o => o.responseTime).length || 1);

  // SSL Stats
  const sslValid = displayOrgs.filter(o => {
    const ssl = sslStatuses.get(o.id);
    return ssl && ssl.isValid && !ssl.isExpiringSoon && !ssl.isExpired;
  }).length;
  const sslExpiringSoon = displayOrgs.filter(o => {
    const ssl = sslStatuses.get(o.id);
    return ssl && ssl.isExpiringSoon;
  }).length;
  const sslExpiredInvalid = displayOrgs.filter(o => {
    const ssl = sslStatuses.get(o.id);
    return ssl && (ssl.isExpired || !ssl.isValid);
  }).length;

  // SSL Alerts data
  const expiredOrgs = displayOrgs.filter(o => {
    const ssl = sslStatuses.get(o.id);
    return ssl && ssl.isExpired;
  });
  const expiringSoonOrgs = displayOrgs.filter(o => {
    const ssl = sslStatuses.get(o.id);
    return ssl && ssl.isExpiringSoon;
  });

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
            onClick={() => { setCountdown(PING_INTERVAL); pingAll(); checkAllSsl(); }}
            disabled={pinging || sslChecking}
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', (pinging || sslChecking) && 'animate-spin')} />
            Check All
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
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
        {/* SSL Summary Cards */}
        <Card className="border-emerald-500/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">SSL Valid</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{sslValid}</div>
            <Lock className="w-4 h-4 text-emerald-400 mt-1" />
          </CardContent>
        </Card>
        <Card className="border-amber-500/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">SSL Expiring</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{sslExpiringSoon}</div>
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-1" />
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">SSL Invalid</div>
            <div className="text-2xl font-bold text-red-400 mt-1">{sslExpiredInvalid}</div>
            <ShieldAlert className="w-4 h-4 text-red-400 mt-1" />
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
        <Select value={sslFilter} onValueChange={setSslFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="SSL Status" /></SelectTrigger>
          <SelectContent>
            {SSL_FILTERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
            <SelectItem value="sslExpiry">SSL Expiry</SelectItem>
          </SelectContent>
        </Select>
        {sslChecking && (
          <div className="flex items-center gap-2 text-xs text-amber-400 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Checking SSL...
          </div>
        )}
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
                <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase">SSL Status</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase">SSL Expiry</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase">SSL Issuer</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase">Checked</th>
                {isSuperAdmin && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(org => {
                const ssl = sslStatuses.get(org.id);
                return (
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
                    <td className="p-3">
                      <SslStatusBadge ssl={ssl} />
                    </td>
                    <td className="p-3">
                      <SslExpiryDisplay ssl={ssl} />
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {ssl?.issuer || '—'}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {org.lastChecked ? new Date(org.lastChecked).toLocaleTimeString() : '—'}
                    </td>
                    {isSuperAdmin && (
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-neon-cyan" title="Check SSL" onClick={() => checkSingleSsl(org)}>
                            <ShieldCheck className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveOrg(org.id, org.name)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(org => {
          const ssl = sslStatuses.get(org.id);
          return (
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
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>{org.currentStatus === 'up' && org.responseTime ? `${org.responseTime}ms` : '—'}</span>
                  <UptimeBadge percent={org.uptimePercent} />
                  <MiniPingBar pings={org.recentPings} />
                </div>
                <div className="flex items-center justify-between">
                  <SslStatusBadge ssl={ssl} />
                  <SslExpiryDisplay ssl={ssl} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* SSL Certificate Alerts Section */}
      {(expiredOrgs.length > 0 || expiringSoonOrgs.length > 0) ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            SSL Certificate Alerts
          </h2>
          {expiredOrgs.map(org => {
            const ssl = sslStatuses.get(org.id);
            const daysAgo = ssl?.daysUntilExpiry ? Math.abs(ssl.daysUntilExpiry) : 0;
            return (
              <div key={org.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <div>
                    <span className="text-sm font-medium text-foreground">{org.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{org.url}</span>
                  </div>
                </div>
                <span className="text-xs font-medium text-red-400">Certificate expired {daysAgo} days ago</span>
              </div>
            );
          })}
          {expiringSoonOrgs.map(org => {
            const ssl = sslStatuses.get(org.id);
            return (
              <div key={org.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-sm font-medium text-foreground">{org.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{org.url}</span>
                  </div>
                </div>
                <span className="text-xs font-medium text-amber-400">Certificate expires in {ssl?.daysUntilExpiry} days</span>
              </div>
            );
          })}
        </div>
      ) : sslStatuses.size > 0 ? (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="text-sm text-emerald-400 font-medium">✓ All SSL certificates are valid and not expiring soon</span>
        </div>
      ) : null}
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

const SslStatusBadge: React.FC<{ ssl: SslResult | undefined }> = ({ ssl }) => {
  if (!ssl) {
    return (
      <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs gap-1">
        Unknown
      </Badge>
    );
  }
  if (ssl.isExpired) {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs gap-1">
        <ShieldAlert className="w-3 h-3" />
        Expired
      </Badge>
    );
  }
  if (!ssl.isValid) {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs gap-1">
        <ShieldAlert className="w-3 h-3" />
        Invalid
      </Badge>
    );
  }
  if (ssl.isExpiringSoon) {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs gap-1">
        <AlertTriangle className="w-3 h-3" />
        Expiring Soon
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs gap-1">
      <Lock className="w-3 h-3" />
      Secure
    </Badge>
  );
};

const SslExpiryDisplay: React.FC<{ ssl: SslResult | undefined }> = ({ ssl }) => {
  if (!ssl || !ssl.validTo) return <span className="text-xs text-muted-foreground">—</span>;

  const expiryDate = new Date(ssl.validTo);
  const formatted = expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const days = ssl.daysUntilExpiry;

  if (days !== null && days < 0) {
    return (
      <span className="text-xs font-bold text-red-400">
        EXPIRED {Math.abs(days)}d ago
      </span>
    );
  }
  if (days !== null && days <= 30) {
    return (
      <span className="text-xs font-bold text-amber-400">
        ⚠ {formatted} ({days}d)
      </span>
    );
  }
  return (
    <span className="text-xs text-emerald-400">
      {formatted} ({days}d)
    </span>
  );
};

export default UptimeMonitor;
