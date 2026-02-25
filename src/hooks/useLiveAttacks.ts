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
  const cycle = index % 3;
  if (cycle === 0) return 2000;  // 2 seconds
  if (cycle === 1) return 3000;  // 3 seconds
  return 5000;                   // 5 seconds
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

// Somalia-only targets
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
  { lat: 2.046, lng: 45.342, country: 'Somalia', state: 'Mogadishu' },
  { lat: 2.059, lng: 45.321, country: 'Somalia', state: 'Banaadir' },
];

const GLOBAL_SOUTH_TARGETS = [
  { lat: 6.524, lng: 3.379, country: 'Nigeria', state: 'Lagos' },
  { lat: 24.713, lng: 46.675, country: 'Saudi Arabia', state: 'Riyadh' },
  { lat: -26.204, lng: 28.045, country: 'South Africa', state: 'Johannesburg' },
  { lat: 33.693, lng: 73.039, country: 'Pakistan', state: 'Islamabad' },
  { lat: 11.588, lng: 43.145, country: 'Djibouti', state: 'Djibouti City' },
  { lat: 36.806, lng: 10.166, country: 'Tunisia', state: 'Tunis' },
  { lat: 19.076, lng: 72.878, country: 'India', state: 'Mumbai' },
  { lat: -1.286, lng: 36.817, country: 'Kenya', state: 'Nairobi' },
  { lat: 32.902, lng: 13.180, country: 'Libya', state: 'Tripoli' },
  { lat: 9.025, lng: 38.747, country: 'Ethiopia', state: 'Addis Ababa' },
  { lat: 21.486, lng: 39.192, country: 'Saudi Arabia', state: 'Jeddah' },
  { lat: 4.051, lng: 9.768, country: 'Cameroon', state: 'Douala' },
  { lat: 25.286, lng: 51.534, country: 'Qatar', state: 'Doha' },
  { lat: -6.792, lng: 39.208, country: 'Tanzania', state: 'Dar es Salaam' },
  { lat: 33.573, lng: -7.589, country: 'Morocco', state: 'Casablanca' },
  { lat: 28.614, lng: 77.209, country: 'India', state: 'New Delhi' },
  { lat: 30.044, lng: 31.236, country: 'Egypt', state: 'Cairo' },
  { lat: -4.441, lng: 15.266, country: 'DR Congo', state: 'Kinshasa' },
  { lat: 14.716, lng: -17.467, country: 'Senegal', state: 'Dakar' },
  { lat: 24.861, lng: 67.010, country: 'Pakistan', state: 'Karachi' },
  { lat: -33.925, lng: 18.424, country: 'South Africa', state: 'Cape Town' },
  { lat: 9.060, lng: 7.486, country: 'Nigeria', state: 'Abuja' },
  { lat: 4.859, lng: 31.571, country: 'South Sudan', state: 'Juba' },
  { lat: 36.753, lng: 3.042, country: 'Algeria', state: 'Algiers' },
  { lat: -25.966, lng: 32.573, country: 'Mozambique', state: 'Maputo' },
  { lat: 15.500, lng: 32.560, country: 'Sudan', state: 'Khartoum' },
  { lat: 5.603, lng: -0.187, country: 'Ghana', state: 'Accra' },
  { lat: 31.200, lng: 29.919, country: 'Egypt', state: 'Alexandria' },
  { lat: -1.940, lng: 29.874, country: 'Rwanda', state: 'Kigali' },
  { lat: 9.601, lng: 41.850, country: 'Ethiopia', state: 'Dire Dawa' },
  { lat: -8.839, lng: 13.234, country: 'Angola', state: 'Luanda' },
  { lat: 0.347, lng: 32.582, country: 'Uganda', state: 'Kampala' },
  { lat: 35.697, lng: -0.633, country: 'Algeria', state: 'Oran' },
  { lat: -4.043, lng: 39.668, country: 'Kenya', state: 'Mombasa' },
  { lat: -6.163, lng: 35.752, country: 'Tanzania', state: 'Dodoma' },
];

// ── North America corridor targets ───────────────────────────────────────────
const NORTH_AMERICA_TARGETS = [
  // USA - East Coast
  { lat: 38.90, lng: -77.04, country: 'USA', state: 'Washington DC' },
  { lat: 40.71, lng: -74.00, country: 'USA', state: 'New York' },
  { lat: 33.75, lng: -84.39, country: 'USA', state: 'Atlanta' },
  { lat: 25.76, lng: -80.19, country: 'USA', state: 'Miami' },
  { lat: 42.36, lng: -71.06, country: 'USA', state: 'Boston' },
  { lat: 39.95, lng: -75.17, country: 'USA', state: 'Philadelphia' },
  // USA - Midwest
  { lat: 41.88, lng: -87.63, country: 'USA', state: 'Chicago' },
  { lat: 42.33, lng: -83.05, country: 'USA', state: 'Detroit' },
  { lat: 44.98, lng: -93.27, country: 'USA', state: 'Minneapolis' },
  { lat: 38.63, lng: -90.20, country: 'USA', state: 'St. Louis' },
  { lat: 39.10, lng: -94.58, country: 'USA', state: 'Kansas City' },
  { lat: 39.96, lng: -82.99, country: 'USA', state: 'Columbus' },
  { lat: 39.77, lng: -86.16, country: 'USA', state: 'Indianapolis' },
  { lat: 43.04, lng: -87.91, country: 'USA', state: 'Milwaukee' },
  // USA - West Coast
  { lat: 34.05, lng: -118.24, country: 'USA', state: 'Los Angeles' },
  { lat: 37.77, lng: -122.42, country: 'USA', state: 'San Francisco' },
  { lat: 32.72, lng: -117.16, country: 'USA', state: 'San Diego' },
  { lat: 47.61, lng: -122.33, country: 'USA', state: 'Seattle' },
  { lat: 45.52, lng: -122.68, country: 'USA', state: 'Portland' },
  { lat: 39.74, lng: -104.99, country: 'USA', state: 'Denver' },
  { lat: 33.45, lng: -112.07, country: 'USA', state: 'Phoenix' },
  { lat: 36.17, lng: -115.14, country: 'USA', state: 'Las Vegas' },
  { lat: 40.76, lng: -111.89, country: 'USA', state: 'Salt Lake City' },
  { lat: 21.31, lng: -157.86, country: 'USA', state: 'Honolulu' },
  // USA - South
  { lat: 32.78, lng: -96.80, country: 'USA', state: 'Dallas' },
  { lat: 29.76, lng: -95.37, country: 'USA', state: 'Houston' },
  { lat: 30.27, lng: -97.74, country: 'USA', state: 'Austin' },
  { lat: 36.16, lng: -86.78, country: 'USA', state: 'Nashville' },
  { lat: 35.23, lng: -80.84, country: 'USA', state: 'Charlotte' },
  { lat: 29.95, lng: -90.07, country: 'USA', state: 'New Orleans' },
  { lat: 29.42, lng: -98.49, country: 'USA', state: 'San Antonio' },
  // Canada
  { lat: 43.65, lng: -79.38, country: 'Canada', state: 'Toronto' },
  { lat: 45.50, lng: -73.57, country: 'Canada', state: 'Montreal' },
  { lat: 49.28, lng: -123.12, country: 'Canada', state: 'Vancouver' },
  { lat: 51.04, lng: -114.07, country: 'Canada', state: 'Calgary' },
  { lat: 45.42, lng: -75.70, country: 'Canada', state: 'Ottawa' },
  { lat: 53.55, lng: -113.49, country: 'Canada', state: 'Edmonton' },
  { lat: 49.90, lng: -97.14, country: 'Canada', state: 'Winnipeg' },
  { lat: 44.65, lng: -63.57, country: 'Canada', state: 'Halifax' },
  // Mexico
  { lat: 19.43, lng: -99.13, country: 'Mexico', state: 'Mexico City' },
  { lat: 20.67, lng: -103.35, country: 'Mexico', state: 'Guadalajara' },
  { lat: 25.69, lng: -100.32, country: 'Mexico', state: 'Monterrey' },
  { lat: 21.16, lng: -86.85, country: 'Mexico', state: 'Cancun' },
  { lat: 32.53, lng: -117.02, country: 'Mexico', state: 'Tijuana' },
  // Caribbean
  { lat: 18.00, lng: -76.79, country: 'Jamaica', state: 'Kingston' },
  { lat: 18.49, lng: -69.93, country: 'Dominican Republic', state: 'Santo Domingo' },
  { lat: 18.47, lng: -66.11, country: 'Puerto Rico', state: 'San Juan' },
  { lat: 25.05, lng: -77.34, country: 'Bahamas', state: 'Nassau' },
  { lat: 18.54, lng: -72.34, country: 'Haiti', state: 'Port-au-Prince' },
  { lat: 23.11, lng: -82.37, country: 'Cuba', state: 'Havana' },
  { lat: 10.66, lng: -61.51, country: 'Trinidad', state: 'Port of Spain' },
];

// ── North America corridor sources ───────────────────────────────────────────
const NORTH_AMERICA_THREAT_SOURCES = [
  ...Array(4).fill({ country: 'Russia', state: 'Moscow', lat: 61.52, lng: 105.31 }),
  ...Array(3).fill({ country: 'Iran', state: 'Tehran', lat: 32.43, lng: 53.68 }),
  ...Array(2).fill({ country: 'North Korea', state: 'Pyongyang', lat: 40.33, lng: 127.51 }),
  ...Array(4).fill({ country: 'China', state: 'Beijing', lat: 35.86, lng: 104.19 }),
  ...Array(2).fill({ country: 'Brazil', state: 'São Paulo', lat: -14.23, lng: -51.92 }),
  { country: 'Nigeria', state: 'Lagos', lat: 9.08, lng: 8.67 },
  { country: 'Vietnam', state: 'Hanoi', lat: 14.05, lng: 108.27 },
  { country: 'Romania', state: 'Bucharest', lat: 45.94, lng: 24.96 },
];

// ── Russia corridor targets ─────────────────────────────────────────────────
const RUSSIA_TARGETS = [
  { lat: 55.76, lng: 37.62, country: 'Russia', state: 'Moscow' },
  { lat: 59.93, lng: 30.32, country: 'Russia', state: 'St. Petersburg' },
  { lat: 55.01, lng: 82.93, country: 'Russia', state: 'Novosibirsk' },
  { lat: 56.84, lng: 60.60, country: 'Russia', state: 'Yekaterinburg' },
];

// ── Russia corridor sources ─────────────────────────────────────────────────
const RUSSIA_THREAT_SOURCES = [
  ...Array(3).fill({ country: 'USA', state: 'VA', lat: 37.43, lng: -78.65 }),
  ...Array(2).fill({ country: 'UK', state: 'London', lat: 55.37, lng: -3.43 }),
  ...Array(2).fill({ country: 'Israel', state: 'Tel Aviv', lat: 31.04, lng: 34.85 }),
  ...Array(2).fill({ country: 'Ukraine', state: 'Kyiv', lat: 48.37, lng: 31.17 }),
  { country: 'China', state: 'Beijing', lat: 35.86, lng: 104.19 },
];

// ── EU corridor targets ──────────────────────────────────────────────────────
const EU_TARGETS = [
  { lat: 51.51, lng: -0.13, country: 'UK', state: 'London' },
  { lat: 48.86, lng: 2.35, country: 'France', state: 'Paris' },
  { lat: 52.52, lng: 13.41, country: 'Germany', state: 'Berlin' },
  { lat: 52.37, lng: 4.90, country: 'Netherlands', state: 'Amsterdam' },
  { lat: 50.85, lng: 4.35, country: 'Belgium', state: 'Brussels' },
  { lat: 40.42, lng: -3.70, country: 'Spain', state: 'Madrid' },
  { lat: 41.90, lng: 12.50, country: 'Italy', state: 'Rome' },
  { lat: 59.33, lng: 18.07, country: 'Sweden', state: 'Stockholm' },
];

// ── EU corridor sources (South America + Asia) ──────────────────────────────
const EU_THREAT_SOURCES = [
  ...Array(2).fill({ country: 'Brazil', state: 'São Paulo', lat: -14.23, lng: -51.92 }),
  { country: 'Argentina', state: 'Buenos Aires', lat: -34.60, lng: -58.38 },
  { country: 'Colombia', state: 'Bogota', lat: 4.71, lng: -74.07 },
  { country: 'Venezuela', state: 'Caracas', lat: 10.48, lng: -66.90 },
  ...Array(3).fill({ country: 'China', state: 'Beijing', lat: 35.86, lng: 104.19 }),
  ...Array(2).fill({ country: 'India', state: 'Mumbai', lat: 20.59, lng: 78.96 }),
  { country: 'Vietnam', state: 'Hanoi', lat: 14.05, lng: 108.27 },
  { country: 'Indonesia', state: 'Jakarta', lat: -0.78, lng: 113.92 },
  { country: 'Pakistan', state: 'Islamabad', lat: 30.37, lng: 69.34 },
];

// ── South/Southeast Asia corridor targets ───────────────────────────────────
const SEA_TARGETS = [
  { lat: 1.35, lng: 103.82, country: 'Singapore', state: 'Singapore' },
  { lat: 13.76, lng: 100.50, country: 'Thailand', state: 'Bangkok' },
  { lat: -6.21, lng: 106.85, country: 'Indonesia', state: 'Jakarta' },
  { lat: 14.60, lng: 120.98, country: 'Philippines', state: 'Manila' },
  { lat: 10.82, lng: 106.63, country: 'Vietnam', state: 'Ho Chi Minh City' },
  { lat: 21.03, lng: 105.85, country: 'Vietnam', state: 'Hanoi' },
  { lat: 3.14, lng: 101.69, country: 'Malaysia', state: 'Kuala Lumpur' },
  { lat: 11.56, lng: 104.92, country: 'Cambodia', state: 'Phnom Penh' },
  { lat: 16.87, lng: 96.20, country: 'Myanmar', state: 'Yangon' },
  { lat: 14.07, lng: 100.60, country: 'Thailand', state: 'Ayutthaya' },
  { lat: 7.88, lng: 98.39, country: 'Thailand', state: 'Phuket' },
  { lat: 10.31, lng: 123.89, country: 'Philippines', state: 'Cebu' },
  { lat: 7.07, lng: 125.61, country: 'Philippines', state: 'Davao' },
  { lat: -7.80, lng: 110.36, country: 'Indonesia', state: 'Yogyakarta' },
  { lat: -8.65, lng: 115.22, country: 'Indonesia', state: 'Bali' },
  { lat: 22.32, lng: 114.17, country: 'Hong Kong', state: 'Hong Kong' },
  { lat: 25.03, lng: 121.57, country: 'Taiwan', state: 'Taipei' },
  { lat: 37.57, lng: 126.98, country: 'South Korea', state: 'Seoul' },
];

// ── South/Southeast Asia corridor sources ───────────────────────────────────
const SEA_THREAT_SOURCES = [
  ...Array(4).fill({ country: 'China', state: 'Beijing', lat: 35.86, lng: 104.19 }),
  ...Array(3).fill({ country: 'Russia', state: 'Moscow', lat: 61.52, lng: 105.31 }),
  ...Array(2).fill({ country: 'North Korea', state: 'Pyongyang', lat: 40.33, lng: 127.51 }),
  ...Array(2).fill({ country: 'Iran', state: 'Tehran', lat: 32.43, lng: 53.68 }),
  { country: 'USA', state: 'VA', lat: 37.43, lng: -78.65 },
  { country: 'India', state: 'Mumbai', lat: 20.59, lng: 78.96 },
  { country: 'Pakistan', state: 'Islamabad', lat: 30.37, lng: 69.34 },
  { country: 'Nigeria', state: 'Lagos', lat: 9.08, lng: 8.67 },
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

// Generate a single threat for a specific corridor
function generateCorridorThreat(index: number, corridor: 'somalia' | 'global_south' | 'north_america' | 'eu' | 'russia' | 'sea', rand: () => number): LiveThreat {
  let source, target;
  if (corridor === 'somalia') {
    source = WEIGHTED_SOURCES[Math.floor(rand() * WEIGHTED_SOURCES.length)];
    target = SOMALIA_TARGETS[Math.floor(rand() * SOMALIA_TARGETS.length)];
  } else if (corridor === 'global_south') {
    source = WEIGHTED_SOURCES[Math.floor(rand() * WEIGHTED_SOURCES.length)];
    target = GLOBAL_SOUTH_TARGETS[Math.floor(rand() * GLOBAL_SOUTH_TARGETS.length)];
  } else if (corridor === 'north_america') {
    source = NORTH_AMERICA_THREAT_SOURCES[Math.floor(rand() * NORTH_AMERICA_THREAT_SOURCES.length)];
    target = NORTH_AMERICA_TARGETS[Math.floor(rand() * NORTH_AMERICA_TARGETS.length)];
  } else if (corridor === 'russia') {
    source = RUSSIA_THREAT_SOURCES[Math.floor(rand() * RUSSIA_THREAT_SOURCES.length)];
    target = RUSSIA_TARGETS[Math.floor(rand() * RUSSIA_TARGETS.length)];
  } else if (corridor === 'sea') {
    source = SEA_THREAT_SOURCES[Math.floor(rand() * SEA_THREAT_SOURCES.length)];
    target = SEA_TARGETS[Math.floor(rand() * SEA_TARGETS.length)];
  } else {
    source = EU_THREAT_SOURCES[Math.floor(rand() * EU_THREAT_SOURCES.length)];
    target = EU_TARGETS[Math.floor(rand() * EU_TARGETS.length)];
  }

  const attack_type = ATTACK_TYPES[Math.floor(rand() * ATTACK_TYPES.length)];
  const signatures = ATTACK_SIGNATURES[attack_type];
  const name = signatures[Math.floor(rand() * signatures.length)];
  return {
    id: `${DAY_STRING}-${index}-${corridor}`,
    name,
    source: { lat: source.lat, lng: source.lng, country: source.country, state: source.state },
    target: { lat: target.lat, lng: target.lng, country: target.country, state: target.state },
    attack_type,
    severity: SEVERITIES[Math.floor(rand() * SEVERITIES.length)],
    timestamp: Date.now(),
  };
}

// Generate a burst of 2-3 simultaneous attacks across different corridors
function generateBurst(index: number): LiveThreat[] {
  const rand = createSeededRand(DAY_SEED + index * 7919);
  const burstSize = rand() < 0.6 ? 3 : 2;

  const r1 = rand();
  const firstCorridor: 'somalia' | 'global_south' | 'russia' | 'sea' = r1 < 0.3 ? 'somalia' : r1 < 0.55 ? 'global_south' : r1 < 0.75 ? 'sea' : 'russia';
  const threats: LiveThreat[] = [
    generateCorridorThreat(index, firstCorridor, rand),
  ];

  if (burstSize === 3) {
    threats.push(generateCorridorThreat(index, 'north_america', rand));
    const r3 = rand();
    threats.push(generateCorridorThreat(index, r3 < 0.5 ? 'eu' : 'sea', rand));
  } else {
    const r2 = rand();
    const secondCorridor: 'north_america' | 'eu' | 'russia' | 'sea' = r2 < 0.3 ? 'north_america' : r2 < 0.55 ? 'eu' : r2 < 0.8 ? 'sea' : 'russia';
    threats.push(generateCorridorThreat(index, secondCorridor, rand));
  }

  return threats;
}

const RING_BUFFER_SIZE = 100;

const countRand = createSeededRand(DAY_SEED + 42);
const BASE_COUNT = Math.floor(80_000 + countRand() * 120_000);

const initialIndex = calculateCurrentIndex();
let sharedTodayCount = BASE_COUNT + initialIndex * 3;
let sharedThreatIndex = initialIndex;

const todayListeners = new Set<React.Dispatch<React.SetStateAction<number>>>();

function incrementSharedCountBy(n: number) {
  sharedTodayCount += n * 3;
  todayListeners.forEach(fn => fn(sharedTodayCount));
}

export function useLiveAttacks(enabled: boolean) {
  const [threats, setThreats] = useState<LiveThreat[]>([]);
  const [todayCount, setTodayCount] = useState(sharedTodayCount);
  const lastRealEventRef = useRef<number>(0);

  useEffect(() => {
    todayListeners.add(setTodayCount);
    return () => { todayListeners.delete(setTodayCount); };
  }, []);

  const addThreats = useCallback((batch: LiveThreat[]) => {
    setThreats(prev => [...batch, ...prev].slice(0, RING_BUFFER_SIZE));
    incrementSharedCountBy(batch.length);
  }, []);

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
          addThreats(generateBurst(sharedThreatIndex));
          sharedThreatIndex += 1;
        }
        timerRef.current = scheduleNext();
      }, delay);
    };

    const timerRef = { current: scheduleNext() };
    return () => clearTimeout(timerRef.current);
  }, [enabled, addThreats]);

  return { threats, todayCount };
}
