import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import CircularGauge from '@/components/dashboard/CircularGauge';
import { ScanResult } from '@/types/security';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#6b7280',
};

export const getGrade = (score: number) => {
  if (score >= 90) return { grade: 'A', label: 'Excellent', color: 'text-green-400' };
  if (score >= 75) return { grade: 'B', label: 'Good', color: 'text-emerald-400' };
  if (score >= 60) return { grade: 'C', label: 'Fair', color: 'text-yellow-400' };
  if (score >= 40) return { grade: 'D', label: 'Needs Work', color: 'text-orange-400' };
  return { grade: 'F', label: 'Critical', color: 'text-red-400' };
};

export function computeStats(result: ScanResult) {
  const nuclei = result.dast_results?.nuclei?.findings || [];
  const semgrep = result.sast_results?.semgrep?.findings || [];
  const zapAlerts = result.dast_results?.zap?.site?.[0]?.alerts || [];

  const countSev = (sev: string) => {
    let c = 0;
    c += nuclei.filter(f => f.info.severity?.toLowerCase() === sev).length;
    c += semgrep.filter(f => f.extra.severity?.toLowerCase() === sev).length;
    c += zapAlerts.filter((a: any) => {
      const rd = (a.riskdesc || '').toLowerCase();
      return rd.startsWith(sev);
    }).length;
    return c;
  };

  const critical = countSev('critical');
  const high = countSev('high');
  const medium = countSev('medium');
  const low = countSev('low');
  const info = countSev('info') + countSev('informational');
  const total = critical + high + medium + low + info;

  const score = Math.max(0, Math.min(100, 100 - (critical * 25 + high * 10 + medium * 3 + low * 1)));

  return {
    critical, high, medium, low, info, total, score,
    nucleiCount: nuclei.length,
    semgrepCount: semgrep.length,
    zapCount: zapAlerts.length,
    niktoCount: result.dast_results?.nikto ? 1 : 0,
  };
}

export default function ScanReportCharts({ result }: { result: ScanResult }) {
  const stats = computeStats(result);
  const grade = getGrade(stats.score);

  const severityData = [
    { name: 'Critical', value: stats.critical, color: SEVERITY_COLORS.critical },
    { name: 'High', value: stats.high, color: SEVERITY_COLORS.high },
    { name: 'Medium', value: stats.medium, color: SEVERITY_COLORS.medium },
    { name: 'Low', value: stats.low, color: SEVERITY_COLORS.low },
    { name: 'Info', value: stats.info, color: SEVERITY_COLORS.info },
  ].filter(d => d.value > 0);

  const toolData = [
    { name: 'Semgrep (SAST)', count: stats.semgrepCount, fill: '#8b5cf6' },
    { name: 'Nuclei (DAST)', count: stats.nucleiCount, fill: '#f97316' },
    { name: 'ZAP (DAST)', count: stats.zapCount, fill: '#ef4444' },
    { name: 'Nikto (DAST)', count: stats.niktoCount, fill: '#06b6d4' },
  ].filter(d => d.count > 0);

  const summaryCards = [
    { label: 'Total Findings', value: stats.total, border: 'border-border' },
    { label: 'Critical', value: stats.critical, border: 'border-red-500/30', textColor: 'text-red-400' },
    { label: 'High', value: stats.high, border: 'border-orange-500/30', textColor: 'text-orange-400' },
    { label: 'Medium', value: stats.medium, border: 'border-yellow-500/30', textColor: 'text-yellow-400' },
    { label: 'Low', value: stats.low, border: 'border-blue-500/30', textColor: 'text-blue-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {summaryCards.map(card => (
          <div key={card.label} className={`bg-card border ${card.border} rounded-lg p-3 text-center`}>
            <p className={`text-2xl font-bold font-mono ${card.textColor || 'text-foreground'}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Score Gauge */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <CircularGauge score={stats.score} size={180} />
          <div className="mt-3 text-center">
            <span className={`text-lg font-bold font-mono ${grade.color}`}>
              Grade {grade.grade}
            </span>
            <p className="text-xs text-muted-foreground">{grade.label}</p>
          </div>
        </div>

        {/* Severity Donut */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 font-mono">Severity Distribution</h3>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {severityData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(222 47% 11%)', border: '1px solid hsl(215 20% 20%)', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: 'hsl(210 40% 98%)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No findings</div>
          )}
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {severityData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tool Breakdown Bar Chart */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 font-mono">Scanner Breakdown</h3>
          {toolData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={toolData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(215 20% 55%)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(215 20% 55%)' }} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(222 47% 11%)', border: '1px solid hsl(215 20% 20%)', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: 'hsl(210 40% 98%)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {toolData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
          )}
        </div>
      </div>
    </div>
  );
}
