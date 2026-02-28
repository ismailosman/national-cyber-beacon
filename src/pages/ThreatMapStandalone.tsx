import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Globe, Pause, Play, RefreshCw, ChevronUp, ChevronDown, Zap } from 'lucide-react';
import { useLiveThreatAPI, maskIP } from '@/hooks/useLiveThreatAPI';
import ThreatMapEngine from '@/components/cyber-map/ThreatMapEngine';
import SomaliaPanel from '@/components/cyber-map/SomaliaPanel';
import CountryPanel from '@/components/cyber-map/CountryPanel';
import { COUNTRY_ISO, ATTACK_COLORS, ATTACK_LABELS } from '@/components/cyber-map/shared';
import type { AttackType } from '@/hooks/useLiveAttacks';
import logoSrc from '@/assets/logo.png';

/* ── Relative time helper ─────────────────────────────────────────── */
function timeAgo(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/* ── Source status dot ────────────────────────────────────────────── */
const SourceDot: React.FC<{ name: string; active: boolean }> = ({ name, active }) => (
  <div className="flex items-center gap-1.5 py-0.5">
    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: active ? '#22c55e' : '#475569' }} />
    <span className="text-[10px] font-mono text-slate-400">{name}</span>
  </div>
);

const ThreatMapStandalone: React.FC = () => {
  const {
    events, stats, topCountries, topAttackers, topTargets, topTypes, sourcesActive,
    refreshedAt, isPaused, togglePause, forceRefresh, loading, error,
  } = useLiveThreatAPI();

  const [somaliaPanel, setSomaliaPanel] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [mobileStatsOpen, setMobileStatsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'map' | 'kaspersky'>('map');

  /* ── Arc queue system ─────────────────────────────────────────────── */
  const arcQueueRef = useRef<typeof events>([]);
  const [displayThreats, setDisplayThreats] = useState<typeof events>([]);
  const prevEventsRef = useRef<Set<string>>(new Set());
  const recentArcTimestamps = useRef<number[]>([]);

  // Push new API events into the queue
  useEffect(() => {
    const newEvents = events.filter(e => !prevEventsRef.current.has(e.id));
    if (newEvents.length > 0) {
      arcQueueRef.current = [...arcQueueRef.current, ...newEvents].slice(-100);
    }
    prevEventsRef.current = new Set(events.map(e => e.id));
  }, [events]);

  // Ticker: pop from queue or recycle — every 800ms
  useEffect(() => {
    if (isPaused) return;
    const ticker = setInterval(() => {
      const queue = arcQueueRef.current;
      if (queue.length > 0) {
        const [next, ...rest] = queue;
        arcQueueRef.current = rest;
        recentArcTimestamps.current.push(Date.now());
        setDisplayThreats(prev => [next, ...prev].slice(0, 30));
      } else if (events.length > 0) {
        // Recycle a random existing event with a new ID
        const src = events[Math.floor(Math.random() * Math.min(events.length, 20))];
        if (src) {
          const recycled = { ...src, id: `${src.id}_r_${Date.now()}` };
          recentArcTimestamps.current.push(Date.now());
          setDisplayThreats(prev => [recycled, ...prev].slice(0, 30));
        }
      }
    }, 800);
    return () => clearInterval(ticker);
  }, [isPaused, events]);

  /* ── Animated counter ─────────────────────────────────────────────── */
  const targetCount = stats?.total ?? events.length;
  const [displayCount, setDisplayCount] = useState(0);

  useEffect(() => {
    if (targetCount <= displayCount) {
      if (targetCount < displayCount) setDisplayCount(targetCount);
      return;
    }
    const step = Math.max(1, Math.ceil((targetCount - displayCount) / 10));
    const timer = setInterval(() => {
      setDisplayCount(prev => {
        const next = prev + step;
        if (next >= targetCount) { clearInterval(timer); return targetCount; }
        return next;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [targetCount]);

  /* ── Attack rate (arcs in last 60s) ───────────────────────────────── */
  const [attackRate, setAttackRate] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      const cutoff = Date.now() - 60000;
      recentArcTimestamps.current = recentArcTimestamps.current.filter(t => t > cutoff);
      setAttackRate(recentArcTimestamps.current.length);
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  // Derive todayCount and rate (keep rate as fallback)
  const todayCount = displayCount;
  const rate = attackRate;

  // Top 5 attack types bar chart data
  const typeBarData = useMemo(() => {
    if (topTypes.length > 0) return topTypes.slice(0, 5);
    if (!stats?.by_type) return [];
    return Object.entries(stats.by_type)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count, label: type, color: ATTACK_COLORS[type as AttackType] ?? '#64748b' }));
  }, [topTypes, stats]);

  const maxTypeCount = Math.max(1, ...typeBarData.map(t => t.count));

  // Top attackers and targets for right sidebar
  const displayAttackers = useMemo(() => (topAttackers.length > 0 ? topAttackers : topCountries).slice(0, 10), [topAttackers, topCountries]);
  const displayTargets = useMemo(() => topTargets.slice(0, 10), [topTargets]);
  const maxAttackerCount = Math.max(1, ...displayAttackers.map(c => c.count));
  const maxTargetCount = Math.max(1, ...displayTargets.map(c => c.count));

  // Derive CCs for map highlighting
  const topAttackerCCs = useMemo(() => displayAttackers.slice(0, 3).map(c => c.cc?.toUpperCase()).filter(Boolean), [displayAttackers]);
  const topTargetCCs = useMemo(() => displayTargets.slice(0, 3).map(c => c.cc?.toUpperCase()).filter(Boolean), [displayTargets]);

  const handleCountryClick = (country: string) => {
    setSomaliaPanel(false);
    setSelectedCountry(country);
  };
  const handleSomaliaClick = () => {
    setSelectedCountry(null);
    setSomaliaPanel(true);
  };

  const hasData = events.length > 0;

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: '#0a0a14' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ background: '#07070f', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <img src={logoSrc} alt="Logo" className="w-7 h-7 object-contain" />
          <div>
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <p className="text-white font-bold text-xs tracking-[0.12em] uppercase font-mono">Global Threat Intelligence</p>
            </div>
            <p className="text-[9px] text-slate-500 tracking-widest uppercase">LIVE CYBER THREAT MAP</p>
          </div>
        </div>
        <div className="flex items-center gap-1 mx-4">
          <button
            onClick={() => setActiveTab('map')}
            className={`px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest uppercase rounded-t transition-colors ${
              activeTab === 'map'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >Live Map</button>
          <button
            onClick={() => setActiveTab('kaspersky')}
            className={`px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest uppercase rounded-t transition-colors ${
              activeTab === 'kaspersky'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >Kaspersky Feed</button>
        </div>
        <div className="flex items-center gap-3">
          {/* LIVE indicator */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-[10px] font-mono font-bold text-red-400 tracking-widest">LIVE</span>
          </div>

          <div className="hidden sm:block text-right">
            <p className="text-lg font-mono font-bold" style={{ color: '#f472b6' }}>{todayCount.toLocaleString()}</p>
            <p className="text-[8px] tracking-[0.2em] text-slate-500 uppercase">TOTAL ATTACKS</p>
          </div>

          {refreshedAt && (
            <span className="hidden md:block text-[9px] text-slate-600 font-mono">
              {new Date(refreshedAt).toLocaleTimeString()}
            </span>
          )}

          <button onClick={togglePause}
            className="p-1.5 rounded hover:bg-white/10 transition-colors" title={isPaused ? 'Resume' : 'Pause'}>
            {isPaused ? <Play className="w-3.5 h-3.5 text-cyan-400" /> : <Pause className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          <button onClick={forceRefresh}
            className="p-1.5 rounded hover:bg-white/10 transition-colors" title="Refresh Now">
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {activeTab === 'kaspersky' ? (
        <div className="flex-1 flex flex-col overflow-y-auto" style={{ background: '#0a0a14' }}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-white font-mono mb-1">🛡 Kaspersky Global Threat Intelligence Feed</h2>
            <p className="text-sm text-slate-400 font-mono mb-4">Live data from Kaspersky Security Network (KSN)</p>
          </div>
          <div className="flex-1 px-6 pb-6">
            <iframe
              src="https://cybermap.kaspersky.com/en/widget/dynamic/dark"
              width="100%"
              style={{ border: 'none', borderRadius: 8, height: 'calc(100vh - 160px)' }}
              title="Kaspersky Cyberthreat Live Map"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
      <>
      {/* ── Body: Three columns ───────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
        <div className="hidden lg:flex w-[220px] flex-shrink-0 flex-col overflow-y-auto"
          style={{ background: '#07070f', borderRight: '1px solid rgba(255,255,255,0.08)', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

          {/* Attack counter + rate */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 font-mono">ATTACKS</p>
            <p className="text-2xl font-mono font-bold mt-1" style={{ color: '#22d3ee' }}>{displayThreats.length}</p>
            <p className="text-[9px] text-slate-500 font-mono mt-1">⚡ {rate} arcs/min</p>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Attack types bar chart */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-2 font-mono">ATTACKS BY TYPE</p>
            {typeBarData.map(t => (
              <div key={t.type} className="flex items-center gap-2 py-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                <span className="text-[10px] text-slate-400 font-mono w-16 truncate">{t.label}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(t.count / maxTypeCount) * 100}%`, background: t.color }} />
                </div>
                <span className="text-[9px] text-slate-500 font-mono w-8 text-right">{t.count}</span>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Data sources */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-1 font-mono">DATA SOURCES</p>
            <SourceDot name="AbuseIPDB" active={sourcesActive.abuseipdb} />
            <SourceDot name="URLhaus" active={sourcesActive.urlhaus} />
            <SourceDot name="AlienVault OTX" active={sourcesActive.alienvault} />
            <SourceDot name="Firewall Log" active={sourcesActive.firewall} />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Live feed */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            <div className="p-3 pb-1">
              <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 font-mono">LIVE FEED</p>
            </div>
            {events.slice(0, 30).map(a => (
              <div key={a.id} className="flex items-start gap-2 px-3 py-2 feed-item" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: a.color || ATTACK_COLORS[a.attack_type] }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-white font-mono truncate">{a.label || ATTACK_LABELS[a.attack_type]}</p>
                  <p className="text-[9px] text-slate-500 font-mono truncate">
                    {timeAgo(a.timestamp)} · {a.source.country} → {a.target.country}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CENTER MAP ─────────────────────────────────────────────── */}
        <div className="relative flex-1 min-w-0">
          <ThreatMapEngine
            threats={displayThreats}
            todayCount={todayCount}
            liveOn={!isPaused}
            onCountryClick={handleCountryClick}
            onSomaliaClick={handleSomaliaClick}
            topAttackerCCs={topAttackerCCs}
            topTargetCCs={topTargetCCs}
          />

          {/* Fallback overlay */}
          {!hasData && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="text-center px-6 py-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Zap className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300 font-mono">Collecting threat intelligence...</p>
                <p className="text-[10px] text-slate-500 mt-1">Waiting for live feed data</p>
              </div>
            </div>
          )}

          {/* Panel overlays */}
          {somaliaPanel && !selectedCountry && (
            <SomaliaPanel threats={events} onClose={() => setSomaliaPanel(false)} />
          )}
          {selectedCountry && (
            <CountryPanel country={selectedCountry} threats={events} onClose={() => setSelectedCountry(null)} />
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
          style={{ background: '#07070f', borderLeft: '1px solid rgba(255,255,255,0.08)', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

          {/* Top Attacking Countries */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-0.5 font-mono">TOP ATTACKING COUNTRIES</p>
            <p className="text-[9px] text-slate-600 mb-2">Highest rate of attacks in the last poll.</p>
            {displayAttackers.map((c) => {
              const iso = COUNTRY_ISO[c.name] ?? c.cc?.toLowerCase() ?? 'un';
              return (
                <div key={c.cc} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-white/5 rounded px-1 -mx-1"
                  onClick={() => handleCountryClick(c.name)}>
                  <img src={`https://flagcdn.com/w20/${iso}.png`} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
                  <span className="text-xs text-slate-300 font-mono flex-1 truncate">{c.name}</span>
                  <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(c.count / maxAttackerCount) * 100}%`, background: '#ef4444' }} />
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>{c.count}</span>
                </div>
              );
            })}
            {displayAttackers.length === 0 && (
              <p className="text-[10px] text-slate-600 font-mono py-2">Waiting for data…</p>
            )}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Top Targeted Countries */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-0.5 font-mono">TOP TARGETED COUNTRIES</p>
            <p className="text-[9px] text-slate-600 mb-2">Most attacked destinations.</p>
            {displayTargets.map((c) => {
              const iso = COUNTRY_ISO[c.name] ?? c.cc?.toLowerCase() ?? 'un';
              return (
                <div key={c.cc} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-white/5 rounded px-1 -mx-1"
                  onClick={() => handleCountryClick(c.name)}>
                  <img src={`https://flagcdn.com/w20/${iso}.png`} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
                  <span className="text-xs text-slate-300 font-mono flex-1 truncate">{c.name}</span>
                  <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(c.count / maxTargetCount) * 100}%`, background: '#3b82f6' }} />
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>{c.count}</span>
                </div>
              );
            })}
            {displayTargets.length === 0 && (
              <p className="text-[10px] text-slate-600 font-mono py-2">Waiting for data…</p>
            )}
          </div>

          {/* Top Attack Types */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-0.5 font-mono">TOP ATTACK TYPES</p>
            {topTypes.slice(0, 5).map(t => (
              <div key={t.type} className="flex items-center gap-2 py-1.5 px-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                <span className="text-xs text-slate-300 font-mono flex-1">{t.label}</span>
                <span className="text-[9px] font-mono text-slate-500">{t.count}</span>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Live feed with masked IPs */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-2 font-mono">RECENT EVENTS</p>
            {events.slice(0, 10).map(e => (
              <div key={e.id} className="py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: e.color || ATTACK_COLORS[e.attack_type] }} />
                  <span className="text-[10px] text-slate-500 font-mono">{timeAgo(e.timestamp)}</span>
                </div>
                <p className="text-[11px] text-slate-300 font-mono truncate mt-0.5">
                  {e.label || ATTACK_LABELS[e.attack_type]} from {e.source.country} → {e.target.country}
                </p>
                {e.source_ip && (
                  <p className="text-[9px] text-slate-600 font-mono">{maskIP(e.source_ip)}</p>
                )}
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-[10px] text-slate-600 font-mono py-2">Waiting for events…</p>
            )}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Live Statistics */}
          {/* Active Threats */}
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-2 font-mono">LIVE STATISTICS</p>
            {[
              { label: 'Active Arcs', value: displayThreats.length, color: '#ff0066' },
              { label: 'Arcs/min', value: rate, color: '#f97316' },
              { label: 'Total', value: todayCount.toLocaleString(), color: '#a855f7' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-1.5">
                <span className="text-[10px] text-slate-500 font-mono">{s.label}</span>
                <span className="text-sm font-mono font-bold" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile bottom panel ───────────────────────────────────────── */}
      <div className="lg:hidden flex-shrink-0 px-3 py-2"
        style={{ background: '#07070f', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => setMobileStatsOpen(v => !v)}
          className="w-full flex items-center justify-between py-1">
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 font-mono">
            LIVE STATS · {todayCount.toLocaleString()} attacks
          </span>
          {mobileStatsOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
        </button>
        {mobileStatsOpen && (
          <div className="pt-1 pb-1 max-h-48 overflow-y-auto">
            {displayAttackers.slice(0, 5).map(c => {
              const iso = COUNTRY_ISO[c.name] ?? c.cc?.toLowerCase() ?? 'un';
              return (
                <div key={c.cc} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-white/5 rounded px-1"
                  onClick={() => handleCountryClick(c.name)}>
                  <img src={`https://flagcdn.com/w20/${iso}.png`} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
                  <span className="text-xs text-slate-300 font-mono">{c.name}</span>
                  <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>{c.count}</span>
                </div>
              );
            })}
            {events.slice(0, 3).map(e => (
              <div key={e.id} className="flex items-center gap-2 py-1 px-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: e.color || ATTACK_COLORS[e.attack_type] }} />
                <span className="text-[10px] text-slate-400 font-mono truncate flex-1">
                  {e.label || ATTACK_LABELS[e.attack_type]} · {e.source.country} → {e.target.country}
                </span>
                <span className="text-[9px] text-slate-600 font-mono">{timeAgo(e.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      <style>{`
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: #0d0d18; }
        ::-webkit-scrollbar-thumb { background: #1c1c30; border-radius: 2px; }
        @keyframes feedSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .feed-item { animation: feedSlideIn 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default ThreatMapStandalone;
