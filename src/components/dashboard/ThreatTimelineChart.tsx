import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TimelinePoint {
  day: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface ThreatTimelineChartProps {
  data: TimelinePoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg p-3 border border-neon-cyan/30 text-xs">
      <p className="text-muted-foreground font-mono mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.dataKey}: {p.value}</p>
      ))}
    </div>
  );
};

const ThreatTimelineChart: React.FC<ThreatTimelineChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="glass-card rounded-xl p-5 border border-border">
        <h2 className="font-semibold text-sm text-foreground mb-4">Threat Activity Timeline</h2>
        <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No threat data yet.</div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5 border border-border">
      <h2 className="font-semibold text-sm text-foreground mb-4">Threat Activity Timeline (30d)</h2>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 28% 16%)" />
          <XAxis dataKey="day" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="critical" stackId="1" stroke="hsl(0 100% 60%)" fill="hsl(0 100% 60% / 0.4)" />
          <Area type="monotone" dataKey="high" stackId="1" stroke="hsl(25 95% 55%)" fill="hsl(25 95% 55% / 0.3)" />
          <Area type="monotone" dataKey="medium" stackId="1" stroke="hsl(38 100% 55%)" fill="hsl(38 100% 55% / 0.2)" />
          <Area type="monotone" dataKey="low" stackId="1" stroke="hsl(217 91% 60%)" fill="hsl(217 91% 60% / 0.2)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ThreatTimelineChart;
