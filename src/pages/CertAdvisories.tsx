import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Radio, Plus, AlertTriangle, Shield, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { formatET } from '@/lib/dateUtils';
import { toast } from 'sonner';

const severityStyle: Record<string, string> = {
  critical: 'bg-neon-red/10 text-neon-red border-neon-red/30',
  high: 'bg-neon-red/5 text-neon-red border-neon-red/20',
  medium: 'bg-neon-amber/10 text-neon-amber border-neon-amber/30',
  low: 'bg-neon-cyan/5 text-neon-cyan border-neon-cyan/10',
};

const tabs = ['Advisories', 'IOC Matches'] as const;
type Tab = typeof tabs[number];

const CertAdvisories: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('Advisories');
  const [showForm, setShowForm] = useState(false);
  const [selectedAdvisory, setSelectedAdvisory] = useState<any>(null);
  const [form, setForm] = useState({
    title: '', summary: '', severity: 'medium',
    domains: '', ips: '', hashes: '', sectors: 'government',
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: advisories = [], isLoading: advisoriesLoading } = useQuery({
    queryKey: ['cert-advisories'],
    queryFn: async () => {
      const { data } = await supabase.from('cert_advisories').select('*').order('published_at', { ascending: false });
      return data || [];
    },
  });

  const { data: iocMatches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['ioc-matches'],
    queryFn: async () => {
      const { data } = await supabase.from('ioc_matches').select('*, organizations(name), cert_advisories(title, severity)').eq('status', 'open').order('detected_at', { ascending: false });
      return data || [];
    },
  });

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.summary) { toast.error('Title and summary required'); return; }
    setSubmitting(true);

    const iocs = {
      domains: form.domains.split('\n').map(s => s.trim()).filter(Boolean),
      ips: form.ips.split('\n').map(s => s.trim()).filter(Boolean),
      hashes: form.hashes.split('\n').map(s => s.trim()).filter(Boolean),
    };

    const { error } = await supabase.from('cert_advisories').insert({
      title: form.title,
      summary: form.summary,
      severity: form.severity as any,
      iocs,
      affected_sectors: form.sectors ? [form.sectors] as any : [],
    });

    if (error) toast.error(error.message);
    else {
      toast.success('Advisory published');
      setForm({ title: '', summary: '', severity: 'medium', domains: '', ips: '', hashes: '', sectors: 'government' });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['cert-advisories'] });
    }
    setSubmitting(false);
  };

  const closeMatch = async (id: string) => {
    await supabase.from('ioc_matches').update({ status: 'closed' }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['ioc-matches'] });
    toast.success('IOC match closed');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Radio className="w-6 h-6 text-neon-cyan" /> CERT-SO Interface
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Threat advisories · IOC matching · Intelligence sharing</p>
        </div>
        {tab === 'Advisories' && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 bg-neon-cyan text-background font-bold text-sm rounded-lg hover:brightness-110 transition-all glow-cyan">
            <Plus className="w-4 h-4" /> Publish Advisory
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm font-medium rounded transition-all',
              tab === t ? 'bg-neon-cyan text-background font-bold' : 'text-muted-foreground hover:text-foreground')}>
            {t}
          </button>
        ))}
      </div>

      {/* Advisory form */}
      {tab === 'Advisories' && showForm && (
        <div className="glass-card rounded-xl p-6 border border-neon-cyan/30">
          <h3 className="text-sm font-semibold mb-4">New CERT Advisory</h3>
          <form onSubmit={handlePublish} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Advisory title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="sm:col-span-2 px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all" />
            <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
              className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all">
              {['low', 'medium', 'high', 'critical'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
            <select value={form.sectors} onChange={e => setForm(p => ({ ...p, sectors: e.target.value }))}
              className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all">
              {['government', 'bank', 'telecom', 'health', 'education', 'other'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
            <textarea placeholder="Summary / description..." value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))}
              rows={3} className="sm:col-span-2 px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all resize-none" />
            <textarea placeholder="IOC Domains (one per line)&#10;example.com&#10;phishing.net" value={form.domains} onChange={e => setForm(p => ({ ...p, domains: e.target.value }))}
              rows={3} className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all resize-none font-mono text-xs" />
            <textarea placeholder="IOC IPs (one per line)&#10;1.2.3.4&#10;5.6.7.8" value={form.ips} onChange={e => setForm(p => ({ ...p, ips: e.target.value }))}
              rows={3} className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all resize-none font-mono text-xs" />
            <textarea placeholder="File Hashes (one per line)&#10;sha256:abc123..." value={form.hashes} onChange={e => setForm(p => ({ ...p, hashes: e.target.value }))}
              rows={3} className="sm:col-span-2 px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all resize-none font-mono text-xs" />
            <button type="submit" disabled={submitting}
              className="sm:col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-neon-cyan text-background font-bold text-sm rounded-lg hover:brightness-110 transition-all disabled:opacity-50 glow-cyan">
              {submitting ? 'Publishing...' : 'Publish Advisory'}
            </button>
          </form>
        </div>
      )}

      {/* Advisories list */}
      {tab === 'Advisories' && (
        <div className="space-y-3">
          {advisoriesLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card rounded-xl p-4 h-24 animate-pulse" />)
          ) : (advisories as any[]).map((adv) => (
            <div key={adv.id}
              onClick={() => setSelectedAdvisory(selectedAdvisory?.id === adv.id ? null : adv)}
              className={cn('glass-card rounded-xl p-4 border cursor-pointer transition-all hover:bg-accent/30', severityStyle[adv.severity] || severityStyle.low)}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs font-bold uppercase px-2 py-0.5 rounded font-mono border', severityStyle[adv.severity])}>{adv.severity}</span>
                    <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />{formatDistanceToNow(new Date(adv.published_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="font-semibold text-sm mt-2">{adv.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{adv.summary}</p>
                  {selectedAdvisory?.id === adv.id && adv.iocs && (
                    <div className="mt-3 p-3 rounded-lg bg-background/50 font-mono text-xs space-y-2">
                      {adv.iocs.domains?.length > 0 && (
                        <div><span className="text-neon-amber">Domains:</span> <span className="text-muted-foreground">{adv.iocs.domains.join(', ')}</span></div>
                      )}
                      {adv.iocs.ips?.length > 0 && (
                        <div><span className="text-neon-red">IPs:</span> <span className="text-muted-foreground">{adv.iocs.ips.join(', ')}</span></div>
                      )}
                      {adv.iocs.hashes?.length > 0 && (
                        <div><span className="text-neon-cyan">Hashes:</span> <span className="text-muted-foreground">{adv.iocs.hashes.slice(0, 2).join(', ')}{adv.iocs.hashes.length > 2 ? '...' : ''}</span></div>
                      )}
                      {adv.affected_sectors?.length > 0 && (
                        <div><span className="text-neon-green">Sectors:</span> <span className="text-muted-foreground capitalize">{adv.affected_sectors.join(', ')}</span></div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!advisoriesLoading && advisories.length === 0 && (
            <div className="glass-card rounded-xl py-16 text-center text-muted-foreground border border-border">
              <Radio className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>No advisories published yet.</p>
            </div>
          )}
        </div>
      )}

      {/* IOC Matches */}
      {tab === 'IOC Matches' && (
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Shield className="w-4 h-4 text-neon-cyan" />
            <h3 className="text-sm font-semibold">Open IOC Matches</h3>
            <span className="ml-auto text-xs bg-neon-red text-background font-bold px-2 py-0.5 rounded-full">{iocMatches.length}</span>
          </div>
          <div className="divide-y divide-border/50">
            {matchesLoading ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="p-4 h-16 animate-pulse" />)
            ) : (iocMatches as any[]).length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-20 text-neon-green" />
                <p>No open IOC matches — no assets matched active advisories.</p>
              </div>
            ) : (iocMatches as any[]).map((match) => (
              <div key={match.id} className="p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium font-mono text-neon-red">{match.matched_ioc}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{match.organizations?.name} · {match.cert_advisories?.title}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{formatET(match.detected_at, 'MMM dd, HH:mm')} ET</p>
                </div>
                <button onClick={() => closeMatch(match.id)}
                  className="px-3 py-1.5 text-xs border border-border text-muted-foreground rounded-lg hover:bg-accent hover:text-foreground transition-colors">
                  Close
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CertAdvisories;
