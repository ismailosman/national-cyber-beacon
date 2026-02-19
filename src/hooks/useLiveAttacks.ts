import { useState, useEffect, useRef, useCallback } from 'react';

export type AttackType = 'malware' | 'phishing' | 'exploit' | 'ddos' | 'intrusion';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface LiveThreat {
  id: string;
  source: { lat: number; lng: number; country: string };
  target: { lat: number; lng: number; country: string };
  attack_type: AttackType;
  severity: Severity;
  timestamp: number;
}

// ── Day-seeded PRNG ──────────────────────────────────────────────────────────
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function createSeededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

const DAY_STRING = new Date().toISOString().slice(0, 10); // e.g. "2026-02-19"
const DAY_SEED = hashStr(DAY_STRING);

// Real global sources with known cyber-threat actor presence
const THREAT_SOURCES: { country: string; lat: number; lng: number }[] = [
  { country: 'China', lat: 35.86, lng: 104.19 },
  { country: 'Russia', lat: 61.52, lng: 105.31 },
  { country: 'Iran', lat: 32.43, lng: 53.68 },
  { country: 'North Korea', lat: 40.33, lng: 127.51 },
  { country: 'USA', lat: 39.38, lng: -100.44 },
  { country: 'Netherlands', lat: 52.13, lng: 5.29 },
  { country: 'Germany', lat: 51.16, lng: 10.45 },
  { country: 'Ukraine', lat: 48.37, lng: 31.17 },
  { country: 'Brazil', lat: -14.23, lng: -51.92 },
  { country: 'India', lat: 20.59, lng: 78.96 },
  { country: 'Nigeria', lat: 9.08, lng: 8.67 },
  { country: 'Pakistan', lat: 30.37, lng: 69.34 },
  { country: 'Vietnam', lat: 14.05, lng: 108.27 },
  { country: 'Romania', lat: 45.94, lng: 24.96 },
  { country: 'Turkey', lat: 38.96, lng: 35.24 },
  { country: 'South Korea', lat: 35.90, lng: 127.76 },
  { country: 'Indonesia', lat: -0.78, lng: 113.92 },
  { country: 'France', lat: 46.23, lng: 2.21 },
  { country: 'UK', lat: 55.37, lng: -3.43 },
  { country: 'Saudi Arabia', lat: 23.88, lng: 45.07 },
  { country: 'Egypt', lat: 26.82, lng: 30.80 },
  { country: 'Singapore', lat: 1.35, lng: 103.81 },
  { country: 'Canada', lat: 56.13, lng: -106.34 },
  { country: 'Japan', lat: 36.20, lng: 138.25 },
  { country: 'Israel', lat: 31.04, lng: 34.85 },
  { country: 'Kenya', lat: -1.29, lng: 36.82 },
  { country: 'Ethiopia', lat: 9.14, lng: 40.49 },
];

// Weighted sources — major threat actors appear more frequently for bundled arc effect
const WEIGHTED_SOURCES: { country: string; lat: number; lng: number }[] = [
  ...Array(4).fill({ country: 'China', lat: 35.86, lng: 104.19 }),
  ...Array(4).fill({ country: 'Russia', lat: 61.52, lng: 105.31 }),
  ...Array(3).fill({ country: 'Iran', lat: 32.43, lng: 53.68 }),
  ...Array(3).fill({ country: 'USA', lat: 39.38, lng: -100.44 }),
  ...Array(2).fill({ country: 'North Korea', lat: 40.33, lng: 127.51 }),
  ...Array(2).fill({ country: 'Ukraine', lat: 48.37, lng: 31.17 }),
  ...Array(2).fill({ country: 'Kenya', lat: -1.29, lng: 36.82 }),
  ...Array(2).fill({ country: 'Ethiopia', lat: 9.14, lng: 40.49 }),
  ...THREAT_SOURCES,
];

// Somalia target locations (Mogadishu area government buildings + real org coordinates)
const SOMALIA_TARGETS = [
  { lat: 2.046, lng: 45.342, country: 'Somalia' },
  { lat: 2.059, lng: 45.321, country: 'Somalia' },
  { lat: 2.039, lng: 45.358, country: 'Somalia' },
  { lat: 2.068, lng: 45.333, country: 'Somalia' },
  { lat: 2.025, lng: 45.346, country: 'Somalia' },
  { lat: 2.050, lng: 45.370, country: 'Somalia' },
];

const ATTACK_TYPES: AttackType[] = ['malware', 'phishing', 'exploit', 'ddos', 'intrusion'];
const SEVERITIES: Severity[] = ['critical', 'high', 'high', 'medium', 'medium', 'low'];

// Generate the Nth threat of the day deterministically
function generateDayThreat(index: number): LiveThreat {
  const rand = createSeededRand(DAY_SEED + index * 7919);
  const source = WEIGHTED_SOURCES[Math.floor(rand() * WEIGHTED_SOURCES.length)];
  const target = SOMALIA_TARGETS[Math.floor(rand() * SOMALIA_TARGETS.length)];
  return {
    id: `${DAY_STRING}-${index}`,
    source: { ...source },
    target: { ...target },
    attack_type: ATTACK_TYPES[Math.floor(rand() * ATTACK_TYPES.length)],
    severity: SEVERITIES[Math.floor(rand() * SEVERITIES.length)],
    timestamp: Date.now(),
  };
}

const RING_BUFFER_SIZE = 100;

// Module-level singleton — deterministic daily count
const countRand = createSeededRand(DAY_SEED + 42);
const BASE_COUNT = Math.floor(3_000 + countRand() * 12_000);
let sharedTodayCount = BASE_COUNT;
const todayListeners = new Set<React.Dispatch<React.SetStateAction<number>>>();

function incrementSharedCount() {
  sharedTodayCount += 1;
  todayListeners.forEach(fn => fn(sharedTodayCount));
}

// Shared sequential index so all hook instances produce the same Nth threat
let sharedThreatIndex = 0;

export function useLiveAttacks(enabled: boolean) {
  const [threats, setThreats] = useState<LiveThreat[]>([]);
  const [todayCount, setTodayCount] = useState(sharedTodayCount);
  const lastRealEventRef = useRef<number>(0);

  // Register/unregister this instance's setter so all hooks stay in sync
  useEffect(() => {
    todayListeners.add(setTodayCount);
    return () => { todayListeners.delete(setTodayCount); };
  }, []);

  const addThreat = useCallback((threat: LiveThreat) => {
    setThreats(prev => [threat, ...prev].slice(0, RING_BUFFER_SIZE));
    incrementSharedCount();
  }, []);

  // Mock generator — runs when enabled, pauses automatically if real events flow
  useEffect(() => {
    if (!enabled) {
      setThreats([]);
      return;
    }

    // Deterministic delay per index
    const getDelay = (idx: number) => {
      const r = createSeededRand(DAY_SEED + idx * 3571);
      return 300 + r() * 700; // 0.3–1s
    };

    const scheduleNext = () => {
      const delay = getDelay(sharedThreatIndex);
      return setTimeout(() => {
        const realRecently = Date.now() - lastRealEventRef.current < 5000;
        if (!realRecently) {
          addThreat(generateDayThreat(sharedThreatIndex));
          sharedThreatIndex += 1;
        }
        timerRef.current = scheduleNext();
      }, delay);
    };

    const timerRef = { current: scheduleNext() };
    return () => clearTimeout(timerRef.current);
  }, [enabled, addThreat]);

  return { threats, todayCount };
}
