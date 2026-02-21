import React, { useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SectorData {
  sector: string;
  orgCount: number;
  avgScore: number;
  sslValid: number;
  sslTotal: number;
  uptimeAvg: number;
  threatsCount: number;
  trend: 'up' | 'down' | 'stable';
}

interface SectorComparisonProps {
  data: SectorData[];
  onSectorClick?: (sector: string) => void;
}

const COLORS = ['hsl(186 100% 50%)', 'hsl(145 100% 50%)', 'hsl(38 100% 55%)', 'hsl(0 100% 60%)', 'hsl(217 91% 60%)', 'hsl(270 80% 65%)'];

const SectorComparison: React.FC<SectorComparisonProps> = ({ data, onSectorClick }) => {
  const [open, setOpen] = useState(false);

  const radarData = [
    { dimension: 'Score', ...Object.fromEntries(data.map(d => [d.sector, d.avgScore])) },
    { dimension: 'SSL %', ...Object.fromEntries(data.map(d => [d.sector, d.sslTotal > 0 ? Math.round((d.sslValid / d.sslTotal) * 100) : 0])) },
    { dimension: 'Uptime', ...Object.fromEntries(data.map(d => [d.sector, Math.round(d.uptimeAvg)])) },
    { dimension: 'Low Threats', ...Object.fromEntries(data.map(d => [d.sector, Math.max(0, 100 - d.threatsCount * 10)])) },
  ];

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <TrendingUp className="w-3 h-3 text-neon-green" />;
    if (trend === 'down') return <TrendingDown className="w-3 h-3 text-neon-red" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full glass-card rounded-xl p-4 border border-border flex items-center justify-between cursor-pointer hover:border-neon-cyan/30 transition-colors">
        <h2 className="font-semibold text-sm text-foreground">Sector Comparison</h2>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="glass-card rounded-xl p-5 border border-border">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 text-muted-foreground font-mono uppercase">Sector</th>
                    <th className="text-center p-2 text-muted-foreground font-mono uppercase">Orgs</th>
                    <th className="text-center p-2 text-muted-foreground font-mono uppercase">Avg Score</th>
                    <th className="text-center p-2 text-muted-foreground font-mono uppercase">SSL</th>
                    <th className="text-center p-2 text-muted-foreground font-mono uppercase">Uptime</th>
                    <th className="text-center p-2 text-muted-foreground font-mono uppercase">Threats</th>
                    <th className="text-center p-2 text-muted-foreground font-mono uppercase">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(row => (
                    <tr key={row.sector} className="border-b border-border/50 hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => onSectorClick?.(row.sector)}>
                      <td className="p-2 font-medium capitalize">{row.sector}</td>
                      <td className="p-2 text-center font-mono">{row.orgCount}</td>
                      <td className="p-2 text-center">
                        <span className={cn('font-mono font-bold',
                          row.avgScore >= 75 ? 'text-neon-green' : row.avgScore >= 50 ? 'text-neon-amber' : 'text-neon-red'
                        )}>{row.avgScore}</span>
                      </td>
                      <td className="p-2 text-center font-mono">{row.sslValid}/{row.sslTotal}</td>
                      <td className="p-2 text-center font-mono">{row.uptimeAvg.toFixed(1)}%</td>
                      <td className="p-2 text-center font-mono">{row.threatsCount}</td>
                      <td className="p-2 text-center"><TrendIcon trend={row.trend} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Radar */}
            <div>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(216 28% 16%)" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  {data.map((d, i) => (
                    <Radar key={d.sector} name={d.sector} dataKey={d.sector}
                      stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.1} />
                  ))}
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SectorComparison;
