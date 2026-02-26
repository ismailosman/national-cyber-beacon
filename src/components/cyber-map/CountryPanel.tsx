import React from 'react';
import { X } from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, ResponsiveContainer,
} from 'recharts';
import type { LiveThreat, AttackType } from '@/hooks/useLiveAttacks';
import {
  ATTACK_COLORS, ATTACK_LABELS, COUNTRY_ISO,
  genCountryDefaultPercentages, genCountrySparklines, genCountry30DayData,
} from './shared';

interface CountryPanelProps {
  country: string;
  threats: LiveThreat[];
  onClose: () => void;
}

const CountryPanel: React.FC<CountryPanelProps> = ({ country, threats, onClose }) => {
  const iso = COUNTRY_ISO[country] ?? 'un';
  const trendData = React.useMemo(() => genCountry30DayData(country), [country]);
  const sparklines = React.useMemo(() => genCountrySparklines(country), [country]);
  const defaultPercentages = React.useMemo(() => genCountryDefaultPercentages(country), [country]);
  const countryThreats = threats.filter(t => t.source.country === country);

  const percentages = React.useMemo<Record<AttackType, number>>(() => {
    if (countryThreats.length < 5) return defaultPercentages;
    const counts: Record<string, number> = {};
    for (const t of countryThreats) counts[t.attack_type] = (counts[t.attack_type] || 0) + 1;
    const total = countryThreats.length;
    const result = {} as Record<AttackType, number>;
    for (const type of Object.keys(ATTACK_LABELS) as AttackType[]) {
      result[type] = Math.round(((counts[type] || 0) / total) * 100 * 10) / 10;
    }
    return result;
  }, [countryThreats, defaultPercentages]);

  return (
    <div className="absolute z-30 flex flex-col overflow-y-auto"
      style={{ right: 16, top: 80, width: 'min(320px, calc(100vw - 32px))', maxHeight: 'calc(80vh)',
        background: 'rgba(10,10,20,0.96)', backdropFilter: 'blur(14px)', borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #f97316' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <img src={`https://flagcdn.com/w40/${iso}.png`} alt={`${country} flag`} className="w-6 h-4 object-cover rounded-sm" />
          <div>
            <span className="text-white font-bold text-sm tracking-wide">{country}</span>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">Source of Attacks</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded"><X className="w-4 h-4" /></button>
      </div>
      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-0.5" style={{ color: '#f97316' }}>ATTACK VOLUME</p>
        <p className="text-[10px] text-slate-500 mb-3">Last 30 days</p>
        <div style={{ height: 120, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs><linearGradient id={`countryGrad-${iso}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.55} /><stop offset="100%" stopColor="#f97316" stopOpacity={0} /></linearGradient></defs>
              <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={1.5} fill={`url(#countryGrad-${iso})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px' }} />
      <div className="px-4 pt-3 pb-4">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-0.5" style={{ color: '#f97316' }}>ATTACK TYPES FROM THIS COUNTRY</p>
        <p className="text-[10px] text-slate-500 mb-3">Live from this source</p>
        <div className="flex flex-col gap-3">
          {(Object.keys(ATTACK_LABELS) as AttackType[]).map((type) => (
            <div key={type} className="flex items-center gap-2">
              <span className="text-xs text-slate-300 w-20 flex-shrink-0">{ATTACK_LABELS[type]}</span>
              <div style={{ width: 60, height: 28, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklines[type]} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
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

export default CountryPanel;
