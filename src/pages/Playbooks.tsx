
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ChevronDown, ChevronRight, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaybookStep {
  step: number;
  title: string;
  description: string;
  priority: 'immediate' | 'within_1h' | 'within_24h';
}

interface Playbook {
  id: string;
  title: string;
  threat_type: string;
  severity: string;
  steps: PlaybookStep[];
  created_at: string;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  immediate: { label: 'IMMEDIATE', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  within_1h: { label: 'WITHIN 1 HOUR', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  within_24h: { label: 'WITHIN 24 HOURS', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
};

const threatTypeLabels: Record<string, string> = {
  defacement: '🌐 Website Defacement',
  ddos: '🛡️ DDoS Attack',
  dns_hijack: '🔀 DNS Hijack',
  ssl_expiry: '🔒 SSL Certificate Expiry',
  data_breach: '💾 Data Breach',
  phishing: '🎣 Phishing Domain',
  port_exposure: '🔓 Exposed Ports',
  email_spoofing: '📧 Email Spoofing',
  malware: '🦠 Malware Infection',
  general: '📋 General Incident',
};

const severityColors: Record<string, string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  all: 'bg-muted text-muted-foreground border-border',
};

const Playbooks: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, Set<number>>>({});

  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ['playbooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('playbooks')
        .select('*')
        .order('severity', { ascending: true })
        .order('title');
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        steps: Array.isArray(p.steps) ? p.steps : [],
      })) as Playbook[];
    },
  });

  const toggleStep = (playbookId: string, stepNum: number) => {
    setCompletedSteps(prev => {
      const set = new Set(prev[playbookId] || []);
      if (set.has(stepNum)) set.delete(stepNum);
      else set.add(stepNum);
      return { ...prev, [playbookId]: set };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Incident Response Playbooks</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Pre-built step-by-step response procedures for security incidents
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 border border-border h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {playbooks.map(playbook => {
            const isExpanded = expandedId === playbook.id;
            const completed = completedSteps[playbook.id] || new Set();
            const totalSteps = playbook.steps.length;
            const completedCount = completed.size;

            return (
              <div key={playbook.id} className="glass-card rounded-xl border border-border overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : playbook.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-accent/30 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{playbook.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {threatTypeLabels[playbook.threat_type] || playbook.threat_type} · {totalSteps} steps
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn('text-xs font-mono uppercase px-2 py-1 rounded border', severityColors[playbook.severity] || severityColors.all)}>
                      {playbook.severity}
                    </span>
                    {completedCount > 0 && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {completedCount}/{totalSteps}
                      </span>
                    )}
                  </div>
                </button>

                {/* Steps */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {playbook.steps.map(step => {
                      const isDone = completed.has(step.step);
                      const pri = priorityConfig[step.priority] || priorityConfig.within_24h;
                      return (
                        <div
                          key={step.step}
                          className={cn(
                            'flex gap-4 p-5 border-b border-border/50 last:border-b-0 transition-colors',
                            isDone && 'bg-primary/5'
                          )}
                        >
                          <button
                            onClick={() => toggleStep(playbook.id, step.step)}
                            className={cn(
                              'flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all mt-0.5',
                              isDone
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border hover:border-primary/50'
                            )}
                          >
                            {isDone && <CheckCircle2 className="w-4 h-4" />}
                            {!isDone && <span className="text-xs font-bold text-muted-foreground">{step.step}</span>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className={cn('font-semibold text-sm', isDone && 'line-through text-muted-foreground')}>
                                {step.title}
                              </h4>
                              <span className={cn('text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border', pri.className)}>
                                {pri.label}
                              </span>
                            </div>
                            <p className={cn('text-sm leading-relaxed', isDone ? 'text-muted-foreground' : 'text-foreground/80')}>
                              {step.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {playbooks.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No playbooks configured yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Playbooks;
