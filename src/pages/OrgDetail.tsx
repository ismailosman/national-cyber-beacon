import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Play, Shield, Globe, Clock, CheckCircle, XCircle, AlertTriangle, MapPin, Pencil, Trash2 } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const checkTypeLabels: Record<string, string> = {
  tls: 'TLS Certificate',
  https: 'HTTPS Enforcement',
  headers: 'Security Headers',
  dns: 'DNS Resolution',
  uptime: 'Uptime Check',
  cert_expiry: 'Cert Expiry',
  waf_activity: 'WAF Activity',
};

const statusConfig = {
  pass: { icon: CheckCircle, color: 'text-neon-green', bg: 'bg-neon-green/10 border-neon-green/30' },
  warn: { icon: AlertTriangle, color: 'text-neon-amber', bg: 'bg-neon-amber/10 border-neon-amber/30' },
  fail: { icon: XCircle, color: 'text-neon-red', bg: 'bg-neon-red/10 border-neon-red/30' },
};

const OrgDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEdit = userRole?.role === 'SuperAdmin' || userRole?.role === 'OrgAdmin';
  const isSuperAdmin = userRole?.role === 'SuperAdmin';

  const { data: org } = useQuery({
    queryKey: ['org', id],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('*').eq('id', id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['org-assets', id],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('*').eq('organization_id', id!);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: checks = [] } = useQuery({
    queryKey: ['security-checks', id],
    queryFn: async () => {
      const assetIds = assets.map((a: any) => a.id);
      if (!assetIds.length) return [];
      const { data } = await supabase
        .from('security_checks')
        .select('*')
        .in('asset_id', assetIds)
        .order('checked_at', { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: assets.length > 0,
  });

  const { data: orgAlerts = [] } = useQuery({
    queryKey: ['org-alerts', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('organization_id', id!)
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
        .from('risk_history')
        .select('score, created_at')
        .eq('organization_id', id!)
        .order('created_at', { ascending: false })
        .limit(30);
      return (data || []).reverse().map((r: any) => ({
        day: format(new Date(r.created_at), 'MMM dd'),
        score: r.score,
      }));
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

  const handleEditOpen = () => {
    if (!org) return;
    setEditForm({
      name: org.name,
      domain: org.domain,
      region: org.region,
      contact_email: org.contact_email || '',
      sector: org.sector,
      status: org.status,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm || !id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('organizations').update({
        name: editForm.name,
        domain: editForm.domain,
        region: editForm.region,
        contact_email: editForm.contact_email || null,
        sector: editForm.sector,
        status: editForm.status,
      }).eq('id', id);
      if (error) throw error;
      toast.success('Organization updated successfully');
      queryClient.invalidateQueries({ queryKey: ['org', id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setEditOpen(false);
    } catch (err: any) {
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('organizations').delete().eq('id', id);
      if (error) throw error;
      toast.success('Organization deleted successfully');
      navigate('/organizations');
    } catch (err: any) {
      toast.error('Failed to delete: ' + (err.message || 'Unknown error'));
      setDeleting(false);
    }
  };

  const radarData = [
    { subject: 'TLS', value: checks.find((c: any) => c.check_type === 'tls')?.score ?? 50 },
    { subject: 'Headers', value: checks.find((c: any) => c.check_type === 'headers')?.score ?? 50 },
    { subject: 'Uptime', value: checks.find((c: any) => c.check_type === 'uptime')?.score ?? 50 },
    { subject: 'DNS', value: checks.find((c: any) => c.check_type === 'dns')?.score ?? 50 },
    { subject: 'WAF', value: checks.find((c: any) => c.check_type === 'waf_activity')?.score ?? 50 },
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
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => navigate('/organizations')} className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{org.name}</h1>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
              <Globe className="w-3 h-3" />{org.domain}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />{org.region}
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-mono border text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5 capitalize">{org.sector}</span>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={handleEditOpen}
            className="flex items-center gap-2 px-4 py-2.5 bg-card text-foreground font-bold text-sm rounded-lg border border-border hover:border-neon-cyan/40 hover:text-neon-cyan transition-all"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        )}
        {isSuperAdmin && (
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-neon-red/10 text-neon-red font-bold text-sm rounded-lg border border-neon-red/30 hover:bg-neon-red/20 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
        <button
          onClick={handleRunScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 bg-neon-cyan text-background font-bold text-sm rounded-lg hover:brightness-110 transition-all disabled:opacity-50 glow-cyan"
        >
          <Play className="w-4 h-4" />
          {scanning ? 'Scanning...' : 'Run Scan Now'}
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{org.name}</strong> and all associated data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Organization'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Organization Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-domain">Domain</Label>
                <Input id="edit-domain" value={editForm.domain} onChange={e => setEditForm({ ...editForm, domain: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-region">Region</Label>
                <Input id="edit-region" value={editForm.region} onChange={e => setEditForm({ ...editForm, region: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">Contact Email</Label>
                <Input id="edit-email" type="email" value={editForm.contact_email} onChange={e => setEditForm({ ...editForm, contact_email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-sector">Sector</Label>
                  <select
                    id="edit-sector"
                    value={editForm.sector}
                    onChange={e => setEditForm({ ...editForm, sector: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {['government', 'bank', 'telecom', 'health', 'education', 'other'].map(s => (
                      <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-status">Status</Label>
                  <select
                    id="edit-status"
                    value={editForm.status}
                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {['Secure', 'Warning', 'Critical'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Score Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Risk Score', value: org.risk_score, color: org.risk_score >= 75 ? 'text-neon-green' : org.risk_score >= 50 ? 'text-neon-amber' : 'text-neon-red' },
          { label: 'Status', value: org.status, color: org.status === 'Secure' ? 'text-neon-green' : org.status === 'Warning' ? 'text-neon-amber' : 'text-neon-red' },
          { label: 'Assets', value: assets.length, color: 'text-neon-cyan' },
          { label: 'Open Alerts', value: orgAlerts.filter((a: any) => a.status === 'open').length, color: orgAlerts.filter((a: any) => a.status === 'open').length > 0 ? 'text-neon-red' : 'text-neon-green' },
        ].map(c => (
          <div key={c.label} className="glass-card rounded-xl p-4 border border-border text-center">
            <p className={cn('text-2xl font-bold font-mono', c.color)}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Radar + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Security Domain Radar</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(216 28% 20%)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 9 }} />
              <Radar name="Score" dataKey="value" stroke="hsl(186 100% 50%)" fill="hsl(186 100% 50%)" fillOpacity={0.15} />
              <Tooltip formatter={(v) => [`${v}`, 'Score']} contentStyle={{ background: 'hsl(216 28% 10%)', border: '1px solid hsl(186 100% 50% / 0.3)', borderRadius: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Risk Score Trend</h3>
          {scoreHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={scoreHistory} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="orgScoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(186 100% 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(186 100% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 28% 16%)" />
                <XAxis dataKey="day" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(216 28% 10%)', border: '1px solid hsl(186 100% 50% / 0.3)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="score" stroke="hsl(186 100% 50%)" strokeWidth={2} fill="url(#orgScoreGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">No history yet</div>
          )}
        </div>
      </div>

      {/* Assets */}
      <div className="glass-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Globe className="w-4 h-4 text-neon-cyan" />
          <h3 className="text-sm font-semibold">Assets ({assets.length})</h3>
        </div>
        <div className="divide-y divide-border/50">
          {assets.map((asset: any) => (
            <div key={asset.id} className="p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium font-mono text-neon-cyan">{asset.url}</p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{asset.asset_type} {asset.is_critical && '· Critical'}</p>
              </div>
              {asset.ip_address && <span className="text-xs text-muted-foreground font-mono">{asset.ip_address}</span>}
            </div>
          ))}
          {assets.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No assets registered.</div>}
        </div>
      </div>

      {/* Security Checks */}
      <div className="glass-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Shield className="w-4 h-4 text-neon-cyan" />
          <h3 className="text-sm font-semibold">Security Check Results</h3>
          <span className="ml-auto text-xs text-muted-foreground font-mono">Last {checks.length} checks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Check</th>
                <th className="text-center p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Status</th>
                <th className="text-center p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Score</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((chk: any) => {
                const cfg = statusConfig[chk.status as keyof typeof statusConfig] || statusConfig.warn;
                const Icon = cfg.icon;
                return (
                  <tr key={chk.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                    <td className="p-3 font-medium">{checkTypeLabels[chk.check_type] || chk.check_type}</td>
                    <td className="p-3 text-center">
                      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border', cfg.bg, cfg.color)}>
                        <Icon className="w-3 h-3" />
                        {chk.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-neon-cyan">{chk.score}</td>
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

      {/* Alerts */}
      {orgAlerts.length > 0 && (
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-neon-amber" />
            <h3 className="text-sm font-semibold">Alert History</h3>
          </div>
          <div className="p-4 space-y-2">
            {orgAlerts.map((alert: any) => (
              <div key={alert.id} className={cn('p-3 rounded-lg border text-sm flex items-start gap-3',
                alert.severity === 'critical' ? 'bg-neon-red/5 border-neon-red/20' :
                alert.severity === 'high' ? 'bg-neon-red/5 border-neon-red/20' :
                alert.severity === 'medium' ? 'bg-neon-amber/5 border-neon-amber/20' :
                'bg-neon-cyan/5 border-neon-cyan/20'
              )}>
                <span className={cn('text-xs font-bold uppercase px-1.5 py-0.5 rounded font-mono flex-shrink-0',
                  alert.severity === 'critical' || alert.severity === 'high' ? 'bg-neon-red/20 text-neon-red' :
                  alert.severity === 'medium' ? 'bg-neon-amber/20 text-neon-amber' :
                  'bg-neon-cyan/20 text-neon-cyan'
                )}>{alert.severity}</span>
                <div className="flex-1">
                  <p className="text-foreground font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.description}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last scan info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
        <Clock className="w-3 h-3" />
        Last scan: {org.last_scan ? formatDistanceToNow(new Date(org.last_scan), { addSuffix: true }) : 'Never'}
        {org.contact_email && <span className="ml-4">Contact: {org.contact_email}</span>}
      </div>
    </div>
  );
};

export default OrgDetail;
