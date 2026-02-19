import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, Filter, Globe, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

type Sector = 'All' | 'Government' | 'Bank' | 'Telecom';

const statusConfig = {
  Secure: { border: 'border-l-neon-green', badge: 'bg-neon-green/10 text-neon-green border-neon-green/30', dot: 'bg-neon-green' },
  Warning: { border: 'border-l-neon-amber', badge: 'bg-neon-amber/10 text-neon-amber border-neon-amber/30', dot: 'bg-neon-amber' },
  Critical: { border: 'border-l-neon-red', badge: 'bg-neon-red/10 text-neon-red border-neon-red/30', dot: 'bg-neon-red' },
};

const Organizations: React.FC = () => {
  const navigate = useNavigate();
  const [sector, setSector] = useState<Sector>('All');
  const [search, setSearch] = useState('');

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('*').order('name');
      return data || [];
    },
  });

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
      </div>

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
        <div className="flex gap-2">
          {(['All', 'Government', 'Bank', 'Telecom'] as Sector[]).map(s => (
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
                  <div>
                    <span className={cn('text-xs px-2 py-0.5 rounded border font-mono', status.badge)}>
                      {org.status}
                    </span>
                    <span className="ml-2 text-xs px-2 py-0.5 rounded border font-mono text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5">
                      {org.sector}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={cn('text-2xl font-bold font-mono',
                      org.risk_score >= 75 ? 'text-neon-green' :
                      org.risk_score >= 50 ? 'text-neon-amber' : 'text-neon-red'
                    )}>{org.risk_score}</span>
                    <span className="text-muted-foreground text-xs ml-1">/100</span>
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
