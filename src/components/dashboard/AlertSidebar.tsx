import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bell, AlertTriangle, Info, Shield, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const severityConfig = {
  critical: { color: 'text-neon-red', bg: 'bg-neon-red/10 border-neon-red/30', icon: AlertTriangle },
  high: { color: 'text-neon-red', bg: 'bg-neon-red/5 border-neon-red/20', icon: AlertTriangle },
  medium: { color: 'text-neon-amber', bg: 'bg-neon-amber/5 border-neon-amber/20', icon: Bell },
  low: { color: 'text-neon-cyan', bg: 'bg-neon-cyan/5 border-neon-cyan/20', icon: Info },
};

const AlertSidebar: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts-sidebar'],
    queryFn: async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('alerts')
        .select('*, organizations(name)')
        .eq('status', 'open')
        .not('organization_id', 'is', null)
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const channel = supabase.channel('alerts-sidebar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['alerts-sidebar'] });
      }).subscribe();

    return () => { channel.unsubscribe(); };
  }, [queryClient]);

  return (
    <div className="w-72 flex-shrink-0 glass-card rounded-xl border border-border flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Bell className="w-4 h-4 text-neon-amber" />
        <h3 className="font-semibold text-sm text-foreground">Live Alerts</h3>
        {alerts.length > 0 && (
          <span className="ml-auto text-xs bg-neon-red text-background font-bold px-2 py-0.5 rounded-full animate-blink">
            {alerts.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <Shield className="w-8 h-8 text-neon-green" />
            <p className="text-xs text-center">No active alerts — system nominal</p>
          </div>
        ) : (
          alerts.map((alert: any) => {
            const cfg = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.low;
            const Icon = cfg.icon;
            return (
              <div key={alert.id} className={cn('p-3 rounded-lg border text-xs', cfg.bg)}>
                <div className="flex items-start gap-2">
                  <Icon className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5', cfg.color)} />
                  <div className="min-w-0">
                    <p className={cn('font-semibold uppercase text-[10px] tracking-wider', cfg.color)}>
                      {alert.severity}
                    </p>
                    <p className="text-foreground leading-tight mt-0.5">{alert.title}</p>
                    {alert.description && <p className="text-muted-foreground leading-tight mt-0.5 line-clamp-2">{alert.description}</p>}
                    {alert.organizations?.name && (
                      <p className="text-muted-foreground mt-1 truncate">{alert.organizations.name}</p>
                    )}
                    <p className="text-muted-foreground mt-1 font-mono text-[10px]">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AlertSidebar;
