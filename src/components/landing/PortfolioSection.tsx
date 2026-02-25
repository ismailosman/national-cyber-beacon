import React, { useState, useEffect, useRef } from 'react';
import { Radar, Monitor, Server, ShieldAlert } from 'lucide-react';

const services = [
  {
    id: '01',
    icon: Radar,
    title: 'Threat Detection',
    subtitle: 'AI-Powered Intelligence',
    desc: 'AI-powered threat detection that identifies malware, phishing, and zero-day exploits in real time across your entire attack surface.',
    metric: '99.7%',
    metricLabel: 'Detection Rate',
    tag: 'ACTIVE',
    color: '#00ff88',
  },
  {
    id: '02',
    icon: Monitor,
    title: 'Real-Time Monitoring',
    subtitle: '24/7 SOC Operations',
    desc: 'Continuous 24/7 monitoring of networks, endpoints, and cloud environments with sub-second alerting and automated triage.',
    metric: '<0.3s',
    metricLabel: 'Alert Latency',
    tag: 'LIVE',
    color: '#00cfff',
  },
  {
    id: '03',
    icon: Server,
    title: 'Infrastructure Protection',
    subtitle: 'Hardening & Defense',
    desc: 'Harden servers, databases, and cloud assets against DDoS, intrusion, and data exfiltration with zero-trust architecture enforcement.',
    metric: '36+',
    metricLabel: 'Orgs Protected',
    tag: 'HARDENED',
    color: '#ff6b35',
  },
  {
    id: '04',
    icon: ShieldAlert,
    title: 'Incident Response',
    subtitle: 'Rapid Containment',
    desc: 'Rapid containment and forensic analysis when breaches occur, minimizing damage and downtime with battle-tested IR playbooks.',
    metric: '<15min',
    metricLabel: 'MTTR',
    tag: 'CRITICAL',
    color: '#ff3366',
  },
];

interface ServiceCardProps {
  service: typeof services[0];
  index: number;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, index }) => {
  const [hovered, setHovered] = useState(false);
  const [scanPos, setScanPos] = useState(0);
  const frameRef = useRef<number>();
  const posRef = useRef(0);

  useEffect(() => {
    if (!hovered) {
      setScanPos(0);
      return;
    }
    const animate = () => {
      posRef.current = (posRef.current + 1.5) % 100;
      setScanPos(posRef.current);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [hovered]);

  const Icon = service.icon;
  const delay = `${index * 0.15}s`;

  const cornerPositions = [
    { top: -1, left: -1, transform: 'none' },
    { top: -1, right: -1, transform: 'scaleX(-1)' },
    { bottom: -1, left: -1, transform: 'scaleY(-1)' },
    { bottom: -1, right: -1, transform: 'scale(-1)' },
  ];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); posRef.current = 0; }}
      className="rounded-xl relative overflow-hidden cursor-default"
      style={{
        background: 'rgba(8,18,32,0.95)',
        border: `1px solid ${hovered ? service.color : 'rgba(255,255,255,0.07)'}`,
        padding: '2px',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        boxShadow: hovered
          ? `0 0 32px -8px ${service.color}, inset 0 0 32px -16px ${service.color}`
          : 'none',
        animation: 'cyberFadeUp 0.6s ease both',
        animationDelay: delay,
      }}
    >
      {/* Scan line */}
      {hovered && (
        <div
          className="absolute left-0 w-full pointer-events-none"
          style={{
            top: `${scanPos}%`,
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${service.color}, transparent)`,
            opacity: 0.5,
            zIndex: 10,
          }}
        />
      )}

      {/* Corner brackets */}
      {cornerPositions.map((pos, i) => (
        <svg
          key={i}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          className="absolute pointer-events-none"
          style={{ ...pos, zIndex: 5 } as React.CSSProperties}
        >
          <path d="M0 12 L0 0 L12 0" fill="none" stroke={service.color} strokeWidth="1.5" opacity={0.5} />
        </svg>
      ))}

      {/* Card content */}
      <div className="relative p-6" style={{ zIndex: 2 }}>
        {/* Top row: icon + id/tag */}
        <div className="flex items-start justify-between mb-5">
          <div className="relative w-14 h-14 flex items-center justify-center">
            {/* Octagon border */}
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
              <polygon
                points="30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30"
                fill="none"
                stroke={service.color}
                strokeWidth="2"
                opacity={0.4}
              />
            </svg>
            <Icon className="w-6 h-6" style={{ color: service.color }} />
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span
              className="text-xs tracking-widest"
              style={{ fontFamily: "'Share Tech Mono', monospace", color: 'rgba(255,255,255,0.3)' }}
            >
              {service.id}
            </span>
            <span
              className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full"
              style={{
                color: service.color,
                border: `1px solid ${service.color}`,
                background: `${service.color}15`,
              }}
            >
              ● {service.tag}
            </span>
          </div>
        </div>

        {/* Title block */}
        <div className="mb-3">
          <h3
            className="text-lg font-bold tracking-wide"
            style={{ fontFamily: "'Rajdhani', sans-serif", color: '#fff' }}
          >
            {service.title}
          </h3>
          <p
            className="text-xs tracking-wider mt-0.5"
            style={{ fontFamily: "'Share Tech Mono', monospace", color: service.color, opacity: 0.7 }}
          >
            {service.subtitle}
          </p>
        </div>

        {/* Description */}
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {service.desc}
        </p>

        {/* Metric bar */}
        <div
          className="flex items-center justify-between rounded-lg px-4 py-2.5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-lg font-bold"
              style={{ fontFamily: "'Orbitron', sans-serif", color: service.color }}
            >
              {service.metric}
            </span>
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {service.metricLabel}
            </span>
          </div>
          <div
            className="w-8 h-1 rounded-full"
            style={{ background: `linear-gradient(90deg, ${service.color}, transparent)` }}
          />
        </div>
      </div>
    </div>
  );
};

const PortfolioSection: React.FC = () => (
  <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;600;900&display=swap');

      @keyframes cyberFadeUp {
        from { opacity: 0; transform: translateY(24px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>

    <section
      id="portfolio"
      className="relative py-24 px-6"
      style={{ background: '#060e1a', minHeight: '100vh' }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Radial glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '20%',
          left: '50%',
          width: '600px',
          height: '600px',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, rgba(0,207,255,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto" style={{ zIndex: 1 }}>
        {/* Section heading */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2
            className="text-3xl sm:text-4xl font-black tracking-wider"
            style={{ fontFamily: "'Orbitron', sans-serif", color: '#fff' }}
          >
            Our Services
          </h2>
          <p
            className="mt-4 text-sm leading-relaxed"
            style={{ fontFamily: "'Rajdhani', sans-serif", color: 'rgba(255,255,255,0.45)' }}
          >
            Comprehensive cybersecurity solutions tailored to protect modern enterprises from sophisticated digital threats.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          {services.map((s, i) => (
            <ServiceCard key={s.id} service={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  </>
);

export default PortfolioSection;
