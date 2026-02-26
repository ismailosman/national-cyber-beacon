import React from 'react';
import { X } from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, ResponsiveContainer,
} from 'recharts';
import type { LiveThreat, AttackType } from '@/hooks/useLiveAttacks';
import {
  ATTACK_COLORS, ATTACK_LABELS,
  genCountryDefaultPercentages, genCountrySparklines, TREND_30,
} from './shared';

interface SomaliaPanelProps {
  threats: LiveThreat[];
  onClose: () => void;
}

const SomaliaPanel: React.FC<SomaliaPanelProps> = ({ threats, onClose }) => {
  const somaliDefaults = React.useMemo(() => genCountryDefaultPercentages('Somalia'), []);
  const somaliaSparklines = React.useMemo(() => genCountrySparklines('Somalia'), []);
  const percentages = React.useMemo<Record<AttackType, number>>(() => {
    if (threats.length < 10) return somaliDefaults;
    const counts: Record<string, number> = {};
    for (const t of threats) counts[t.attack_type] = (counts[t.attack_type] || 0) + 1;
    const total = threats.length;
    const result = {} as Record<AttackType, number>;
    for (const type of Object.keys(ATTACK_LABELS) as AttackType[]) {
      result[type] = Math.round(((counts[type] || 0) / total) * 100 * 10) / 10;
    }
    return result;
  }, [threats]);

  return (
    <div className="absolute z-30 flex flex-col overflow-y-auto"
      style={{ right: 16, top: 80, width: 'min(320px, calc(100vw - 32px))', maxHeight: 'calc(80vh)',
        background: 'rgba(10,10,20,0.96)', backdropFilter: 'blur(14px)', borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #f472b6' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <img src="https://flagcdn.com/w40/so.png" alt="Somalia flag" className="w-6 h-4 object-cover rounded-sm" />
          <span className="text-white font-bold text-sm tracking-wide">Somalia</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded"><X className="w-4 h-4" /></button>
      </div>
      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-0.5" style={{ color: '#f472b6' }}>ATTACK TREND</p>
        <p className="text-[10px] text-slate-500 mb-3">Last 30 days</p>
        <div style={{ height: 120, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={TREND_30} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs><linearGradient id="pinkGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f472b6" stopOpacity={0.55} /><stop offset="100%" stopColor="#f472b6" stopOpacity={0} /></linearGradient></defs>
              <Area type="monotone" dataKey="value" stroke="#f472b6" strokeWidth={1.5} fill="url(#pinkGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px' }} />
      <div className="px-4 pt-3 pb-4">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-0.5" style={{ color: '#f472b6' }}>MALWARE TYPE TRENDS</p>
        <p className="text-[10px] text-slate-500 mb-3">% of affected systems</p>
        <div className="flex flex-col gap-3">
          {(Object.keys(ATTACK_LABELS) as AttackType[]).map((type) => (
            <div key={type} className="flex items-center gap-2">
              <span className="text-xs text-slate-300 w-20 flex-shrink-0">{ATTACK_LABELS[type]}</span>
              <div style={{ width: 60, height: 28, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={somaliaSparklines[type]} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                    <Line type="monotone" dataKey="v" stroke={ATTACK_COLORS[type]} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <span className="text-xs font-mono font-bold ml-auto flex-shrink-0" style={{ color: ATTACK_COLORS[type] }}>{percentages[type].toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SomaliaPanel;
