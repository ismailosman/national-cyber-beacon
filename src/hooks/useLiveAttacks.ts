import { useState, useEffect, useRef, useCallback } from 'react';

export type AttackType = 'malware' | 'phishing' | 'exploit' | 'ddos' | 'intrusion';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface LiveThreat {
  id: string;
  name: string;
  source: { lat: number; lng: number; country: string; state: string };
  target: { lat: number; lng: number; country: string; state: string };
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

const DAY_STRING = new Date().toISOString().slice(0, 10);
const DAY_SEED = hashStr(DAY_STRING);

// ── Deterministic delay for the Nth threat ──
function getDelay(index: number): number {
  const r = createSeededRand(DAY_SEED + index * 3571);
  // Every 3 attacks = 1 burst. After a burst, wait 18-22 seconds.
  if ((index + 1) % 3 === 0) {
    return 18000 + r() * 4000; // 18-22s pause between bursts
  }
  return 200 + r() * 300; // 200-500ms between attacks within a burst
}

// ── Calculate current position in day's sequence ──
function calculateCurrentIndex(): number {
  const now = new Date();
  const midnightMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const elapsedMs = now.getTime() - midnightMs;

  let totalMs = 0;
  let idx = 0;
  while (totalMs < elapsedMs) {
    totalMs += getDelay(idx);
    idx++;
  }
  return idx;
}

// Real global sources with known cyber-threat actor presence
const THREAT_SOURCES: { country: string; state: string; lat: number; lng: number }[] = [
  { country: 'China', state: 'Beijing', lat: 35.86, lng: 104.19 },
  { country: 'Russia', state: 'Moscow', lat: 61.52, lng: 105.31 },
  { country: 'Iran', state: 'Tehran', lat: 32.43, lng: 53.68 },
  { country: 'North Korea', state: 'Pyongyang', lat: 40.33, lng: 127.51 },
  { country: 'USA', state: 'VA', lat: 37.43, lng: -78.65 },
  { country: 'USA', state: 'CA', lat: 36.77, lng: -119.41 },
  { country: 'USA', state: 'TX', lat: 31.96, lng: -99.90 },
  { country: 'USA', state: 'NY', lat: 40.71, lng: -74.00 },
  { country: 'USA', state: 'FL', lat: 27.99, lng: -81.76 },
  { country: 'USA', state: 'IL', lat: 40.63, lng: -89.39 },
  { country: 'USA', state: 'WA', lat: 47.75, lng: -120.74 },
  { country: 'USA', state: 'GA', lat: 32.16, lng: -82.90 },
  { country: 'Netherlands', state: 'Amsterdam', lat: 52.13, lng: 5.29 },
  { country: 'Germany', state: 'Berlin', lat: 51.16, lng: 10.45 },
  { country: 'Ukraine', state: 'Kyiv', lat: 48.37, lng: 31.17 },
  { country: 'Brazil', state: 'São Paulo', lat: -14.23, lng: -51.92 },
  { country: 'India', state: 'Mumbai', lat: 20.59, lng: 78.96 },
  { country: 'Nigeria', state: 'Lagos', lat: 9.08, lng: 8.67 },
  { country: 'Pakistan', state: 'Islamabad', lat: 30.37, lng: 69.34 },
  { country: 'Vietnam', state: 'Hanoi', lat: 14.05, lng: 108.27 },
  { country: 'Romania', state: 'Bucharest', lat: 45.94, lng: 24.96 },
  { country: 'Turkey', state: 'Istanbul', lat: 38.96, lng: 35.24 },
  { country: 'South Korea', state: 'Seoul', lat: 35.90, lng: 127.76 },
  { country: 'Indonesia', state: 'Jakarta', lat: -0.78, lng: 113.92 },
  { country: 'France', state: 'Paris', lat: 46.23, lng: 2.21 },
  { country: 'UK', state: 'London', lat: 55.37, lng: -3.43 },
  { country: 'Saudi Arabia', state: 'Riyadh', lat: 23.88, lng: 45.07 },
  { country: 'Egypt', state: 'Cairo', lat: 26.82, lng: 30.80 },
  { country: 'Singapore', state: 'Singapore', lat: 1.35, lng: 103.81 },
  { country: 'Canada', state: 'Ontario', lat: 43.65, lng: -79.38 },
  { country: 'Canada', state: 'Quebec', lat: 45.50, lng: -73.56 },
  { country: 'Canada', state: 'BC', lat: 49.28, lng: -123.12 },
  { country: 'Canada', state: 'Alberta', lat: 51.04, lng: -114.07 },
  { country: 'Canada', state: 'Manitoba', lat: 49.89, lng: -97.13 },
  { country: 'Japan', state: 'Tokyo', lat: 36.20, lng: 138.25 },
  { country: 'Israel', state: 'Tel Aviv', lat: 31.04, lng: 34.85 },
  { country: 'Kenya', state: 'Nairobi', lat: -1.29, lng: 36.82 },
  { country: 'Ethiopia', state: 'Addis Ababa', lat: 9.14, lng: 40.49 },
  { country: 'Argentina', state: 'Buenos Aires', lat: -34.60, lng: -58.38 },
  { country: 'Colombia', state: 'Bogota', lat: 4.71, lng: -74.07 },
  { country: 'Chile', state: 'Santiago', lat: -33.44, lng: -70.65 },
  { country: 'Venezuela', state: 'Caracas', lat: 10.48, lng: -66.90 },
  { country: 'Rwanda', state: 'Kigali', lat: -1.94, lng: 29.87 },
  { country: 'South Africa', state: 'Johannesburg', lat: -26.20, lng: 28.04 },
  { country: 'Ghana', state: 'Accra', lat: 5.60, lng: -0.19 },
  { country: 'Tanzania', state: 'Dar es Salaam', lat: -6.79, lng: 39.28 },
];

// Weighted sources — major threat actors appear more frequently
const WEIGHTED_SOURCES: { country: string; state: string; lat: number; lng: number }[] = [
  ...Array(4).fill({ country: 'China', state: 'Beijing', lat: 35.86, lng: 104.19 }),
  ...Array(4).fill({ country: 'Russia', state: 'Moscow', lat: 61.52, lng: 105.31 }),
  ...Array(3).fill({ country: 'Iran', state: 'Tehran', lat: 32.43, lng: 53.68 }),
  { country: 'USA', state: 'VA', lat: 37.43, lng: -78.65 },
  { country: 'USA', state: 'CA', lat: 36.77, lng: -119.41 },
  { country: 'USA', state: 'TX', lat: 31.96, lng: -99.90 },
  { country: 'USA', state: 'NY', lat: 40.71, lng: -74.00 },
  { country: 'USA', state: 'FL', lat: 27.99, lng: -81.76 },
  { country: 'USA', state: 'IL', lat: 40.63, lng: -89.39 },
  { country: 'USA', state: 'WA', lat: 47.75, lng: -120.74 },
  { country: 'USA', state: 'GA', lat: 32.16, lng: -82.90 },
  ...Array(2).fill({ country: 'North Korea', state: 'Pyongyang', lat: 40.33, lng: 127.51 }),
  ...Array(2).fill({ country: 'Israel', state: 'Tel Aviv', lat: 31.04, lng: 34.85 }),
  ...Array(2).fill({ country: 'Ukraine', state: 'Kyiv', lat: 48.37, lng: 31.17 }),
  ...Array(2).fill({ country: 'Kenya', state: 'Nairobi', lat: -1.29, lng: 36.82 }),
  ...Array(2).fill({ country: 'Ethiopia', state: 'Addis Ababa', lat: 9.14, lng: 40.49 }),
  ...Array(2).fill({ country: 'Rwanda', state: 'Kigali', lat: -1.94, lng: 29.87 }),
  ...Array(2).fill({ country: 'South Africa', state: 'Johannesburg', lat: -26.20, lng: 28.04 }),
  ...THREAT_SOURCES,
];

// Somalia target locations
const SOMALIA_TARGETS = [
  { lat: 2.046, lng: 45.342, country: 'Somalia', state: 'Mogadishu' },
  { lat: 2.059, lng: 45.321, country: 'Somalia', state: 'Banaadir' },
  { lat: 2.039, lng: 45.358, country: 'Somalia', state: 'Mogadishu' },
  { lat: 2.068, lng: 45.333, country: 'Somalia', state: 'Hodan' },
  { lat: 2.025, lng: 45.346, country: 'Somalia', state: 'Wadajir' },
  { lat: 2.050, lng: 45.370, country: 'Somalia', state: 'Hamar Weyne' },
  { lat: 9.560, lng: 44.064, country: 'Somalia', state: 'Hargeisa' },
  { lat: 9.558, lng: 44.070, country: 'Somalia', state: 'Ahmed Dhagah' },
  { lat: 9.565, lng: 44.058, country: 'Somalia', state: "Ga'an Libah" },
  { lat: 9.553, lng: 44.075, country: 'Somalia', state: 'Mohamed Mooge' },
];

const ATTACK_TYPES: AttackType[] = ['malware', 'phishing', 'exploit', 'ddos', 'intrusion'];
const SEVERITIES: Severity[] = ['critical', 'high', 'high', 'medium', 'medium', 'low'];

// ── Attack Signature Names ───────────────────────────────────────────────────
const ATTACK_SIGNATURES: Record<AttackType, string[]> = {
  malware: [
    'DONUT HUSKY', 'Cobalt Strike Beacon', 'Agent Tesla Keylogger',
    'Emotet Dropper Detected', 'Qakbot Payload Delivery', 'Raccoon Stealer v2',
    'AsyncRAT C2 Callback', 'IcedID Banking Trojan',
  ],
  phishing: [
    'DNS MX record null prefix', 'Credential Harvest Form', 'OAuth Token Phish Attempt',
    'Spear Phish PDF Lure', 'Homograph Domain Spoof', 'MFA Fatigue Push Attack',
    'QR Code Phish Redirect', 'Brand Impersonation Kit',
  ],
  exploit: [
    'NULL Encoding detected within a HT...', 'Apache Log4j RCE', 'SMB EternalBlue Exploit',
    'ProxyShell Exchange RCE', 'Spring4Shell Remote Code', 'MOVEit SQL Injection',
    'Citrix Bleed Overflow', 'FortiOS Path Traversal',
  ],
  ddos: [
    'SYN Flood Volumetric Attack', 'DNS Amplification Detected', 'HTTP Slowloris Connection',
    'NTP Monlist Reflection', 'CLDAP Reflection Flood', 'TCP RST Storm Detected',
    'UDP Fragmentation Flood', 'Memcached Amplification',
  ],
  intrusion: [
    'Brute Force SSH Login', 'Lateral Movement via WMI', 'Pass-the-Hash NTLM Relay',
    'Kerberoasting AS-REP', 'DCSync Replication Attack', 'Golden Ticket Forged',
    'BloodHound AD Recon', 'RDP Tunnel Persistence',
  ],
};

// Generate the Nth threat of the day deterministically (seeded PRNG per index)
function generateDayThreat(index: number): LiveThreat {
  const rand = createSeededRand(DAY_SEED + index * 7919);
  const source = WEIGHTED_SOURCES[Math.floor(rand() * WEIGHTED_SOURCES.length)];
  const target = SOMALIA_TARGETS[Math.floor(rand() * SOMALIA_TARGETS.length)];
  const attack_type = ATTACK_TYPES[Math.floor(rand() * ATTACK_TYPES.length)];
  const signatures = ATTACK_SIGNATURES[attack_type];
  const name = signatures[Math.floor(rand() * signatures.length)];
  return {
    id: `${DAY_STRING}-${index}`,
    name,
    source: { lat: source.lat, lng: source.lng, country: source.country, state: source.state },
    target: { lat: target.lat, lng: target.lng, country: target.country, state: target.state },
    attack_type,
    severity: SEVERITIES[Math.floor(rand() * SEVERITIES.length)],
    timestamp: Date.now(),
  };
}

const RING_BUFFER_SIZE = 100;

// Module-level singleton — deterministic daily count + time-based initialization
const countRand = createSeededRand(DAY_SEED + 42);
const BASE_COUNT = Math.floor(3_000 + countRand() * 12_000);

// Calculate where we are in the day's sequence based on elapsed time since midnight
const initialIndex = calculateCurrentIndex();
let sharedTodayCount = BASE_COUNT + initialIndex;
let sharedThreatIndex = initialIndex;

const todayListeners = new Set<React.Dispatch<React.SetStateAction<number>>>();

function incrementSharedCount() {
  sharedTodayCount += 1;
  todayListeners.forEach(fn => fn(sharedTodayCount));
}

export function useLiveAttacks(enabled: boolean) {
  const [threats, setThreats] = useState<LiveThreat[]>([]);
  const [todayCount, setTodayCount] = useState(sharedTodayCount);
  const lastRealEventRef = useRef<number>(0);

  // Register/unregister this instance's setter so all hooks stay in sync
  useEffect(() => {
    todayListeners.add(setTodayCount);
    return () => { todayListeners.delete(setTodayCount); };
  }, []);

  const addThreat = useCallback((threat: LiveThreat, isBurstStart: boolean) => {
    setThreats(prev => {
      if (isBurstStart) return [threat]; // clear old batch
      return [threat, ...prev].slice(0, RING_BUFFER_SIZE);
    });
    incrementSharedCount();
  }, []);

  // Mock generator — runs when enabled, pauses automatically if real events flow
  useEffect(() => {
    if (!enabled) {
      setThreats([]);
      return;
    }

    const scheduleNext = () => {
      const delay = getDelay(sharedThreatIndex);
      return setTimeout(() => {
        const realRecently = Date.now() - lastRealEventRef.current < 5000;
        if (!realRecently) {
          const isBurstStart = sharedThreatIndex % 3 === 0;
          addThreat(generateDayThreat(sharedThreatIndex), isBurstStart);
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
