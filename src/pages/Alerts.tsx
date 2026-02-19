import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Check, CheckCheck, Trash2, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type ReadFilter = 'all' | 'unread';

const severityConfig = {
  critical: 'bg-neon-red/10 text-neon-red border-neon-red/30',
  high: 'bg-neon-red/5 text-neon-red border-neon-red/20',
  medium: 'bg-neon-amber/10 text-neon-amber border-neon-amber/30',
  low: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30',
};

const AlertsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [sevFilter, setSevFilter] = useState<SeverityFilter>('all');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [selected, setSelected] = useState<string[]>([]);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts', sevFilter, readFilter],
    queryFn: async () => {
      let q = supabase.from('alerts').select('*, organizations(name)').order('created_at', { ascending: false });
      if (sevFilter !== 'all') q = q.eq('severity', sevFilter);
      if (readFilter === 'unread') q = q.eq('is_read', false);
      const { data } = await q;
      return data || [];
    },
  });

  const markRead = async (ids: string[]) => {
    await supabase.from('alerts').update({ is_read: true }).in('id', ids);
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
    queryClient.invalidateQueries({ queryKey: ['alerts-sidebar'] });
    queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
    setSelected([]);
    toast.success(`${ids.length} alert(s) marked as read`);
  };

  const dismiss = async (ids: string[]) => {
    await supabase.from('alerts').delete().in('id', ids);
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
    queryClient.invalidateQueries({ queryKey: ['alerts-sidebar'] });
    queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
    setSelected([]);
    toast.success(`${ids.length} alert(s) dismissed`);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const unreadCount = alerts.filter((a: any) => !a.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alert Center</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{unreadCount} unread · {alerts.length} total</p>
        </div>
        {selected.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => markRead(selected)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-neon-green/10 border border-neon-green/30 text-neon-green rounded-lg hover:bg-neon-green/20 transition-colors">
              <Check className="w-4 h-4" /> Mark Read ({selected.length})
            </button>
            <button onClick={() => dismiss(selected)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-neon-red/10 border border-neon-red/30 text-neon-red rounded-lg hover:bg-neon-red/20 transition-colors">
              <Trash2 className="w-4 h-4" /> Dismiss ({selected.length})
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(['all', 'unread'] as ReadFilter[]).map(f => (
            <button key={f} onClick={() => setReadFilter(f)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded transition-all',
                readFilter === f ? 'bg-neon-cyan text-background font-bold' : 'text-muted-foreground hover:text-foreground')}>
              {f === 'all' ? 'All' : 'Unread'}
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

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="glass-card rounded-xl py-20 text-center text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No alerts found for the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert: any) => {
            const isSelected = selected.includes(alert.id);
            const sev = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.low;
            return (
              <div
                key={alert.id}
                className={cn(
                  'glass-card rounded-xl p-4 border flex items-start gap-3 transition-all',
                  sev,
                  isSelected && 'ring-1 ring-neon-cyan',
                  alert.is_read && 'opacity-60'
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(alert.id)}
                  className="mt-1 accent-neon-cyan"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs font-bold uppercase px-2 py-0.5 rounded font-mono border', sev)}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{alert.type}</span>
                    {alert.organizations?.name && (
                      <span className="text-xs text-muted-foreground">— {alert.organizations.name}</span>
                    )}
                    {!alert.is_read && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-neon-cyan animate-blink flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-1.5 leading-relaxed">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 font-mono">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {!alert.is_read && (
                    <button onClick={() => markRead([alert.id])}
                      title="Mark as read"
                      className="p-1.5 rounded hover:bg-neon-green/20 text-muted-foreground hover:text-neon-green transition-colors">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => dismiss([alert.id])}
                    title="Dismiss"
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
