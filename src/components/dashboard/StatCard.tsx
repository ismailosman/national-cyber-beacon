import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'cyan' | 'green' | 'amber' | 'red';
  pulse?: boolean;
}

const colorMap = {
  cyan: {
    icon: 'text-neon-cyan',
    border: 'border-l-neon-cyan',
    bg: 'bg-neon-cyan/5',
    value: 'text-neon-cyan',
  },
  green: {
    icon: 'text-neon-green',
    border: 'border-l-neon-green',
    bg: 'bg-neon-green/5',
    value: 'text-neon-green',
  },
  amber: {
    icon: 'text-neon-amber',
    border: 'border-l-neon-amber',
    bg: 'bg-neon-amber/5',
    value: 'text-neon-amber',
  },
  red: {
    icon: 'text-neon-red',
    border: 'border-l-neon-red',
    bg: 'bg-neon-red/5',
    value: 'text-neon-red',
  },
};

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon: Icon, color = 'cyan', pulse }) => {
  const colors = colorMap[color];
  return (
    <div className={cn(
      'glass-card rounded-xl p-5 border-l-4 animate-fade-in-up',
      colors.border, colors.bg
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">{title}</p>
          <p className={cn('text-3xl font-bold font-mono', colors.value)}>
            {value}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={cn('p-2.5 rounded-lg', colors.bg, 'relative')}>
          <Icon className={cn('w-5 h-5', colors.icon)} />
          {pulse && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-neon-red animate-blink" />
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
