import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Check, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAlerts, type SeverityFilter, type StatusFilter } from '@/hooks/useAlerts';

const severityConfig: Record<string, string> = {
  critical: 'bg-neon-red/10 text-neon-red border-neon-red/30',
  high: 'bg-neon-red/5 text-neon-red border-neon-red/20',
  medium: 'bg-neon-amber/10 text-neon-amber border-neon-amber/30',
  low: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30',
};

const defaultForm = { title: '', description: '', severity: 'medium', source: 'manual', organization_id: '' };

const AlertsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const [sevFilter, setSevFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const canCreate = userRole?.role === 'SuperAdmin' || userRole?.role === 'Analyst';

  const { data: alerts = [], isLoading } = useAlerts({ severity: sevFilter, status: statusFilter });

  const { data: orgs = [] } = useQuery({
    queryKey: ['orgs-list'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('id, name').order('name');
      return data || [];
    },
    enabled: canCreate,
  });

  const ackAlert = async (ids: string[]) => {
    await supabase.from('alerts').update({ status: 'ack', is_read: true }).in('id', ids);
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
    queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
    setSelected([]);
    toast.success(`${ids.length} alert(s) acknowledged`);
  };

  const dismissAlert = async (ids: string[]) => {
    await supabase.from('alerts').update({ status: 'closed' }).in('id', ids);
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
    queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
    setSelected([]);
    toast.success(`${ids.length} alert(s) closed`);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    if (!form.title || !form.organization_id) {
      toast.error('Title and organization are required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('alerts').insert({
        title: form.title,
        description: form.description,
        severity: form.severity as any,
        source: form.source || 'manual',
        organization_id: form.organization_id,
        status: 'open',
        is_read: false,
      });
      if (error) throw error;
      toast.success('Alert created successfully');
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
      setCreateOpen(false);
      setForm(defaultForm);
    } catch (err: any) {
      toast.error('Failed to create alert: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const openCount = (alerts as any[]).filter((a) => a.status === 'open').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alert Center</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{openCount} open · {alerts.length} total</p>
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <>
              <button onClick={() => ackAlert(selected)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-neon-green/10 border border-neon-green/30 text-neon-green rounded-lg hover:bg-neon-green/20 transition-colors">
                <Check className="w-4 h-4" /> Acknowledge ({selected.length})
              </button>
              <button onClick={() => dismissAlert(selected)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-neon-red/10 border border-neon-red/30 text-neon-red rounded-lg hover:bg-neon-red/20 transition-colors">
                <Trash2 className="w-4 h-4" /> Close ({selected.length})
              </button>
            </>
          )}
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Alert
            </Button>
          )}
        </div>
      </div>

      {/* Create Alert Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="alert-title">Title *</Label>
              <Input
                id="alert-title"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Suspicious login attempts detected"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alert-desc">Description</Label>
              <Textarea
                id="alert-desc"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Additional details..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="alert-severity">Severity *</Label>
                <select
                  id="alert-severity"
                  value={form.severity}
                  onChange={e => setForm({ ...form, severity: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {['critical', 'high', 'medium', 'low'].map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alert-source">Source</Label>
                <Input
                  id="alert-source"
                  value={form.source}
                  onChange={e => setForm({ ...form, source: e.target.value })}
                  placeholder="manual"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alert-org">Organization *</Label>
              <select
                id="alert-org"
                value={form.organization_id}
                onChange={e => setForm({ ...form, organization_id: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select organization...</option>
                {(orgs as any[]).map((o: any) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.title || !form.organization_id}>
              {saving ? 'Creating...' : 'Create Alert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(['all', 'open', 'ack', 'closed'] as StatusFilter[]).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded transition-all capitalize',
                statusFilter === f ? 'bg-neon-cyan text-background font-bold' : 'text-muted-foreground hover:text-foreground')}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(['all', 'critical', 'high', 'medium', 'low'] as SeverityFilter[]).map(s => (
            <button key={s} onClick={() => setSevFilter(s)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded transition-all capitalize',
                sevFilter === s ? 'bg-neon-cyan text-background font-bold' : 'text-muted-foreground hover:text-foreground')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="glass-card rounded-xl p-4 h-20 animate-pulse" />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="glass-card rounded-xl py-20 text-center text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No alerts found for selected filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(alerts as any[]).map((alert) => {
            const isSelected = selected.includes(alert.id);
            const sev = severityConfig[alert.severity] || severityConfig.low;
            return (
              <div key={alert.id} className={cn('glass-card rounded-xl p-4 border flex items-start gap-3 transition-all', sev, isSelected && 'ring-1 ring-neon-cyan', alert.status !== 'open' && 'opacity-60')}>
                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(alert.id)} className="mt-1 accent-neon-cyan" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs font-bold uppercase px-2 py-0.5 rounded font-mono border', sev)}>{alert.severity}</span>
                    <span className="text-xs text-muted-foreground font-mono">{alert.source}</span>
                    {alert.organizations?.name && <span className="text-xs text-muted-foreground">— {alert.organizations.name}</span>}
                    <span className={cn('ml-auto text-xs font-mono px-2 py-0.5 rounded',
                      alert.status === 'open' ? 'bg-neon-red/10 text-neon-red' :
                      alert.status === 'ack' ? 'bg-neon-amber/10 text-neon-amber' :
                      'bg-muted text-muted-foreground'
                    )}>{alert.status}</span>
                  </div>
                  <p className="text-sm text-foreground mt-1.5 font-medium">{alert.title}</p>
                  {alert.description && <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1.5 font-mono">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {alert.status === 'open' && (
                    <button onClick={() => ackAlert([alert.id])} title="Acknowledge"
                      className="p-1.5 rounded hover:bg-neon-green/20 text-muted-foreground hover:text-neon-green transition-colors">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => dismissAlert([alert.id])} title="Close"
                    className="p-1.5 rounded hover:bg-neon-red/20 text-muted-foreground hover:text-neon-red transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AlertsPage;
