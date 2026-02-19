import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, RefreshCw, Settings as SettingsIcon, Shield, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const SECTORS = ['government', 'bank', 'telecom', 'health', 'education', 'other'];
const REGIONS = ['Banaadir', 'Jubbaland', 'Puntland', 'Hirshabelle', 'Galmudug', 'South West', 'Somaliland'];

const Settings: React.FC = () => {
  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = userRole?.role === 'SuperAdmin';

  const [newOrg, setNewOrg] = useState({ name: '', sector: 'government', domain: '', region: 'Banaadir', lat: '', lng: '' });
  const [addingOrg, setAddingOrg] = useState(false);
  const [fullScan, setFullScan] = useState(false);

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('*').order('name');
      return data || [];
    },
  });

  const handleAddOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrg.name || !newOrg.domain) { toast.error('Name and domain required'); return; }
    setAddingOrg(true);
    const { error } = await supabase.from('organizations').insert({
      name: newOrg.name,
      sector: newOrg.sector as any,
      domain: newOrg.domain,
      region: newOrg.region,
      lat: newOrg.lat ? parseFloat(newOrg.lat) : null,
      lng: newOrg.lng ? parseFloat(newOrg.lng) : null,
      risk_score: 50,
      status: 'Warning',
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Organization added');
      setNewOrg({ name: '', sector: 'government', domain: '', region: 'Banaadir', lat: '', lng: '' });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    }
    setAddingOrg(false);
  };

  const handleDeleteOrg = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('organizations').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Organization removed');
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    }
  };

  const handleFullScan = async () => {
    setFullScan(true);
    try {
      let successCount = 0;
      for (const org of orgs as any[]) {
        const { error } = await supabase.functions.invoke('run-security-checks', { body: { org_id: org.id } });
        if (!error) successCount++;
      }
      toast.success(`Full scan completed — ${successCount}/${(orgs as any[]).length} orgs scanned`);
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error('Full scan failed: ' + err.message);
    } finally {
      setFullScan(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Shield className="w-12 h-12 opacity-30" />
        <h2 className="text-lg font-semibold">Access Restricted</h2>
        <p className="text-sm">Settings are only accessible to SuperAdmin users.</p>
        <p className="text-xs font-mono">Your role: {userRole?.role || 'None'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Platform administration · SuperAdmin</p>
        </div>
        <button
          onClick={handleFullScan}
          disabled={fullScan}
          className="flex items-center gap-2 px-4 py-2.5 bg-neon-amber/10 border border-neon-amber/30 text-neon-amber font-semibold text-sm rounded-lg hover:bg-neon-amber/20 transition-all disabled:opacity-50"
        >
          {fullScan ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {fullScan ? 'Scanning All...' : 'Trigger Full Scan'}
        </button>
      </div>

      {/* Add Organization */}
      <div className="glass-card rounded-xl p-6 border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-neon-cyan" /> Add Organization
        </h3>
        <form onSubmit={handleAddOrg} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input placeholder="Organization name" value={newOrg.name} onChange={e => setNewOrg(p => ({ ...p, name: e.target.value }))}
            className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all" />
          <input placeholder="domain.so" value={newOrg.domain} onChange={e => setNewOrg(p => ({ ...p, domain: e.target.value }))}
            className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all font-mono" />
          <select value={newOrg.sector} onChange={e => setNewOrg(p => ({ ...p, sector: e.target.value }))}
            className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all capitalize">
            {SECTORS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
          <select value={newOrg.region} onChange={e => setNewOrg(p => ({ ...p, region: e.target.value }))}
            className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all">
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input placeholder="Latitude (e.g. 2.0469)" value={newOrg.lat} onChange={e => setNewOrg(p => ({ ...p, lat: e.target.value }))}
            className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all font-mono" />
          <input placeholder="Longitude (e.g. 45.3182)" value={newOrg.lng} onChange={e => setNewOrg(p => ({ ...p, lng: e.target.value }))}
            className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all font-mono" />
          <button type="submit" disabled={addingOrg}
            className="sm:col-span-2 lg:col-span-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-neon-cyan text-background font-bold text-sm rounded-lg hover:brightness-110 transition-all disabled:opacity-50 glow-cyan">
            {addingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Organization
          </button>
        </form>
      </div>

      {/* Organizations List */}
      <div className="glass-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-neon-cyan" />
          <h3 className="text-sm font-semibold">Manage Organizations ({(orgs as any[]).length})</h3>
        </div>
        <div className="divide-y divide-border/50">
          {(orgs as any[]).map((org) => (
            <div key={org.id} className="p-4 flex items-center gap-4 hover:bg-accent/20 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{org.name}</p>
                <p className="text-xs text-muted-foreground font-mono capitalize">{org.domain} · {org.sector} · {org.region}</p>
                {org.lat && org.lng && (
                  <p className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />{org.lat.toFixed(4)}, {org.lng.toFixed(4)}
                  </p>
                )}
                {org.last_scan && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Last scanned: {formatDistanceToNow(new Date(org.last_scan), { addSuffix: true })}
                  </p>
                )}
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded font-bold font-mono',
                org.status === 'Secure' ? 'text-neon-green bg-neon-green/10' :
                org.status === 'Warning' ? 'text-neon-amber bg-neon-amber/10' :
                'text-neon-red bg-neon-red/10'
              )}>{org.risk_score}</span>
              <button onClick={() => handleDeleteOrg(org.id, org.name)}
                className="p-2 rounded-lg hover:bg-neon-red/10 hover:text-neon-red text-muted-foreground transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {(orgs as any[]).length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">No organizations added yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
