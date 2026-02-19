import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
export type StatusFilter = 'all' | 'open' | 'ack' | 'closed';

export interface AlertFilters {
  severity: SeverityFilter;
  status: StatusFilter;
}

export interface AlertWithOrg {
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
    lat: number | null;
    lng: number | null;
    region: string;
    sector: string;
  } | null;
}

export function useAlerts(filters: AlertFilters) {
  return useQuery({
    queryKey: ['alerts', filters.severity, filters.status],
    queryFn: async () => {
      let q = supabase
        .from('alerts')
        .select('*, organizations(id, name, lat, lng, region, sector)')
        .order('created_at', { ascending: false });

      if (filters.severity !== 'all') q = q.eq('severity', filters.severity as any);
      if (filters.status !== 'all') q = q.eq('status', filters.status);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AlertWithOrg[];
    },
  });
}
