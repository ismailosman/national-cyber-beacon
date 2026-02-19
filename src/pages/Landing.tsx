import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, AlertTriangle, RefreshCw, Zap, Globe, ChevronRight, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import logoSrc from '@/assets/logo.png';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#facc15',
  low:      '#3b82f6',
};

type PublicStats = {
  severity_counts: Record<string, number>;
  region_stats: Record<string, { count: number; dominant: string }>;
  total_orgs: number;
  total_open_alerts: number;
  updated_at: string;
};

function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const started = React.useRef(false);
  useEffect(() => {
    if (target === 0 || started.current) return;
    started.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setValue(Math.round(eased * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;

const Landing: React.FC = () => {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const orgsCount    = useCountUp(stats?.total_orgs ?? 0);
  const alertsCount  = useCountUp(stats?.total_open_alerts ?? 0);
  const regionsCount = useCountUp(stats ? Object.keys(stats.region_stats).length : 0);

  useEffect(() => {
    setStatsError(false);
    supabase.functions.invoke('public-stats').then(({ data, error }) => {
      if (error || !data) { setStatsError(true); return; }
      setStats(data as PublicStats);
    });
  }, [retryKey]);

  const sev = stats?.severity_counts ?? {};

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 px-6 py-3 flex items-center justify-between backdrop-blur-md"
        style={{ background: 'hsl(var(--background) / 0.85)' }}>
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="Logo" className="w-7 h-7 object-contain" />
          <div>
            <h1 className="text-xs font-bold text-foreground tracking-widest uppercase">Somalia National Cyber Observatory</h1>
            <p className="text-[9px] text-muted-foreground tracking-widest uppercase">Public Threat Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/cyber-map"
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg border border-border hover:border-primary hover:text-primary transition-colors text-muted-foreground"
          >
            <Zap className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">Live Attack Map</span>
          </Link>
          <Link
            to="/login"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Shield className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden xs:inline sm:inline">Sign In</span>
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-6 pt-32 pb-20 overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary)/0.12), transparent 70%), hsl(var(--background))',
        }}
      >
        {/* Dot grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(0,229,255,0.12) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Scan line */}
        <div
          className="absolute inset-x-0 h-px opacity-20 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)',
            animation: 'scanline 4s ease-in-out infinite',
            top: '40%',
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Live pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-background/60 backdrop-blur text-xs font-mono text-muted-foreground mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live threat monitoring · Somalia National CERT
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-foreground leading-tight tracking-tight mb-4">
            National Cyber Defense<br />
            <span className="text-primary">Command Center</span>
          </h1>

          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
            Real-time visibility into Somalia's cyber threat landscape. Monitor attacks, manage incidents, and protect critical infrastructure.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/cyber-map"
              className="flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl border border-primary text-primary hover:bg-primary/10 transition-colors"
            >
              <Zap className="w-4 h-4" /> Live Attack Map
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Access Platform <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Stat counters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-12">
            {[
              { value: orgsCount,    label: 'Organizations Monitored', suffix: '+' },
              { value: alertsCount,  label: 'Open Alerts',             suffix: '' },
              { value: regionsCount, label: 'Active Regions',          suffix: '' },
            ].map(({ value, label, suffix }) => (
              <div
                key={label}
                className="glass-card rounded-xl border border-border/60 p-4 text-center"
                style={{ background: 'hsl(var(--card)/0.6)' }}
              >
                <p className="text-2xl font-black font-mono text-foreground">
                  {stats ? `${value}${suffix}` : <span className="opacity-30">—</span>}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Attack Map Section ─────────────────────────────────────── */}
      <section className="px-4 sm:px-6 pb-10 sm:pb-12 max-w-7xl mx-auto w-full">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Live Cyber Attack Map · Somalia National CERT
            </span>
          </div>
          <Link
            to="/cyber-map"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Zap className="w-3 h-3" /> Open Full Screen
          </Link>
        </div>

        {/* Mobile: show a link card instead of the heavy iframe */}
        <Link
          to="/cyber-map"
          className="sm:hidden glass-card rounded-2xl border border-border flex flex-col items-center justify-center gap-4 p-8 text-center hover:border-primary/50 transition-colors"
        >
          <div className="w-14 h-14 rounded-2xl border border-primary/30 flex items-center justify-center"
            style={{ background: 'hsl(var(--primary)/0.1)' }}>
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="font-bold text-foreground text-lg">View Live Attack Map</p>
            <p className="text-sm text-muted-foreground mt-1">Real-time attacks targeting Somalia</p>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-bold text-primary">
            Open Full Screen →
          </span>
        </Link>

        {/* Desktop: show the actual iframe */}
        <div
          className="hidden sm:block glass-card rounded-2xl border border-border overflow-hidden relative"
          style={{ height: '560px' }}
        >
          <iframe
            src="/cyber-map"
            title="Live Cyber Attack Map"
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>

        {/* Severity stat cards below the map */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {SEVERITY_ORDER.map((s) => (
            <div
              key={s}
              className="glass-card rounded-xl border border-border p-3 sm:p-4 flex flex-col items-center gap-1"
              style={{ borderColor: `${SEVERITY_COLORS[s]}30` }}
            >
              <div
                className="w-3 h-3 rounded-full mb-1"
                style={{ background: SEVERITY_COLORS[s], boxShadow: `0 0 8px ${SEVERITY_COLORS[s]}70` }}
              />
              <span className="text-xl sm:text-2xl font-bold font-mono" style={{ color: SEVERITY_COLORS[s] }}>
                {stats ? (sev[s] ?? 0) : '—'}
              </span>
              <span className="text-xs text-muted-foreground capitalize">{s}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="px-6 pb-16 max-w-6xl mx-auto w-full">
        <div
          className="rounded-2xl border border-border p-6 sm:p-10 flex flex-col items-center gap-5 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--card)), hsl(var(--primary)/0.06))',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(0,229,255,0.06) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
          <div className="relative z-10 flex flex-col items-center gap-5">
            <div className="w-12 h-12 rounded-2xl border border-border flex items-center justify-center"
              style={{ background: 'hsl(var(--primary)/0.1)' }}>
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground">Access the Full Platform</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Detailed alert management, organization profiles, compliance reports, incident tracking, and real-time CERT advisories.
              </p>
            </div>
            <Link
              to="/login"
              className="flex items-center gap-2 px-8 py-3 text-sm font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Shield className="w-4 h-4" /> Sign In to Access Full Platform
            </Link>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Authorized personnel only
            </p>
          </div>
        </div>
      </section>

      {/* Error retry */}
      {statsError && (
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground pb-6">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Could not load live stats.
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      <footer className="border-t border-border px-6 py-5 text-center text-xs text-muted-foreground mt-auto">
        Somalia National Cyber Defense Observatory · Public read-only view · Data updated in real-time
      </footer>

      <style>{`
        @keyframes scanline {
          0%, 100% { top: 20%; opacity: 0; }
          10% { opacity: 0.3; }
          50% { top: 80%; opacity: 0.15; }
          90% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default Landing;
