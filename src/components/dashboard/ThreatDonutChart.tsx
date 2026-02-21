import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface ThreatDonutChartProps {
  critical: number;
  high: number;
  medium: number;
  low: number;
  onSegmentClick?: (severity: string) => void;
}

const COLORS = {
  Critical: 'hsl(0 100% 60%)',
  High: 'hsl(25 95% 55%)',
  Medium: 'hsl(38 100% 55%)',
  Low: 'hsl(217 91% 60%)',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="glass-card rounded-lg p-2 border border-neon-cyan/30 text-xs">
      <p className="font-mono">{payload[0].name}: {payload[0].value} findings</p>
    </div>
  );
};

const ThreatDonutChart: React.FC<ThreatDonutChartProps> = ({ critical, high, medium, low, onSegmentClick }) => {
  const total = critical + high + medium + low;
  const data = [
    { name: 'Critical', value: critical },
    { name: 'High', value: high },
    { name: 'Medium', value: medium },
    { name: 'Low', value: low },
  ].filter(d => d.value > 0);

  if (total === 0) {
    data.push({ name: 'Clean', value: 1 });
  }

  return (
    <div className="glass-card rounded-xl p-5 border border-border">
      <h2 className="font-semibold text-sm text-foreground mb-4">Threat Distribution</h2>
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={90}
              paddingAngle={2} cursor="pointer"
              onClick={(entry: any) => onSegmentClick?.(entry.name.toLowerCase())}>
              {data.map((entry, i) => (
                <Cell key={i} fill={COLORS[entry.name as keyof typeof COLORS] || 'hsl(145 100% 50%)'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold font-mono text-foreground">{total}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Threats</p>
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-4 mt-3">
        {[
          { label: 'Critical', color: 'bg-neon-red', count: critical },
          { label: 'High', color: 'bg-neon-amber', count: high },
          { label: 'Medium', color: 'bg-neon-amber/60', count: medium },
          { label: 'Low', color: 'bg-neon-blue', count: low },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${l.color}`} />
            {l.label}: {l.count}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThreatDonutChart;
