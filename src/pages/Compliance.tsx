import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CheckSquare, Building2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusStyle: Record<string, string> = {
  pass: 'bg-neon-green/10 text-neon-green border-neon-green/30',
  fail: 'bg-neon-red/10 text-neon-red border-neon-red/30',
  partial: 'bg-neon-amber/10 text-neon-amber border-neon-amber/30',
  not_applicable: 'bg-muted text-muted-foreground border-border',
};

const domainColors: Record<string, string> = {
  Identity: 'text-neon-blue',
  Network: 'text-neon-cyan',
  Endpoint: 'text-neon-green',
  App: 'text-neon-purple',
  Data: 'text-neon-amber',
  IR: 'text-neon-red',
  Backup: 'text-neon-green',
};

const Compliance: React.FC = () => {
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedFramework, setSelectedFramework] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('id, name, sector').order('name');
      return data || [];
    },
  });

  const { data: frameworks = [] } = useQuery({
    queryKey: ['frameworks'],
    queryFn: async () => {
      const { data } = await supabase.from('compliance_frameworks').select('*').order('name');
      return data || [];
    },
  });

  const { data: controls = [] } = useQuery({
    queryKey: ['controls', selectedFramework],
    enabled: !!selectedFramework,
    queryFn: async () => {
      const { data } = await supabase.from('controls').select('*').eq('framework_id', selectedFramework).order('control_code');
      return data || [];
    },
  });

  const { data: results = [] } = useQuery({
    queryKey: ['control-results', selectedOrg, selectedFramework],
    enabled: !!selectedOrg && !!selectedFramework,
    queryFn: async () => {
      const { data } = await supabase.from('control_results').select('*').eq('organization_id', selectedOrg);
      return data || [];
    },
  });

  const getResult = (controlId: string) => (results as any[]).find(r => r.control_id === controlId);

  const passCount = (controls as any[]).filter(c => getResult(c.id)?.status === 'pass').length;
  const failCount = (controls as any[]).filter(c => getResult(c.id)?.status === 'fail').length;
  const totalAssessed = (results as any[]).length;
  const score = totalAssessed > 0 ? Math.round((passCount / (controls as any[]).length) * 100) : null;

  const domains = ['all', ...Array.from(new Set((controls as any[]).map(c => c.domain)))];
  const filtered = (controls as any[]).filter(c => domainFilter === 'all' || c.domain === domainFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Compliance</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Framework-based control assessment and scoring</p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Organization</label>
          <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}
            className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all">
            <option value="">Select organization...</option>
            {(orgs as any[]).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5" /> Framework</label>
          <select value={selectedFramework} onChange={e => setSelectedFramework(e.target.value)}
            className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all">
            <option value="">Select framework...</option>
            {(frameworks as any[]).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>

      {/* Score summary */}
      {selectedOrg && selectedFramework && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Compliance Score', value: score !== null ? `${score}%` : 'N/A', color: score !== null ? (score >= 80 ? 'text-neon-green' : score >= 60 ? 'text-neon-amber' : 'text-neon-red') : 'text-muted-foreground' },
              { label: 'Controls Total', value: controls.length, color: 'text-neon-cyan' },
              { label: 'Passing', value: passCount, color: 'text-neon-green' },
              { label: 'Failing', value: failCount, color: 'text-neon-red' },
            ].map(c => (
              <div key={c.label} className="glass-card rounded-xl p-4 border border-border text-center">
                <p className={cn('text-2xl font-bold font-mono', c.color)}>{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Domain filter */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit flex-wrap">
            {domains.map(d => (
              <button key={d} onClick={() => setDomainFilter(d)}
                className={cn('px-3 py-1.5 text-xs font-medium rounded transition-all',
                  domainFilter === d ? 'bg-neon-cyan text-background font-bold' : 'text-muted-foreground hover:text-foreground')}>
                {d}
              </button>
            ))}
          </div>

          {/* Controls table */}
          <div className="glass-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Code</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Control</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider hidden sm:table-cell">Domain</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider hidden md:table-cell">Type</th>
                    <th className="text-center p-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ctrl: any) => {
                    const result = getResult(ctrl.id);
                    return (
                      <tr key={ctrl.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                        <td className="p-3 font-mono text-xs text-neon-cyan">{ctrl.control_code}</td>
                        <td className="p-3">
                          <p className="font-medium text-sm">{ctrl.title}</p>
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          <span className={cn('text-xs font-medium', domainColors[ctrl.domain] || 'text-muted-foreground')}>{ctrl.domain}</span>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground capitalize">{ctrl.evidence_type}</span>
                        </td>
                        <td className="p-3 text-center">
                          {result ? (
                            <span className={cn('text-xs px-2 py-1 rounded-full font-bold uppercase border', statusStyle[result.status] || statusStyle.not_applicable)}>
                              {result.status.replace('_', ' ')}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground font-mono">Not Assessed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selectedOrg && !selectedFramework && (
        <div className="glass-card rounded-xl py-20 text-center text-muted-foreground border border-border">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Select an organization and framework to view compliance status.</p>
        </div>
      )}
    </div>
  );
};

export default Compliance;
