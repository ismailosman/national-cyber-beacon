import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendPoint {
  day: string;
  avg: number;
  best: number;
  worst: number;
}

interface ScoreTrendChartProps {
  data: TrendPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg p-3 border border-neon-cyan/30 text-xs">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      <p className="text-neon-cyan">Avg: {payload[0]?.value}</p>
      <p className="text-neon-green">Best Sector: {payload[1]?.value}</p>
      <p className="text-neon-red">Worst Sector: {payload[2]?.value}</p>
    </div>
  );
};

const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({ data }) => {
  if (data.length < 2) {
    return (
      <div className="glass-card rounded-xl p-5 border border-border">
        <h2 className="font-semibold text-sm text-foreground mb-4">30-Day Security Score Trend</h2>
        <div className="h-[220px] flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground text-sm animate-pulse">Collecting trend data...</p>
            <p className="text-[10px] text-muted-foreground mt-1">Check back in a few days.</p>
          </div>
        </div>
      </div>
    );
  }

  const trendDelta = data[data.length - 1].avg - data[0].avg;
  const isUp = trendDelta >= 0;

  return (
    <div className="glass-card rounded-xl p-5 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-sm text-foreground">30-Day Security Score Trend</h2>
        <span className={cn('flex items-center gap-1 text-xs font-mono',
          isUp ? 'text-neon-green' : 'text-neon-red'
        )}>
          {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {isUp ? '+' : ''}{trendDelta.toFixed(1)} pts
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(186 100% 50%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(186 100% 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 28% 16%)" />
          <XAxis dataKey="day" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="avg" stroke="hsl(186 100% 50%)" strokeWidth={2} fill="url(#avgGrad)" dot={false} />
          <Area type="monotone" dataKey="best" stroke="hsl(145 100% 50%)" strokeWidth={1} fill="none" dot={false} strokeDasharray="4 2" />
          <Area type="monotone" dataKey="worst" stroke="hsl(0 100% 60%)" strokeWidth={1} fill="none" dot={false} strokeDasharray="4 2" />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-3 h-0.5 bg-neon-cyan inline-block" /> Avg</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-3 h-0.5 bg-neon-green inline-block border-dashed" /> Best Sector</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-3 h-0.5 bg-neon-red inline-block" /> Worst Sector</span>
      </div>
    </div>
  );
};

export default ScoreTrendChart;
