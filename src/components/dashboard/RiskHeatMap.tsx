import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type CellStatus = 'green' | 'yellow' | 'red' | 'unknown';

interface OrgHeatRow {
  id: string;
  name: string;
  ssl: CellStatus;
  uptime: CellStatus;
  headers: CellStatus;
  ports: CellStatus;
  email: CellStatus;
  dns: CellStatus;
  waf: CellStatus;
  dast: CellStatus;
  details: Record<string, string>;
}

interface RiskHeatMapProps {
  data: OrgHeatRow[];
}

const DIMENSIONS = ['ssl', 'uptime', 'headers', 'ports', 'email', 'dns', 'waf', 'dast'] as const;
const DIM_LABELS: Record<string, string> = {
  ssl: 'SSL', uptime: 'Uptime', headers: 'Headers', ports: 'Ports',
  email: 'Email', dns: 'DNS', waf: 'WAF', dast: 'DAST',
};

const cellColors: Record<CellStatus, string> = {
  green: 'bg-neon-green/30 border-neon-green/40',
  yellow: 'bg-neon-amber/30 border-neon-amber/40',
  red: 'bg-neon-red/30 border-neon-red/40',
  unknown: 'bg-muted/30 border-border',
};

const cellEmoji: Record<CellStatus, string> = {
  green: '🟢', yellow: '🟡', red: '🔴', unknown: '—',
};

const RiskHeatMap: React.FC<RiskHeatMapProps> = ({ data }) => {
  if (data.length === 0) return null;

  return (
    <div className="glass-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-sm text-foreground">Risk Heat Map</h2>
      </div>
      <div className="overflow-x-auto">
        <TooltipProvider delayDuration={200}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-muted-foreground font-mono uppercase min-w-[140px]">Organization</th>
                {DIMENSIONS.map(d => (
                  <th key={d} className="text-center p-2 text-muted-foreground font-mono uppercase">{DIM_LABELS[d]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="p-2 font-medium text-foreground truncate max-w-[160px]">{row.name}</td>
                  {DIMENSIONS.map(dim => {
                    const status = row[dim];
                    const detail = row.details[dim];
                    return (
                      <td key={dim} className="p-1 text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn('inline-block w-7 h-7 rounded border text-center leading-7 cursor-default text-xs',
                              cellColors[status]
                            )}>
                              {cellEmoji[status]}
                            </span>
                          </TooltipTrigger>
                          {detail && (
                            <TooltipContent className="glass-card border-neon-cyan/30 max-w-xs">
                              <p className="text-xs">{row.name} — {DIM_LABELS[dim]}: {detail}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default RiskHeatMap;
