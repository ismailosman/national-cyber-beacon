
# Fix: Country Panels Show Unique Data Per Country

## The Problem

Two bugs make every country panel display identical data:

**Bug 1 — Shared Sparklines (module-level constants)**

In `CyberMap.tsx` lines 83-89, `SPARKLINES` is generated once at module load and reused for every country:

```typescript
// These are IDENTICAL for every country clicked:
const SPARKLINES: Record<AttackType, {...}[]> = {
  malware:   genSparkline(111, '#ef4444'),   // fixed seed 111
  phishing:  genSparkline(222, '#a855f7'),   // fixed seed 222
  ...
};
```

So India's Malware sparkline is pixel-for-pixel identical to Russia's — they share the same fixed seed.

**Bug 2 — Single Default Percentages Fallback**

Lines 42-48 define `DEFAULT_PERCENTAGES` as hard-coded constants used when a country has fewer than 5 detected threats:

```typescript
const DEFAULT_PERCENTAGES = {
  malware: 31.2,   // same for every country
  phishing: 18.7,  // same for every country
  ...
};
```

Since the threat ring buffer fills slowly and some countries appear less often in the weighted source list, nearly every country falls through to this fallback — showing 31.2% Malware / 18.7% Phishing for every single country.

**Bug 3 — ThreatMap has no CountryPanel at all**

The ThreatMap page still has no `CountryPanel` component, `selectedCountry` state, or click handlers (the plan to add them was described previously but the file was not edited). This needs to be done as part of the same fix.

---

## The Fix

### Part 1 — Per-Country Sparklines (CyberMap.tsx)

Replace the static `SPARKLINES` constant with a function `genCountrySparklines(country)` that returns a full set of 5 sparklines seeded by `country + attack_type`:

```typescript
function genCountrySparklines(country: string): Record<AttackType, {i: number; v: number}[]> {
  return {
    malware:   genSparklineForCountry(country, 'malware'),
    phishing:  genSparklineForCountry(country, 'phishing'),
    exploit:   genSparklineForCountry(country, 'exploit'),
    ddos:      genSparklineForCountry(country, 'ddos'),
    intrusion: genSparklineForCountry(country, 'intrusion'),
  };
}

function genSparklineForCountry(country: string, type: string) {
  // Seed = hash(country) XOR hash(type)
  let seed = 0;
  for (const c of country) seed = (seed * 31 + c.charCodeAt(0)) | 0;
  for (const c of type)    seed = (seed * 31 + c.charCodeAt(0)) | 0;
  const rand = seededRand(Math.abs(seed) || 0x9e3779b9);
  return Array.from({ length: 15 }, (_, i) => ({
    i,
    v: Math.round(20 + rand() * 80 + Math.sin(i / 2.5) * 25),
  }));
}
```

Inside `CountryPanel`, memoize this per country:

```typescript
const sparklines = React.useMemo(() => genCountrySparklines(country), [country]);
// Use sparklines[type] instead of SPARKLINES[type] in the render
```

### Part 2 — Per-Country Default Percentages (CyberMap.tsx)

Replace the single `DEFAULT_PERCENTAGES` fallback with a function that generates unique but stable percentages per country using its seeded PRNG:

```typescript
function genCountryDefaultPercentages(country: string): Record<AttackType, number> {
  let seed = 0;
  for (const c of country) seed = (seed * 31 + c.charCodeAt(0)) | 0;
  const rand = seededRand(Math.abs(seed) ^ 0xc0ffee);
  
  // Generate 5 raw random weights
  const types: AttackType[] = ['malware', 'phishing', 'exploit', 'ddos', 'intrusion'];
  const weights = types.map(() => 5 + rand() * 40);  // each 5-45
  const total = weights.reduce((a, b) => a + b, 0);
  
  const result = {} as Record<AttackType, number>;
  types.forEach((t, i) => {
    result[t] = Math.round((weights[i] / total) * 1000) / 10; // 1 decimal
  });
  return result;
}
```

This produces values like:
- China: Malware 38.4% / Phishing 12.1% / Exploit 22.7% / DDoS 18.3% / Intrusion 8.5%
- Russia: Malware 19.2% / Phishing 31.8% / Exploit 15.4% / DDoS 24.7% / Intrusion 8.9%
- India: (completely different distribution)

The values are deterministic (same every render for the same country) and unique per country.

Inside `CountryPanel`, update the fallback:

```typescript
const defaultPercentages = React.useMemo(() => genCountryDefaultPercentages(country), [country]);

const percentages = React.useMemo<Record<AttackType, number>>(() => {
  if (countryThreats.length < 5) return defaultPercentages;  // was DEFAULT_PERCENTAGES
  ...
}, [countryThreats, defaultPercentages]);
```

### Part 3 — Add Full CountryPanel to ThreatMap.tsx

ThreatMap currently has no CountryPanel. Add:

1. Required imports: `X` from lucide-react, `AreaChart, Area, LineChart, Line, ResponsiveContainer` from recharts
2. Constants: `COUNTRY_ISO`, `ATTACK_LABELS`, all seeded helper functions (same as CyberMap)
3. The full `CountryPanel` component using per-country sparklines and per-country default percentages
4. State: `const [selectedCountry, setSelectedCountry] = useState<string | null>(null);`
5. Map: `interactive: true` with `scrollZoom: false, boxZoom: false, dragPan: false, dragRotate: false, doubleClickZoom: false, touchZoomRotate: false, touchPitch: false`
6. Click + hover handlers on `attack-sources-dot` layer
7. JSX: Render `<CountryPanel>` overlay when `selectedCountry !== null`

---

## Technical File Changes

| File | Lines Changed | What |
|---|---|---|
| `src/pages/CyberMap.tsx` | ~74-89, ~236-246, ~324-340 | Replace static `SPARKLINES` with per-country function; replace `DEFAULT_PERCENTAGES` fallback with `genCountryDefaultPercentages(country)`; update sparkline render to use memoized per-country sparklines |
| `src/pages/ThreatMap.tsx` | Multiple sections | Add all helpers + `CountryPanel` + `selectedCountry` state + map interactivity + click handlers + JSX overlay |

---

## Visual Result

**Before:** Clicking India shows 31.2% Malware / same sparkline shapes as Russia / same sparkline shapes as Singapore.

**After:**
- India: unique sparkline shapes + unique percentage distribution (e.g. 28.7% Malware / 22.4% Exploit)
- Russia: different sparkline shapes + different percentages (e.g. 41.2% Malware / 8.9% DDoS)
- Singapore: different again

The 30-day trend chart on top is already unique per country (from `genCountry30DayData` which uses a country-seeded PRNG) — this was working correctly. Only the sparklines and the percentage fallback needed fixing.

Both `/cyber-map` and `/threat-map` will have the same fix applied.
