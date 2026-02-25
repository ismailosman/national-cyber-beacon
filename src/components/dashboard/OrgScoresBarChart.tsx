import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { cn } from '@/lib/utils';

interface OrgScore {
  id: string;
  name: string;
  sector: string;
  score: number;
  sslValid?: boolean;
  uptimePercent?: number;
  threatsCount?: number;
}

interface OrgScoresBarChartProps {
  data: OrgScore[];
}

const SECTORS = ['All', 'Government', 'Bank', 'Telecom', 'Education', 'Health', 'Other'];

const getBarColor = (score: number) => {
  if (score >= 90) return 'hsl(145 100% 50%)';
  if (score >= 75) return 'hsl(145 70% 60%)';
  if (score >= 60) return 'hsl(38 100% 55%)';
  if (score >= 40) return 'hsl(25 95% 55%)';
  return 'hsl(0 100% 60%)';
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="glass-card rounded-lg p-3 border border-neon-cyan/30 text-xs">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-neon-cyan font-mono mt-1">Score: {d.score}/100</p>
      <p className="text-muted-foreground">SSL: {d.sslValid ? '✓' : '✗'} | Uptime: {d.uptimePercent?.toFixed(1) ?? '—'}% | Threats: {d.threatsCount ?? 0}</p>
    </div>
  );
};

const OrgScoresBarChart: React.FC<OrgScoresBarChartProps> = ({ data }) => {
  const [sectorFilter, setSectorFilter] = useState('Telecom');
  const navigate = useNavigate();

  const filtered = sectorFilter === 'All' ? data : data.filter(d => d.sector.toLowerCase() === sectorFilter.toLowerCase());
  const sorted = [...filtered].sort((a, b) => b.score - a.score);

  return (
    <div className="glass-card rounded-xl p-5 border border-border">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold text-sm text-foreground">Organization Security Scores</h2>
        <div className="flex gap-1 flex-wrap">
          {SECTORS.map(s => (
            <button key={s} onClick={() => setSectorFilter(s)}
              className={cn('px-2 py-0.5 rounded text-[10px] font-mono transition-colors border',
                sectorFilter === s
                  ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40'
                  : 'bg-transparent text-muted-foreground border-border hover:border-neon-cyan/20'
              )}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(sorted.length * 32, 200)}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
          onClick={(e: any) => {
            if (e?.activePayload?.[0]?.payload?.id) {
              navigate(`/organizations/${e.activePayload[0].payload.id}`);
            }
          }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 28% 16%)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={70} stroke="hsl(38 100% 55%)" strokeDasharray="5 5" label={{ value: 'Target', fill: 'hsl(38 100% 55%)', fontSize: 9 }} />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} cursor="pointer">
            {sorted.map((entry, i) => (
              <Cell key={i} fill={getBarColor(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OrgScoresBarChart;
