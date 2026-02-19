import React, { useEffect, useRef } from 'react';

interface GaugeProps {
  score: number;
  size?: number;
}

const getScoreColor = (score: number) => {
  if (score >= 75) return { stroke: 'hsl(145 100% 50%)', text: 'text-neon-green', glow: '0 0 30px hsl(145 100% 50% / 0.6)' };
  if (score >= 50) return { stroke: 'hsl(38 100% 55%)', text: 'text-neon-amber', glow: '0 0 30px hsl(38 100% 55% / 0.6)' };
  return { stroke: 'hsl(0 100% 60%)', text: 'text-neon-red', glow: '0 0 30px hsl(0 100% 60% / 0.6)' };
};

const getLabel = (score: number) => {
  if (score >= 75) return 'SECURE';
  if (score >= 50) return 'AT RISK';
  return 'CRITICAL';
};

const CircularGauge: React.FC<GaugeProps> = ({ score, size = 220 }) => {
  const circleRef = useRef<SVGCircleElement>(null);
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference - (clampedScore / 100) * circumference;
  const { stroke, text, glow } = getScoreColor(clampedScore);

  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
    circleRef.current.style.strokeDashoffset = `${offset}`;
  }, [offset]);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 200 200" className="overflow-visible">
        {/* Background ring */}
        <circle cx="100" cy="100" r={radius}
          fill="none"
          stroke="hsl(216 28% 14%)"
          strokeWidth="14"
        />
        {/* Tick marks */}
        {Array.from({ length: 20 }).map((_, i) => {
          const angle = (i / 20) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const x1 = 100 + (radius - 4) * Math.cos(rad);
          const y1 = 100 + (radius - 4) * Math.sin(rad);
          const x2 = 100 + (radius + 4) * Math.cos(rad);
          const y2 = 100 + (radius + 4) * Math.sin(rad);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(216 28% 20%)" strokeWidth="1.5" />;
        })}
        {/* Score arc */}
        <circle
          ref={circleRef}
          cx="100" cy="100" r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          transform="rotate(-90 100 100)"
          style={{ filter: `drop-shadow(${glow})` }}
        />
        {/* Center score */}
        <text x="100" y="92" textAnchor="middle" dominantBaseline="middle"
          fill={stroke} fontSize="36" fontWeight="bold" fontFamily="monospace"
          style={{ filter: `drop-shadow(0 0 8px ${stroke})` }}>
          {clampedScore}
        </text>
        <text x="100" y="115" textAnchor="middle" dominantBaseline="middle"
          fill="hsl(215 20% 55%)" fontSize="11" fontFamily="monospace" letterSpacing="2">
          / 100
        </text>
        {/* Label */}
        <text x="100" y="135" textAnchor="middle" dominantBaseline="middle"
          fill={stroke} fontSize="9" fontFamily="monospace" letterSpacing="3" fontWeight="bold">
          {getLabel(clampedScore)}
        </text>
      </svg>
    </div>
  );
};

export default CircularGauge;
