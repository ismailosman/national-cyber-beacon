import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowUpCircle, ShieldCheck, Shield, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopStatsBarProps {
  orgCount: number;
  uptimeRate: number;
  sslValid: number;
  sslTotal: number;
  avgScore: number;
  activeAlerts: number;
  criticalAlerts: number;
  trends?: { orgs?: number; uptime?: number; ssl?: number; score?: number; alerts?: number };
}

const TopStatsBar: React.FC<TopStatsBarProps> = ({
  orgCount, uptimeRate, sslValid, sslTotal, avgScore, activeAlerts, criticalAlerts, trends = {}
}) => {
  const navigate = useNavigate();

  const cards = [
    {
      label: 'Organizations', value: orgCount, subtitle: 'Monitored',
      icon: Building2, color: 'neon-cyan', trend: trends.orgs, trendLabel: 'this month',
      onClick: () => navigate('/organizations'),
    },
    {
      label: 'Uptime Rate', value: `${uptimeRate.toFixed(1)}%`, subtitle: 'Avg across all',
      icon: ArrowUpCircle, color: uptimeRate >= 99 ? 'neon-green' : uptimeRate >= 95 ? 'neon-amber' : 'neon-red',
      trend: trends.uptime, trendLabel: 'vs last wk', isPercent: true,
      onClick: () => navigate('/uptime-monitor'),
    },
    {
      label: 'SSL Valid', value: `${sslValid}/${sslTotal}`, subtitle: `${sslTotal > 0 ? Math.round((sslValid / sslTotal) * 100) : 0}%`,
      icon: ShieldCheck, color: sslValid === sslTotal ? 'neon-green' : 'neon-amber',
      trend: trends.ssl, trendLabel: 'fixed',
      onClick: () => navigate('/early-warning'),
    },
    {
      label: 'Avg Security', value: avgScore, subtitle: 'out of 100',
      icon: Shield, color: avgScore >= 75 ? 'neon-green' : avgScore >= 50 ? 'neon-amber' : 'neon-red',
      trend: trends.score, trendLabel: 'pts vs last wk',
      onClick: () => navigate('/security-monitor'),
    },
    {
      label: 'Active Alerts', value: activeAlerts, subtitle: `${criticalAlerts} critical`,
      icon: AlertTriangle, color: criticalAlerts > 0 ? 'neon-red' : activeAlerts > 0 ? 'neon-amber' : 'neon-green',
      pulse: criticalAlerts > 0,
      onClick: () => navigate('/alerts'),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(card => {
        const Icon = card.icon;
        const trendUp = (card.trend ?? 0) > 0;
        const trendDown = (card.trend ?? 0) < 0;
        const hasTrend = card.trend !== undefined && card.trend !== 0;

        return (
          <div
            key={card.label}
            onClick={card.onClick}
            className={cn(
              'glass-card rounded-xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 border',
              `border-${card.color}/20 hover:border-${card.color}/40`,
              card.pulse && 'animate-neon-pulse'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">{card.label}</p>
              <div className={cn('p-1.5 rounded-lg', `bg-${card.color}/10 relative`)}>
                <Icon className={cn('w-4 h-4', `text-${card.color}`)} />
                {card.pulse && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-neon-red animate-blink" />}
              </div>
            </div>
            <p className={cn('text-2xl font-bold font-mono', `text-${card.color}`)}>{card.value}</p>
            <div className="flex items-center gap-1 mt-1">
              <p className="text-[10px] text-muted-foreground">{card.subtitle}</p>
              {hasTrend && (
                <span className={cn('flex items-center gap-0.5 text-[10px] font-mono',
                  trendUp ? 'text-neon-green' : 'text-neon-red'
                )}>
                  {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {card.isPercent ? `${Math.abs(card.trend!).toFixed(1)}%` : Math.abs(card.trend!)} {card.trendLabel}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TopStatsBar;
