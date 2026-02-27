import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, Filter, Globe, ChevronRight, Plus, TrendingUp, TrendingDown, Minus, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

type Sector = 'All' | 'Government' | 'Bank' | 'Telecom' | 'Health' | 'Education' | 'Other';

const statusConfig = {
  Secure: { border: 'border-l-neon-green', badge: 'bg-neon-green/10 text-neon-green border-neon-green/30', dot: 'bg-neon-green' },
  Warning: { border: 'border-l-neon-amber', badge: 'bg-neon-amber/10 text-neon-amber border-neon-amber/30', dot: 'bg-neon-amber' },
  Critical: { border: 'border-l-neon-red', badge: 'bg-neon-red/10 text-neon-red border-neon-red/30', dot: 'bg-neon-red' },
};

const Organizations: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isSuperAdmin = userRole?.role === 'SuperAdmin';
  const [sector, setSector] = useState<Sector>('All');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', domain: '', sector: 'government', region: 'Banaadir', contact_email: '' });
  const [addSaving, setAddSaving] = useState(false);

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('*').order('name');
      return data || [];
    },
  });

  // Fetch latest 2 risk_history entries per org for trend
  const { data: trendData = {} } = useQuery({
    queryKey: ['org-trends'],
    queryFn: async () => {
      const { data } = await supabase.from('risk_history').select('organization_id, score, created_at').order('created_at', { ascending: false }).limit(200);
      const trends: Record<string, { current: number; previous: number | null }> = {};
      const grouped: Record<string, { score: number; created_at: string }[]> = {};
      for (const r of data || []) {
        if (!grouped[r.organization_id]) grouped[r.organization_id] = [];
        if (grouped[r.organization_id].length < 2) grouped[r.organization_id].push(r);
      }
      for (const [orgId, entries] of Object.entries(grouped)) {
        trends[orgId] = { current: entries[0]?.score ?? 0, previous: entries[1]?.score ?? null };
      }
      return trends;
    },
  });

  // Fetch latest SSL and tech fingerprint data for compliance badges
  const { data: sslData = [] } = useQuery({
    queryKey: ['org-ssl-latest'],
    queryFn: async () => {
      const { data } = await supabase.from('ssl_logs').select('organization_id, is_valid, days_until_expiry').order('checked_at', { ascending: false });
      // Deduplicate: keep first (latest) per org
      const seen = new Set<string>();
      return (data || []).filter(r => {
        if (!r.organization_id || seen.has(r.organization_id)) return false;
        seen.add(r.organization_id);
        return true;
      });
    },
  });

  const { data: techData = [] } = useQuery({
    queryKey: ['org-tech-latest'],
    queryFn: async () => {
      const { data } = await supabase.from('tech_fingerprints').select('organization_id, vulnerabilities_count, outdated_count').order('checked_at', { ascending: false });
      const seen = new Set<string>();
      return (data || []).filter(r => {
        if (!r.organization_id || seen.has(r.organization_id)) return false;
        seen.add(r.organization_id);
        return true;
      });
    },
  });

  // Compute compliance status per org
  const complianceMap = useMemo(() => {
    const map: Record<string, { failed: number; warnings: number; details: string[] }> = {};
    const sslByOrg: Record<string, { valid: boolean; daysLeft: number | null }> = {};
    const techByOrg: Record<string, { vulns: number; outdated: number }> = {};

    for (const s of sslData) {
      if (s.organization_id) sslByOrg[s.organization_id] = { valid: s.is_valid, daysLeft: s.days_until_expiry };
    }
    for (const t of techData) {
      if (t.organization_id) techByOrg[t.organization_id] = { vulns: t.vulnerabilities_count, outdated: t.outdated_count };
    }

    for (const org of orgs) {
      const ssl = sslByOrg[(org as any).id];
      const tech = techByOrg[(org as any).id];
      let failed = 0, warnings = 0;
      const details: string[] = [];

      // GDPR Art.25 — software CVEs
      const vulns = tech?.vulns ?? 0;
      if (vulns > 0) { failed++; details.push(`GDPR Art.25: ${vulns} vulnerability(ies)`); }

      // GDPR Art.32 — SSL + vulns
      if (ssl && !ssl.valid) { failed++; details.push('GDPR Art.32: Invalid SSL'); }
      else if (vulns > 0 && (!ssl || ssl.valid)) { /* already counted */ }

      // NIST ID.RA-1 — vulnerability identification
      if (vulns > 0) { failed++; details.push(`NIST ID.RA-1: ${vulns} CVE(s)`); }

      // NIST PR.DS-2 — data-in-transit
      if (ssl && !ssl.valid) { failed++; details.push('NIST PR.DS-2: SSL invalid'); }
      else if (ssl && ssl.daysLeft !== null && ssl.daysLeft <= 30) { warnings++; details.push(`NIST PR.DS-2: SSL expiring in ${ssl.daysLeft}d`); }

      // NIST PR.IP-12 — patch management
      if (tech && tech.outdated > 0) { warnings++; details.push(`NIST PR.IP-12: ${tech.outdated} outdated component(s)`); }

      map[(org as any).id] = { failed, warnings, details };
    }
    return map;
  }, [orgs, sslData, techData]);

  const filtered = orgs.filter((o: any) => {
    const matchSector = sector === 'All' || o.sector.toLowerCase() === sector.toLowerCase();
    const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.domain.toLowerCase().includes(search.toLowerCase());
    return matchSector && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{orgs.length} monitored entities</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setAddOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Organization
          </Button>
        )}
      </div>

      {/* Add Organization Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="add-name">Name *</Label>
              <Input id="add-name" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="e.g. Hormuud Telecom" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-domain">Domain *</Label>
              <Input id="add-domain" value={addForm.domain} onChange={e => setAddForm({ ...addForm, domain: e.target.value })} placeholder="e.g. hormuud.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-sector">Sector *</Label>
                <select
                  id="add-sector"
                  value={addForm.sector}
                  onChange={e => setAddForm({ ...addForm, sector: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {['government', 'bank', 'telecom', 'health', 'education', 'other'].map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-region">Region *</Label>
                <Input id="add-region" value={addForm.region} onChange={e => setAddForm({ ...addForm, region: e.target.value })} placeholder="e.g. Banaadir" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-email">Contact Email</Label>
              <Input id="add-email" type="email" value={addForm.contact_email} onChange={e => setAddForm({ ...addForm, contact_email: e.target.value })} placeholder="admin@example.so" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSaving}>Cancel</Button>
            <Button
              disabled={addSaving || !addForm.name || !addForm.domain || !addForm.region}
              onClick={async () => {
                setAddSaving(true);
                try {
                  const { error } = await supabase.from('organizations').insert({
                    name: addForm.name,
                    domain: addForm.domain,
                    sector: addForm.sector as any,
                    region: addForm.region,
                    contact_email: addForm.contact_email || null,
                    risk_score: 50,
                    status: 'Warning',
                  });
                  if (error) throw error;
                  toast.success('Organization created successfully');
                  queryClient.invalidateQueries({ queryKey: ['organizations'] });
                  setAddOpen(false);
                  setAddForm({ name: '', domain: '', sector: 'government', region: 'Banaadir', contact_email: '' });
                } catch (err: any) {
                  toast.error('Failed to create: ' + (err.message || 'Unknown error'));
                } finally {
                  setAddSaving(false);
                }
              }}
            >
              {addSaving ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search organizations..."
            className="w-full pl-9 pr-4 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/30 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['All', 'Government', 'Bank', 'Telecom', 'Health', 'Education', 'Other'] as Sector[]).map(s => (
            <button
              key={s}
              onClick={() => setSector(s)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium rounded-lg border transition-all',
                sector === s
                  ? 'bg-neon-cyan/10 border-neon-cyan/40 text-neon-cyan'
                  : 'border-border text-muted-foreground hover:border-neon-cyan/30 hover:text-foreground'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 border-l-4 border-l-border h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((org: any) => {
            const status = statusConfig[org.status as keyof typeof statusConfig] || statusConfig.Warning;
            const compliance = complianceMap[org.id];
            return (
              <button
                key={org.id}
                onClick={() => navigate(`/organizations/${org.id}`)}
                className={cn(
                  'glass-card rounded-xl p-5 border-l-4 text-left hover:brightness-110 transition-all group animate-fade-in-up w-full',
                  status.border
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-neon-cyan transition-colors">
                      {org.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground font-mono truncate">{org.domain}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-neon-cyan transition-colors ml-2 flex-shrink-0" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn('text-xs px-2 py-0.5 rounded border font-mono', status.badge)}>
                      {org.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded border font-mono text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5">
                      {org.sector}
                    </span>
                    {/* Compliance Badge */}
                    {compliance && (compliance.failed > 0 || compliance.warnings > 0) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(
                              'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-mono',
                              compliance.failed > 0
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            )}>
                              <ShieldAlert className="w-3 h-3" />
                              {compliance.failed > 0
                                ? `${compliance.failed} failed`
                                : `${compliance.warnings} warn`}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            <p className="font-semibold mb-1">GDPR / NIST Controls</p>
                            {compliance.details.map((d, i) => (
                              <p key={i} className="text-muted-foreground">{d}</p>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {compliance && compliance.failed === 0 && compliance.warnings === 0 && (sslData.some(s => s.organization_id === org.id) || techData.some(t => t.organization_id === org.id)) && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-mono bg-green-500/10 text-green-400 border-green-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        Compliant
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className={cn('text-2xl font-bold font-mono',
                        org.risk_score >= 75 ? 'text-neon-green' :
                        org.risk_score >= 50 ? 'text-neon-amber' : 'text-neon-red'
                      )}>{org.risk_score}</span>
                      <span className="text-muted-foreground text-xs">/100</span>
                      {(() => {
                        const trend = (trendData as any)[org.id];
                        if (!trend || trend.previous === null) return null;
                        const delta = trend.current - trend.previous;
                        if (delta > 2) return <TrendingUp className="w-4 h-4 text-neon-green ml-1" />;
                        if (delta < -2) return <TrendingDown className="w-4 h-4 text-neon-red ml-1" />;
                        return <Minus className="w-3 h-3 text-muted-foreground ml-1" />;
                      })()}
                    </div>
                  </div>
                </div>

                {org.last_scanned_at && (
                  <p className="text-xs text-muted-foreground mt-3 font-mono">
                    Last scan: {formatDistanceToNow(new Date(org.last_scanned_at), { addSuffix: true })}
                  </p>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No organizations match your filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Organizations;
