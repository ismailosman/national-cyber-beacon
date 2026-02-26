import React, { useState } from 'react';
import { Zap, X } from 'lucide-react';
import { useLiveAttacks, type AttackType } from '@/hooks/useLiveAttacks';
import ThreatMapEngine from '@/components/cyber-map/ThreatMapEngine';
import SomaliaPanel from '@/components/cyber-map/SomaliaPanel';
import CountryPanel from '@/components/cyber-map/CountryPanel';
import { ATTACK_COLORS, ATTACK_LABELS } from '@/components/cyber-map/shared';
import logoSrc from '@/assets/logo.png';

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#facc15', low: '#22d3ee',
};

const CyberMap: React.FC = () => {
  const [liveOn, setLiveOn] = useState(true);
  const [somaliaPanel, setSomaliaPanel] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [mobileFeedOpen, setMobileFeedOpen] = useState(false);

  const { threats, todayCount } = useLiveAttacks(liveOn);

  const severityCounts = {
    critical: threats.filter(t => t.severity === 'critical').length,
    high:     threats.filter(t => t.severity === 'high').length,
    medium:   threats.filter(t => t.severity === 'medium').length,
    low:      threats.filter(t => t.severity === 'low').length,
  };

  const handleCountryClick = (country: string) => {
    setSomaliaPanel(false);
    setSelectedCountry(country);
  };
  const handleSomaliaClick = () => {
    setSelectedCountry(null);
    setSomaliaPanel(true);
  };

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* Map container */}
        <div className="relative flex-1 min-w-0">
          {/* Mobile dot-grid */}
          <div className="absolute inset-0 z-[1] lg:hidden pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.18) 1px, transparent 1px)', backgroundSize: '14px 14px' }} />

          {/* Header overlay */}
          <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center pt-4 sm:pt-6 pb-3 sm:pb-4 pointer-events-none"
            style={{ background: window.innerWidth < 768 ? 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)' : 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
              <img src={logoSrc} alt="Logo" className="w-6 h-6 sm:w-8 sm:h-8 object-contain opacity-90 hidden sm:block" />
              <div className="text-center">
                <h1 className="text-white font-bold tracking-[0.15em] sm:tracking-[0.25em] uppercase text-xs sm:text-base font-mono"
                  style={{ textShadow: '0 0 20px rgba(34,211,238,0.6)' }}>LIVE CYBER THREAT MAP</h1>
                <p className="hidden sm:block text-[10px] text-slate-400 tracking-widest uppercase">Somalia National Cyber Defense Observatory</p>
              </div>
            </div>
            <div className="text-center" aria-live="polite">
              <p className="text-xl sm:text-3xl font-mono font-bold" style={{ color: '#f472b6', textShadow: '0 0 20px rgba(244,114,182,0.7)' }}>
                {todayCount.toLocaleString()}
              </p>
              <p className="text-[9px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.3em] text-slate-400 uppercase mt-0.5">ATTACKS ON THIS DAY</p>
            </div>
          </div>

          {/* Live toggle */}
          <div className="absolute top-4 right-4 z-20 pointer-events-auto hidden sm:block">
            <button onClick={() => setLiveOn(v => !v)} aria-pressed={liveOn}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
              style={{ background: liveOn ? 'rgba(34,211,238,0.15)' : 'rgba(0,0,0,0.7)', border: `1px solid ${liveOn ? '#22d3ee' : 'rgba(255,255,255,0.15)'}`, color: liveOn ? '#22d3ee' : '#94a3b8' }}>
              <Zap className={`w-3 h-3 ${liveOn ? 'text-[#22d3ee]' : 'text-slate-500'}`} />
              Live
              <span className={`w-1.5 h-1.5 rounded-full ${liveOn ? 'bg-[#22d3ee] animate-pulse' : 'bg-slate-600'}`} />
            </button>
          </div>

          {/* Click hint */}
          {!somaliaPanel && !selectedCountry && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
              style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(244,114,182,0.3)', borderRadius: 6, padding: '4px 12px' }}>
              <p className="text-[10px] font-mono text-pink-300 tracking-widest uppercase">🌐 Click Somalia or any source for stats</p>
            </div>
          )}

          {/* Map engine */}
          <ThreatMapEngine
            threats={threats}
            todayCount={todayCount}
            liveOn={liveOn}
            onCountryClick={handleCountryClick}
            onSomaliaClick={handleSomaliaClick}
            className="absolute inset-0"
          />

          {/* Panels */}
          {somaliaPanel && !selectedCountry && <SomaliaPanel threats={threats} onClose={() => setSomaliaPanel(false)} />}
          {selectedCountry && <CountryPanel country={selectedCountry} threats={threats} onClose={() => setSelectedCountry(null)} />}

          {/* Loading handled by ThreatMapEngine internally */}

          {/* Mobile Feed Toggle */}
          <button onClick={() => setMobileFeedOpen(true)}
            className="lg:hidden absolute bottom-4 right-4 z-20 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-bold pointer-events-auto"
            style={{ background: 'rgba(10,10,20,0.9)', border: '1px solid rgba(34,211,238,0.5)', color: '#22d3ee', boxShadow: '0 0 16px rgba(34,211,238,0.2)' }}>
            <Zap className="w-4 h-4" /> Feed
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.35)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}>{threats.length}</span>
          </button>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:flex w-64 xl:w-72 flex-shrink-0 flex-col overflow-hidden"
          style={{ background: '#07070f', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between px-3 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-xs font-bold font-mono tracking-widest uppercase text-white">ATTACKS</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 font-mono">Current rate</span>
              <span className="text-[10px] font-mono font-bold" style={{ color: '#22d3ee' }}>— {threats.length} —</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {threats.slice(0, 50).map((t) => {
              const sevColor = SEV_COLORS[t.severity];
              const ts = new Date(t.timestamp);
              const timeStr = `${ts.getHours().toString().padStart(2,'0')}:${ts.getMinutes().toString().padStart(2,'0')}:${ts.getSeconds().toString().padStart(2,'0')}`;
              return (
                <div key={t.id} className="flex items-start gap-2 px-3 py-2 cursor-default" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ border: `2px solid ${sevColor}`, background: 'transparent' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white font-mono truncate">{t.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{timeStr} {t.source.state}, {t.source.country} → {t.target.state}, {t.target.country}</p>
                  </div>
                </div>
              );
            })}
            {threats.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <span className="text-slate-600 text-xs font-mono">Awaiting threats...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileFeedOpen && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
          <div className="relative flex flex-col rounded-t-2xl overflow-hidden"
            style={{ height: '45vh', background: 'rgba(5, 7, 15, 0.72)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderBottom: 'none' }}>
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)' }}>
              <span className="text-sm font-bold font-mono tracking-widest uppercase text-white">ATTACKS</span>
              <button onClick={() => setMobileFeedOpen(false)} className="text-slate-400 hover:text-white p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2 px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {([
                { label: 'Crit', key: 'critical' as const, color: '#ef4444' },
                { label: 'High', key: 'high' as const, color: '#f97316' },
                { label: 'Med', key: 'medium' as const, color: '#facc15' },
                { label: 'Low', key: 'low' as const, color: '#22d3ee' },
              ]).map(({ label, key, color }) => (
                <div key={key} className="flex-1 flex flex-col items-center py-1.5 rounded-lg"
                  style={{ background: `${color}0d`, border: `1px solid ${color}33` }}>
                  <span className="text-sm font-mono font-bold" style={{ color }}>{severityCounts[key]}</span>
                  <span className="text-[9px] uppercase font-mono" style={{ color: `${color}99` }}>{label}</span>
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {threats.slice(0, 30).map((t) => {
                const sevColor = SEV_COLORS[t.severity];
                const ts = new Date(t.timestamp);
                const timeStr = `${ts.getHours().toString().padStart(2,'0')}:${ts.getMinutes().toString().padStart(2,'0')}:${ts.getSeconds().toString().padStart(2,'0')}`;
                return (
                  <div key={t.id} className="flex items-start gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ border: `2px solid ${sevColor}`, background: 'transparent' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-mono truncate">{t.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{timeStr} {t.source.state}, {t.source.country} → {t.target.state}, {t.target.country}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="hidden lg:flex flex-shrink-0 px-4 py-2 items-center gap-2"
        style={{ background: '#050508', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          {([
            { label: 'Critical', key: 'critical' as const },
            { label: 'High', key: 'high' as const },
            { label: 'Medium', key: 'medium' as const },
            { label: 'Low', key: 'low' as const },
          ]).map(({ label, key }) => (
            <div key={key} className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg"
              style={{ background: `${SEV_COLORS[key]}0d`, border: `1px solid ${SEV_COLORS[key]}33` }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SEV_COLORS[key], boxShadow: `0 0 5px ${SEV_COLORS[key]}` }} />
              <span className="text-base sm:text-lg font-mono font-bold tabular-nums" style={{ color: SEV_COLORS[key] }}>{severityCounts[key]}</span>
              <span className="text-[10px] font-mono uppercase tracking-wide" style={{ color: `${SEV_COLORS[key]}99` }}>{label}</span>
            </div>
          ))}

          <div className="hidden lg:block w-px h-6 mx-2 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="hidden lg:flex flex-wrap gap-x-4 gap-y-1 flex-1">
            {(Object.entries(ATTACK_LABELS) as [AttackType, string][]).map(([type, label]) => (
              <div key={type} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: ATTACK_COLORS[type] }} />
                <span className="text-[10px] font-mono text-slate-400">{label}</span>
              </div>
            ))}
          </div>
          {liveOn && (
            <div className="hidden lg:flex items-center gap-1.5 ml-auto flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Live</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CyberMap;
