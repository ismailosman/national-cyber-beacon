import React, { useState, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import type { RansomwareVictim } from '@/hooks/useLiveThreatAPI';

const PROXY_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-proxy`;

const RANSOMWARE_COUNTRIES = [
  { code: 'SO', name: 'Somalia' }, { code: 'KE', name: 'Kenya' },
  { code: 'ET', name: 'Ethiopia' }, { code: 'NG', name: 'Nigeria' },
  { code: 'EG', name: 'Egypt' }, { code: 'ZA', name: 'South Africa' },
  { code: 'MA', name: 'Morocco' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' }, { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' }, { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' }, { code: 'JP', name: 'Japan' },
  { code: 'SA', name: 'Saudi Arabia' }, { code: 'AE', name: 'UAE' },
];

interface SearchResult {
  victims: RansomwareVictim[];
  total: number;
  country?: string;
  message?: string;
}

interface Props {
  compact?: boolean;
}

const RansomwareSearch: React.FC<Props> = ({ compact = false }) => {
  const [mode, setMode] = useState<'country' | 'keyword'>('country');
  const [country, setCountry] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchedLabel, setSearchedLabel] = useState('');

  const doSearch = useCallback(async (path: string, label: string) => {
    setLoading(true);
    setResults(null);
    setSearchedLabel(label);
    try {
      const res = await fetch(`${PROXY_BASE}?path=${encodeURIComponent(path)}`, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        setResults({ victims: [], total: 0, message: `API error (${res.status})` });
        return;
      }
      const data = await res.json();
      setResults({
        victims: data.victims ?? [],
        total: data.total ?? data.victims?.length ?? 0,
        country: data.country,
        message: data.message,
      });
    } catch {
      setResults({ victims: [], total: 0, message: 'Network error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => {
    if (mode === 'country') {
      const code = (country || customCode).toUpperCase().trim();
      if (!code) return;
      const name = RANSOMWARE_COUNTRIES.find(c => c.code === code)?.name ?? code;
      doSearch(`/ransomware/country/${code}`, name);
    } else {
      if (!keyword.trim()) return;
      doSearch(`/ransomware/search/${encodeURIComponent(keyword.trim())}`, keyword.trim());
    }
  };

  const searchSomalia = () => {
    setMode('country');
    setCountry('SO');
    setCustomCode('');
    doSearch('/ransomware/country/SO', 'Somalia');
  };

  const isSomaliaSearch = searchedLabel === 'Somalia' || results?.country?.toUpperCase() === 'SO';

  return (
    <div className="rounded-xl mb-6" style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-slate-400" />
          <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400 font-mono">RANSOMWARE SEARCH</p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 mb-3">
          {(['country', 'keyword'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-3 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
              style={{
                background: mode === m ? 'rgba(153,0,255,0.2)' : 'rgba(255,255,255,0.04)',
                color: mode === m ? '#c084fc' : '#64748b',
                border: `1px solid ${mode === m ? 'rgba(153,0,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {m === 'country' ? '🌍 Country' : '🔑 Keyword'}
            </button>
          ))}
        </div>

        {/* Search inputs */}
        <div className={`flex ${compact ? 'flex-col gap-2' : 'items-center gap-2 flex-wrap'}`}>
          {mode === 'country' ? (
            <>
              <select
                value={country}
                onChange={e => { setCountry(e.target.value); setCustomCode(''); }}
                className="rounded px-2 py-1.5 text-[11px] font-mono text-white flex-1 min-w-[140px]"
                style={{ background: '#141428', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <option value="">Select country…</option>
                {RANSOMWARE_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
              <span className="text-[9px] text-slate-500 font-mono">or</span>
              <input
                type="text"
                placeholder="ISO2 code"
                maxLength={2}
                value={customCode}
                onChange={e => { setCustomCode(e.target.value.toUpperCase()); setCountry(''); }}
                className="rounded px-2 py-1.5 text-[11px] font-mono text-white w-16 uppercase"
                style={{ background: '#141428', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </>
          ) : (
            <input
              type="text"
              placeholder="Search org name or keyword…"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="rounded px-2 py-1.5 text-[11px] font-mono text-white flex-1 min-w-[140px]"
              style={{ background: '#141428', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          )}

          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5"
            style={{ background: 'rgba(153,0,255,0.3)', color: '#c084fc', border: '1px solid rgba(153,0,255,0.4)' }}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            Search
          </button>

          <button
            onClick={searchSomalia}
            disabled={loading}
            className="px-3 py-1.5 rounded text-[10px] font-mono font-bold flex items-center gap-1"
            style={{ background: 'rgba(0,200,180,0.12)', color: '#2dd4bf', border: '1px solid rgba(0,200,180,0.2)' }}
          >
            🇸🇴 Check Somalia
          </button>
        </div>
      </div>

      {/* Results */}
      {(results || loading) && (
        <div className={compact ? 'px-3 pb-3' : 'px-4 pb-4'} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {loading ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              <span className="text-[11px] font-mono text-slate-400">Searching…</span>
            </div>
          ) : results && results.total === 0 ? (
            <div className="py-4">
              <p className="text-[12px] font-mono font-bold text-center" style={{ color: '#22c55e' }}>
                ✅ No ransomware victims recorded for {searchedLabel}
              </p>
              {isSomaliaSearch && (
                <p className="text-[10px] font-mono text-teal-400/70 text-center mt-2">
                  🇸🇴 Somalia Ransomware Exposure — monitored by CyberSomalia
                </p>
              )}
            </div>
          ) : results ? (
            <div className="pt-3">
              <p className="text-[11px] font-mono text-slate-300 mb-3">
                <span className="font-bold" style={{ color: '#9900ff' }}>{results.total}</span> ransomware victim{results.total !== 1 ? 's' : ''} found for <span className="text-white font-bold">{searchedLabel}</span>
              </p>
              {isSomaliaSearch && (
                <p className="text-[10px] font-mono text-teal-400/70 mb-3">
                  🇸🇴 Somalia Ransomware Exposure — monitored by CyberSomalia
                </p>
              )}
              <div className={`space-y-2 max-h-[350px] overflow-y-auto ${compact ? '' : 'pr-1'}`} style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                {results.victims.map((v, i) => {
                  const iso = (v.country || '').toLowerCase().slice(0, 2);
                  return (
                    <div key={i} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ff4400' }} />
                        <span className="text-[11px] font-mono font-bold" style={{ color: '#ff4400' }}>{v.group}</span>
                        {iso && <img src={`https://flagcdn.com/w20/${iso}.png`} alt="" className="w-4 h-3 object-cover rounded-sm" onError={e => (e.currentTarget.style.display = 'none')} />}
                      </div>
                      <p className="text-[11px] font-mono text-white mb-1">🏢 {v.victim}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] font-mono text-slate-500">
                        <span>🏭 {v.activity || 'Unknown'}</span>
                        <span>📅 {v.attackdate}</span>
                        {v.domain && <span>🌐 {v.domain}</span>}
                      </div>
                      {v.description && (
                        <p className="text-[9px] font-mono text-slate-500 mt-1 leading-relaxed">
                          📋 {v.description.length > 120 ? v.description.slice(0, 120) + '…' : v.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default RansomwareSearch;
