import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertOctagon, Plus, Clock, User, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

const CATEGORIES = ['phishing', 'fraud', 'malware', 'ddos', 'breach', 'defacement', 'other'];
const STATUSES = ['new', 'triage', 'investigating', 'contained', 'resolved', 'closed'];

const statusStyle: Record<string, string> = {
  new: 'bg-neon-red/10 text-neon-red border-neon-red/30',
  triage: 'bg-neon-amber/10 text-neon-amber border-neon-amber/30',
  investigating: 'bg-neon-blue/10 text-neon-blue border-neon-blue/30',
  contained: 'bg-neon-purple/10 text-neon-purple border-neon-purple/30',
  resolved: 'bg-neon-green/10 text-neon-green border-neon-green/30',
  closed: 'bg-muted text-muted-foreground border-border',
};

const severityStyle: Record<string, string> = {
  critical: 'text-neon-red',
  high: 'text-neon-red',
  medium: 'text-neon-amber',
  low: 'text-neon-cyan',
};

const Incidents: React.FC = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ category: 'phishing', severity: 'medium', description: '', reporter_email: '', affected_assets: '' });
  const [submitting, setSubmitting] = useState(false);
  const [newNote, setNewNote] = useState('');

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents', statusFilter],
    queryFn: async () => {
      let q = supabase.from('incident_reports').select('*, organizations(name)').order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter as any);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['incident-timeline', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase.from('incident_timeline').select('*').eq('incident_id', selectedId!).order('created_at', { ascending: true });
      return data || [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description) { toast.error('Description is required'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('incident_reports').insert({
      reporter_type: 'org',
      reporter_email: form.reporter_email || null,
      category: form.category,
      severity: form.severity as any,
      description: form.description,
      affected_assets: form.affected_assets || null,
      status: 'new',
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Incident report submitted');
      setForm({ category: 'phishing', severity: 'medium', description: '', reporter_email: '', affected_assets: '' });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    }
    setSubmitting(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('incident_reports').update({ status: status as any }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['incidents'] });
    toast.success('Status updated');
  };

  const addNote = async () => {
    if (!newNote || !selectedId) return;
    await supabase.from('incident_timeline').insert({ incident_id: selectedId, action: 'Note added', notes: newNote });
    setNewNote('');
    queryClient.invalidateQueries({ queryKey: ['incident-timeline', selectedId] });
    toast.success('Note added');
  };

  const selected = (incidents as any[]).find(i => i.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incident Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{(incidents as any[]).filter(i => i.status === 'new').length} new · {incidents.length} total</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-neon-red text-background font-bold text-sm rounded-lg hover:brightness-110 transition-all">
          <Plus className="w-4 h-4" /> Report Incident
        </button>
      </div>

      {/* Report Form */}
      {showForm && (
        <div className="glass-card rounded-xl p-6 border border-neon-red/30">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-neon-red" /> New Incident Report
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all capitalize">
              {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
            <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
              className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all capitalize">
              {['low', 'medium', 'high', 'critical'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
            <input placeholder="Reporter email (optional)" value={form.reporter_email} onChange={e => setForm(p => ({ ...p, reporter_email: e.target.value }))}
              className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all" />
            <input placeholder="Affected assets (optional)" value={form.affected_assets} onChange={e => setForm(p => ({ ...p, affected_assets: e.target.value }))}
              className="px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all" />
            <textarea placeholder="Describe the incident in detail..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={3} className="sm:col-span-2 px-3 py-2.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:border-neon-cyan transition-all resize-none" />
            <button type="submit" disabled={submitting}
              className="sm:col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-neon-red text-background font-bold text-sm rounded-lg hover:brightness-110 transition-all disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit flex-wrap">
        {(['all', ...STATUSES]).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('px-3 py-1.5 text-xs font-medium rounded transition-all capitalize',
              statusFilter === s ? 'bg-neon-cyan text-background font-bold' : 'text-muted-foreground hover:text-foreground')}>
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* List */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-xl p-4 h-20 animate-pulse" />)
          ) : (incidents as any[]).map((incident) => (
            <div key={incident.id}
              onClick={() => setSelectedId(incident.id === selectedId ? null : incident.id)}
              className={cn('glass-card rounded-xl p-4 border cursor-pointer transition-all hover:bg-accent/30',
                selectedId === incident.id ? 'border-neon-cyan/50 ring-1 ring-neon-cyan/30' : 'border-border')}>
              <div className="flex items-start gap-3">
                <AlertOctagon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', severityStyle[incident.severity] || 'text-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs font-bold uppercase px-2 py-0.5 rounded font-mono border', statusStyle[incident.status] || statusStyle.new)}>
                      {incident.status}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">{incident.category}</span>
                    <span className={cn('text-xs font-mono ml-auto', severityStyle[incident.severity])}>{incident.severity}</span>
                  </div>
                  <p className="text-sm text-foreground mt-1.5 line-clamp-2">{incident.description}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          ))}
          {!isLoading && incidents.length === 0 && (
            <div className="glass-card rounded-xl py-16 text-center text-muted-foreground">
              <AlertOctagon className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>No incidents found.</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="glass-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <AlertOctagon className={cn('w-4 h-4', severityStyle[selected.severity])} />
              <h3 className="text-sm font-semibold capitalize">{selected.category} — {selected.severity}</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm">{selected.description}</p>
              {selected.affected_assets && <p className="text-xs text-muted-foreground font-mono">Assets: {selected.affected_assets}</p>}
              {selected.reporter_email && <p className="text-xs text-muted-foreground">Reporter: {selected.reporter_email}</p>}

              {/* Status change */}
              <div>
                <p className="text-xs text-muted-foreground font-mono mb-2">Update Status:</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)}
                      className={cn('px-2.5 py-1 text-xs rounded-lg border font-medium capitalize transition-colors',
                        selected.status === s ? cn(statusStyle[s], 'font-bold') : 'border-border text-muted-foreground hover:bg-accent')}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <p className="text-xs text-muted-foreground font-mono mb-2">Timeline ({timeline.length}):</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(timeline as any[]).map(entry => (
                    <div key={entry.id} className="text-xs p-2 rounded bg-muted/50">
                      <p className="font-medium">{entry.action}</p>
                      {entry.notes && <p className="text-muted-foreground mt-0.5">{entry.notes}</p>}
                      <p className="text-muted-foreground mt-0.5 font-mono">{format(new Date(entry.created_at), 'MMM dd HH:mm')}</p>
                    </div>
                  ))}
                  {timeline.length === 0 && <p className="text-muted-foreground text-xs">No timeline entries yet.</p>}
                </div>
                <div className="flex gap-2 mt-2">
                  <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..."
                    className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-xs focus:outline-none focus:border-neon-cyan transition-all" />
                  <button onClick={addNote} className="px-3 py-2 bg-neon-cyan text-background text-xs font-bold rounded-lg hover:brightness-110 transition-all">Add</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Incidents;
