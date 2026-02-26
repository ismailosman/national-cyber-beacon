import React, { useState, useMemo, useRef } from 'react';
import { Zap, Pause, Play } from 'lucide-react';
import { useLiveAttacks, type AttackType } from '@/hooks/useLiveAttacks';
import ThreatMapEngine from '@/components/cyber-map/ThreatMapEngine';
import SomaliaPanel from '@/components/cyber-map/SomaliaPanel';
import CountryPanel from '@/components/cyber-map/CountryPanel';
import { COUNTRY_ISO, ATTACK_COLORS, ATTACK_LABELS, seededRand } from '@/components/cyber-map/shared';
import logoSrc from '@/assets/logo.png';

const INDUSTRIES = [
  { name: 'Education', icon: '🎓' },
  { name: 'Telecommunications', icon: '📡' },
  { name: 'Government', icon: '🏛' },
  { name: 'Finance', icon: '💳' },
  { name: 'Technology', icon: '💻' },
  { name: 'Manufacturing', icon: '🏭' },
  { name: 'Telecom', icon: '📡' },
  { name: 'Health', icon: '🏥' },
];

const MALWARE_TYPES = [
  { name: 'Mobile', icon: '📱', color: '#ef4444' },
  { name: 'Adware', icon: '⚙️', color: '#f97316' },
  { name: 'Phishing', icon: '🎣', color: '#a855f7' },
];

function rnd(a: number, b: number) { return Math.random() * (b - a) + a; }

const ThreatMapStandalone: React.FC = () => {
  const [liveOn, setLiveOn] = useState(true);
  const [somaliaPanel, setSomaliaPanel] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const { threats, todayCount } = useLiveAttacks(liveOn);

  const chartBars = useRef(Array.from({ length: 30 }, () => Math.floor(rnd(3e6, 18e6))));
  const maxBar = Math.max(...chartBars.current, 1);

  // Compute top countries from threats
  const topCountries = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of threats) counts[t.target.country] = (counts[t.target.country] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [threats]);

  // Compute top industries
  const topIndustries = useMemo(() => {
    // Assign industries based on target country seeded
    const industryNames = ['Government', 'Finance', 'Technology', 'Telecommunications', 'Education', 'Health'];
    const counts: Record<string, number> = {};
    for (const t of threats) {
      let seed = 0;
      for (const c of t.target.country) seed = (seed * 31 + c.charCodeAt(0)) | 0;
      const idx = Math.abs(seed) % industryNames.length;
      const ind = industryNames[idx];
      counts[ind] = (counts[ind] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [threats]);

  const defaultCountries = [['Ethiopia'], ['Indonesia'], ['Somalia'], ['Georgia'], ['Ukraine']];
  const defaultIndustries = [['Education'], ['Telecommunications'], ['Government']];

  const rate = Math.max(1, Math.floor(threats.length / 3));

  const handleCountryClick = (country: string) => {
    setSomaliaPanel(false);
    setSelectedCountry(country);
  };
  const handleSomaliaClick = () => {
    setSelectedCountry(null);
    setSomaliaPanel(true);
  };

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: '#0a0a14' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ background: '#07070f', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <img src={logoSrc} alt="Logo" className="w-7 h-7 object-contain" />
          <div>
            <p className="text-white font-bold text-xs tracking-[0.12em] uppercase font-mono">CYBERSOMALIA</p>
            <p className="text-[9px] text-slate-500 tracking-widest uppercase">NATIONAL THREAT INTELLIGENCE</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1">
            <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">LIVE CYBER THREAT MAP</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-mono font-bold" style={{ color: '#f472b6' }}>{todayCount.toLocaleString()}</p>
            <p className="text-[8px] tracking-[0.2em] text-slate-500 uppercase">ATTACKS ON THIS DAY</p>
          </div>
          <button
            onClick={() => setLiveOn(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
            style={{
              background: liveOn ? 'rgba(34,211,238,0.12)' : 'rgba(0,0,0,0.5)',
              border: `1px solid ${liveOn ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.15)'}`,
              color: liveOn ? '#22d3ee' : '#94a3b8',
            }}
          >
            {liveOn ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {liveOn ? 'PAUSE' : 'RESUME'}
          </button>
        </div>
      </div>

      {/* ── Body: Three columns ───────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
        <div className="hidden lg:flex w-[220px] flex-shrink-0 flex-col overflow-y-auto"
          style={{ background: '#07070f', borderRight: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Daily attacks chart */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-2 font-mono">RECENT DAILY ATTACKS</p>
            <div className="flex items-end gap-[2px] h-[60px]">
              {chartBars.current.map((v, i) => {
                const h = Math.max(2, (v / maxBar) * 54);
                return (
                  <div key={i} className="flex-1 rounded-sm" style={{ height: h, background: 'rgba(34,211,238,0.5)' }} />
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              {['0', '5M', '10M', '15M', '20M'].map(l => (
                <span key={l} className="text-[8px] text-slate-600 font-mono">{l}</span>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Attack rate */}
          <div className="p-3 text-center">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 font-mono">ATTACKS</p>
            <p className="text-[9px] text-slate-500 mb-1">⏱ Current rate</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-slate-600 text-xs">—</span>
              <span className="text-xl font-mono font-bold" style={{ color: '#22d3ee' }}>{rate}</span>
              <span className="text-slate-600 text-xs">+</span>
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Live feed */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {threats.slice(0, 40).map(a => {
              const ts = new Date(a.timestamp);
              const timeStr = `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}:${ts.getSeconds().toString().padStart(2, '0')}`;
              return (
                <div key={a.id} className="flex items-start gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: ATTACK_COLORS[a.attack_type] }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-white font-mono truncate">{ATTACK_LABELS[a.attack_type]}</p>
                    <p className="text-[9px] text-slate-500 font-mono truncate">
                      {timeStr} {a.source.country} → {a.target.country}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CENTER MAP ─────────────────────────────────────────────── */}
        <div className="relative flex-1 min-w-0">
          <ThreatMapEngine
            threats={threats}
            todayCount={todayCount}
            liveOn={liveOn}
            onCountryClick={handleCountryClick}
            onSomaliaClick={handleSomaliaClick}
          />

          {/* Panel overlays on the map */}
          {somaliaPanel && !selectedCountry && (
            <SomaliaPanel threats={threats} onClose={() => setSomaliaPanel(false)} />
          )}
          {selectedCountry && (
            <CountryPanel country={selectedCountry} threats={threats} onClose={() => setSelectedCountry(null)} />
          )}

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {(Object.entries(ATTACK_LABELS) as [AttackType, string][]).map(([type, label]) => (
              <div key={type} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: ATTACK_COLORS[type] }} />
                <span className="text-[9px] font-mono text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────────── */}
        <div className="hidden lg:flex w-[240px] flex-shrink-0 flex-col overflow-y-auto"
          style={{ background: '#07070f', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Top Targeted Countries */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-0.5 font-mono">TOP TARGETED COUNTRIES</p>
            <p className="text-[9px] text-slate-600 mb-2">Highest rate of attacks per organization in the last day.</p>
            {(topCountries.length > 0 ? topCountries : defaultCountries).map(([name, _count]) => {
              const iso = COUNTRY_ISO[name] ?? 'un';
              return (
                <div key={name} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-white/5 rounded px-1 -mx-1"
                  onClick={() => handleCountryClick(name)}>
                  <img src={`https://flagcdn.com/w20/${iso}.png`} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
                  <span className="text-xs text-slate-300 font-mono">{name}</span>
                </div>
              );
            })}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Top Targeted Industries */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-0.5 font-mono">TOP TARGETED INDUSTRIES</p>
            <p className="text-[9px] text-slate-600 mb-2">Highest rate of attacks per organization in the last day.</p>
            {(topIndustries.length > 0 ? topIndustries : defaultIndustries).map(([name, _count]) => {
              const ind = INDUSTRIES.find(i => i.name === name) || { name, icon: '🔒' };
              return (
                <div key={name} className="flex items-center gap-2 py-1.5 px-1">
                  <span>{ind.icon}</span>
                  <span className="text-xs text-slate-300 font-mono">{name}</span>
                </div>
              );
            })}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Top Malware Types */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-0.5 font-mono">TOP MALWARE TYPES</p>
            <p className="text-[9px] text-slate-600 mb-2">Malware types with the highest global impact in the last day.</p>
            {MALWARE_TYPES.map(m => (
              <div key={m.name} className="flex items-center gap-2 py-1.5 px-1">
                <span>{m.icon}</span>
                <span className="text-xs text-slate-300 font-mono">{m.name}</span>
                <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Live Statistics */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-2 font-mono">LIVE STATISTICS</p>
            {[
              { label: 'Active Threats', value: threats.length, color: '#ff0066' },
              { label: 'Attack Rate/min', value: `${rate * 12}`, color: '#f97316' },
              { label: 'Total Today', value: todayCount.toLocaleString(), color: '#a855f7' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-1.5">
                <span className="text-[10px] text-slate-500 font-mono">{s.label}</span>
                <span className="text-sm font-mono font-bold" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollbar styling */}
      <style>{`
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: #0d0d18; }
        ::-webkit-scrollbar-thumb { background: #1c1c30; border-radius: 2px; }
      `}</style>
    </div>
  );
};

export default ThreatMapStandalone;
