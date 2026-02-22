import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan, ShieldAlert, ShieldCheck, Clock, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DastCoverageData {
  totalOrgs: number;
  scannedOrgs: number;
  avgScore: number;
  avgGrade: string;
  totalCritical: number;
  totalHigh: number;
  totalMedium: number;
  totalLow: number;
  lastScanDate: string | null;
  gradeDistribution: { grade: string; count: number }[];
}

interface DastCoverageSummaryProps {
  data: DastCoverageData;
  activeDastGrade?: string | null;
  onGradeClick?: (grade: string) => void;
}

const getGradeColor = (grade: string) => {
  if (grade === 'A' || grade === 'B') return 'text-neon-green';
  if (grade === 'C') return 'text-neon-amber';
  return 'text-neon-red';
};

const getGradeBg = (grade: string) => {
  if (grade === 'A' || grade === 'B') return 'bg-neon-green/10 border-neon-green/30';
  if (grade === 'C') return 'bg-neon-amber/10 border-neon-amber/30';
  return 'bg-neon-red/10 border-neon-red/30';
};

const DastCoverageSummary: React.FC<DastCoverageSummaryProps> = ({ data, activeDastGrade, onGradeClick }) => {
  const navigate = useNavigate();
  const coveragePercent = data.totalOrgs > 0 ? Math.round((data.scannedOrgs / data.totalOrgs) * 100) : 0;
  const notScannedCount = data.totalOrgs - data.scannedOrgs;

  return (
    <div className="glass-card rounded-xl p-5 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Scan className="w-4 h-4 text-neon-cyan" />
          <h3 className="font-semibold text-sm text-foreground">DAST Scanner Coverage</h3>
          {activeDastGrade && (
            <button
              onClick={() => onGradeClick?.(activeDastGrade)}
              className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-colors"
            >
              Filter: {activeDastGrade === 'not-scanned' ? 'Not Scanned' : `Grade ${activeDastGrade}`}
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button
          onClick={() => navigate('/dast-scanner')}
          className="text-[10px] font-mono text-neon-cyan hover:text-neon-cyan/80 transition-colors"
        >
          Open Scanner →
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Coverage */}
        <div
          className={cn('space-y-1 rounded-lg p-2 -m-2 cursor-pointer transition-colors hover:bg-accent/50', activeDastGrade === 'not-scanned' && 'bg-accent ring-1 ring-neon-cyan/40')}
          onClick={() => notScannedCount > 0 && onGradeClick?.('not-scanned')}
        >
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Coverage</p>
          <p className={cn('text-2xl font-bold font-mono', coveragePercent === 100 ? 'text-neon-green' : coveragePercent >= 50 ? 'text-neon-amber' : 'text-neon-red')}>
            {coveragePercent}%
          </p>
          <p className="text-[10px] text-muted-foreground">{data.scannedOrgs}/{data.totalOrgs} orgs scanned</p>
        </div>

        {/* Average Grade */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Avg Grade</p>
          <p className={cn('text-2xl font-bold font-mono', getGradeColor(data.avgGrade))}>
            {data.avgGrade || '—'}
          </p>
          <p className="text-[10px] text-muted-foreground">Score: {data.avgScore}/100</p>
        </div>

        {/* Findings */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Findings</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {data.totalCritical > 0 && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-neon-red/10 text-neon-red border border-neon-red/20 font-bold">
                {data.totalCritical}C
              </span>
            )}
            {data.totalHigh > 0 && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-neon-red/10 text-neon-red/80 border border-neon-red/20 font-bold">
                {data.totalHigh}H
              </span>
            )}
            {data.totalMedium > 0 && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-neon-amber/10 text-neon-amber border border-neon-amber/20 font-bold">
                {data.totalMedium}M
              </span>
            )}
            {data.totalLow > 0 && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green border border-neon-green/20 font-bold">
                {data.totalLow}L
              </span>
            )}
            {data.totalCritical === 0 && data.totalHigh === 0 && data.totalMedium === 0 && data.totalLow === 0 && (
              <span className="flex items-center gap-1 text-xs font-mono text-neon-green">
                <ShieldCheck className="w-3.5 h-3.5" /> All clean
              </span>
            )}
          </div>
        </div>

        {/* Grade Distribution */}
        <div className="space-y-1 col-span-2">
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Grade Distribution</p>
          <div className="flex items-end gap-1 h-8">
            {data.gradeDistribution.map(({ grade, count }) => (
              <button
                key={grade}
                onClick={() => count > 0 && onGradeClick?.(grade)}
                disabled={count === 0}
                className={cn(
                  'flex flex-col items-center gap-0.5 transition-all',
                  count > 0 ? 'cursor-pointer hover:opacity-80' : 'cursor-default opacity-50',
                  activeDastGrade === grade && 'scale-110'
                )}
              >
                <span className="text-[9px] font-mono text-muted-foreground">{count}</span>
                <div
                  className={cn(
                    'w-6 rounded-sm border transition-all',
                    getGradeBg(grade),
                    activeDastGrade === grade && 'ring-1 ring-neon-cyan ring-offset-1 ring-offset-background'
                  )}
                  style={{ height: `${Math.max(4, count * 8)}px` }}
                />
                <span className={cn('text-[9px] font-mono font-bold', getGradeColor(grade))}>{grade}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Last Scan */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Last Scan</p>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-mono text-foreground">
              {data.lastScanDate ? format(new Date(data.lastScanDate), 'MMM dd, HH:mm') : '—'}
            </p>
          </div>
          {notScannedCount > 0 && (
            <button
              onClick={() => onGradeClick?.('not-scanned')}
              className="text-[9px] text-neon-amber flex items-center gap-0.5 hover:text-neon-amber/80 transition-colors"
            >
              <AlertTriangle className="w-3 h-3" />
              {notScannedCount} not scanned
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DastCoverageSummary;
