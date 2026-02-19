import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ArrowLeft, CheckCircle, XCircle, AlertTriangle, Clock, Building2,
  MapPin, Tag, Radio, Loader2, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const SEVERITY_STYLES: Record<string, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: 'hsl(0 84% 60%)',    bg: 'hsl(0 84% 60% / 0.12)',    border: 'hsl(0 84% 60% / 0.3)',    label: 'CRITICAL' },
  high:     { color: 'hsl(25 95% 54%)',   bg: 'hsl(25 95% 54% / 0.12)',   border: 'hsl(25 95% 54% / 0.3)',   label: 'HIGH' },
  medium:   { color: 'hsl(48 96% 53%)',   bg: 'hsl(48 96% 53% / 0.12)',   border: 'hsl(48 96% 53% / 0.3)',   label: 'MEDIUM' },
  low:      { color: 'hsl(217 91% 60%)',  bg: 'hsl(217 91% 60% / 0.12)',  border: 'hsl(217 91% 60% / 0.3)',  label: 'LOW' },
};

const STATUS_STYLES: Record<string, { className: string }> = {
  open:   { className: 'bg-destructive/10 text-destructive border border-destructive/30' },
  ack:    { className: 'bg-amber-500/10 text-amber-400 border border-amber-500/30' },
  closed: { className: 'bg-muted text-muted-foreground border border-border' },
};

type AlertRow = {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  source: string;
  is_read: boolean | null;
  created_at: string | null;
  organization_id: string | null;
  organizations: {
    id: string;
    name: string;
    region: string;
    sector: string;
    lat: number | null;
    lng: number | null;
    contact_email: string | null;
    domain: string;
  } | null;
};

const AlertDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const { toast } = useToast();

  const canAct = userRole?.role === 'SuperAdmin' || userRole?.role === 'Analyst';

  const { data: alert, isLoading, isError } = useQuery<AlertRow | null>({
    queryKey: ['alert', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*, organizations(id, name, region, sector, lat, lng, contact_email, domain)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as AlertRow | null;
    },
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const patch: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'ack') patch.is_read = true;
      const { error } = await supabase.from('alerts').update(patch).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert', id] });
      toast({
        title: newStatus === 'ack' ? 'Alert Acknowledged' : 'Alert Closed',
        description: newStatus === 'ack'
          ? 'Alert has been marked as acknowledged.'
          : 'Alert has been closed.',
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 p-1">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !alert) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col items-center gap-4 py-24">
        <AlertTriangle className="w-10 h-10 text-destructive opacity-60" />
        <p className="text-muted-foreground text-sm">Alert not found or you don't have access.</p>
        <button
          onClick={() => navigate('/alerts')}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Alerts
        </button>
      </div>
    );
  }

  const sev = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low;
  const sta = STATUS_STYLES[alert.status] ?? STATUS_STYLES.closed;
  const createdAt = alert.created_at ? new Date(alert.created_at) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-5 p-1">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => navigate('/alerts')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Alerts
        </button>

        {canAct && (
          <div className="flex gap-2">
            {alert.status === 'open' && (
              <button
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate('ack')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
              >
                {updateStatus.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Acknowledge
              </button>
            )}
            {alert.status !== 'closed' && (
              <button
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate('closed')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-50"
              >
                {updateStatus.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Close Alert
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Main card ────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-xl border border-border p-6 space-y-5">
        {/* Severity + Status + Title */}
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span
              className="text-xs font-bold font-mono uppercase px-2.5 py-1 rounded border"
              style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}
            >
              {sev.label}
            </span>
            <span className={cn('text-xs font-mono uppercase px-2.5 py-1 rounded', sta.className)}>
              {alert.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">{alert.title}</h1>
          {alert.organizations && (
            <p className="text-sm text-muted-foreground mt-1">
              {alert.organizations.name}
              {alert.organizations.region && ` · ${alert.organizations.region}`}
              {alert.organizations.sector && ` · ${alert.organizations.sector}`}
            </p>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Description */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</h2>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {alert.description || 'No description provided.'}
          </p>
        </div>

        <div className="border-t border-border" />

        {/* Metadata grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {alert.organizations && (
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Organization</p>
                <Link
                  to={`/organizations/${alert.organizations.id}`}
                  className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                >
                  {alert.organizations.name}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {alert.organizations?.region && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Region</p>
                <p className="text-sm font-medium text-foreground">{alert.organizations.region}</p>
              </div>
            </div>
          )}

          {alert.organizations?.sector && (
            <div className="flex items-start gap-3">
              <Tag className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Sector</p>
                <p className="text-sm font-medium text-foreground capitalize">{alert.organizations.sector}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Radio className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Source</p>
              <p className="text-sm font-medium text-foreground capitalize">{alert.source}</p>
            </div>
          </div>

          {createdAt && (
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                <p className="text-sm font-medium text-foreground">
                  {format(createdAt, 'MMM d, yyyy HH:mm')} UTC
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {formatDistanceToNow(createdAt, { addSuffix: true })}
                </p>
              </div>
            </div>
          )}

          {alert.organizations?.domain && (
            <div className="flex items-start gap-3">
              <ExternalLink className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Domain</p>
                <a
                  href={`https://${alert.organizations.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {alert.organizations.domain}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Permission note for non-action users */}
      {!canAct && alert.status !== 'closed' && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Acknowledge and close actions require SuperAdmin or Analyst role.
        </p>
      )}
    </div>
  );
};

export default AlertDetail;
