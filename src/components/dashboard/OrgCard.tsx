import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ShieldCheck, ShieldX, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface OrgCardProps {
  id: string;
  name: string;
  domain: string;
  sector: string;
  score: number;
  sslValid: boolean;
  sslDaysLeft?: number | null;
  uptimePercent: number;
  threatsCount: number;
  dastGrade?: string;
  sparkline: { score: number }[];
  checks: { headers: boolean; ports: boolean; email: boolean; dns: boolean; waf: boolean };
}

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-neon-green';
  if (score >= 75) return 'text-neon-green/80';
  if (score >= 60) return 'text-neon-amber';
  if (score >= 40) return 'text-neon-amber/80';
  return 'text-neon-red';
};

const getBarColor = (score: number) => {
  if (score >= 75) return 'bg-neon-green';
  if (score >= 50) return 'bg-neon-amber';
  return 'bg-neon-red';
};

const StatusDot = ({ good }: { good: boolean }) => (
  good
    ? <Check className="w-3 h-3 text-neon-green" />
    : <X className="w-3 h-3 text-neon-red" />
);

const OrgCard: React.FC<OrgCardProps> = ({
  id, name, domain, sector, score, sslValid, sslDaysLeft, uptimePercent,
  threatsCount, dastGrade, sparkline, checks,
}) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/organizations/${id}`)}
      className="glass-card rounded-xl p-4 border border-border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-neon-cyan/40 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-neon-cyan transition-colors">{name}</h3>
          <p className="text-[10px] text-muted-foreground font-mono truncate">{domain}</p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span className={cn('text-xl font-bold font-mono', getScoreColor(score))}>{score}</span>
          <span className={cn('w-2.5 h-2.5 rounded-full',
            score >= 75 ? 'bg-neon-green' : score >= 50 ? 'bg-neon-amber' : 'bg-neon-red'
          )} />
        </div>
      </div>

      {/* Sector badge */}
      <span className="text-[10px] px-1.5 py-0.5 rounded border font-mono text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5 capitalize">{sector}</span>

      {/* Sparkline + metrics */}
      <div className="flex gap-3 mt-3">
        <div className="w-20 h-12">
          {sparkline.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline}>
                <Area type="monotone" dataKey="score" stroke="hsl(186 100% 50%)" strokeWidth={1.5} fill="hsl(186 100% 50% / 0.1)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">No trend</div>
          )}
        </div>
        <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
          <span className="text-muted-foreground flex items-center gap-1">
            {sslValid ? <ShieldCheck className="w-3 h-3 text-neon-green" /> : <ShieldX className="w-3 h-3 text-neon-red" />}
            SSL {sslValid ? (sslDaysLeft ? `${sslDaysLeft}d` : '✓') : '✗'}
          </span>
          <span className="text-muted-foreground">Uptime: {uptimePercent.toFixed(1)}%</span>
          <span className={cn('text-muted-foreground', threatsCount > 0 && 'text-neon-red')}>
            Threats: {threatsCount}
          </span>
          <span className="text-muted-foreground">DAST: {dastGrade || '—'}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <Progress value={score} className={cn('h-1.5', getBarColor(score))} />
      </div>

      {/* Status icons */}
      <div className="flex items-center gap-3 mt-2">
        {(['headers', 'ports', 'email', 'dns', 'waf'] as const).map(key => (
          <span key={key} className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
            <StatusDot good={checks[key]} /> {key.charAt(0).toUpperCase() + key.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
};

export default OrgCard;
