
# Two Enhancements to `/cyber-map`

## 1. Somalia Flag in the Panel Header

The reference image shows a flag icon next to "Somalia" in the panel header. Currently the code uses the `🇸🇴` emoji which may not render consistently. The fix is to replace the emoji in the `SomaliaPanel` header with an actual `<img>` tag sourcing the Somalia flag from a public flag CDN (e.g., `flagcdn.com`) — a reliable, lightweight approach with no dependencies needed.

```tsx
// Before (line 118):
<span className="text-xl">🇸🇴</span>

// After:
<img
  src="https://flagcdn.com/w40/so.png"
  alt="Somalia flag"
  className="w-6 h-4 object-cover rounded-sm"
/>
```

The panel title already says "Somalia" next to it, matching the reference image exactly.

---

## 2. Clickable Source Country Dots → Attacker Panel

### What the User Wants
Just like clicking Somalia opens the attack stats panel, clicking on a **source country dot** (China, Russia, Iran, etc.) should open a panel showing attack info specific to that country — same layout, but framed from the attacker's perspective.

### Implementation Plan

**Step 1 — Enable map interactivity on source dots**

Currently the map is `interactive: false`. To allow dot clicks, we need to either:
- Set `interactive: true` and re-lock the viewport manually (disable drag/zoom), OR
- Use `interactive: false` but add a click handler via a transparent overlay div that maps pixel → lng/lat and checks against source dot positions

The cleanest approach is **`interactive: true`** with pan/zoom disabled:

```typescript
const map = new mapboxgl.Map({
  ...
  interactive: true,       // enable click events
  scrollZoom: false,
  boxZoom: false,
  dragPan: false,
  dragRotate: false,
  doubleClickZoom: false,
  touchZoomRotate: false,
  touchPitch: false,
});
```

**Step 2 — Click handler on `attack-sources-dot` layer**

```typescript
map.on('click', 'attack-sources-dot', (e: any) => {
  const props = e.features?.[0]?.properties;
  if (!props) return;
  // Find all active threats from this country
  const country = props.country;
  setSelectedCountry(country);
  setSomaliaPanel(false); // close Somalia panel if open
});

// Cursor change on hover
map.on('mouseenter', 'attack-sources-dot', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'attack-sources-dot', () => {
  map.getCanvas().style.cursor = '';
});
```

**Step 3 — Existing Somalia click handler**

Update the existing bounding box click to use a proper layer click instead:

```typescript
map.on('click', (e: any) => {
  const { lat, lng } = e.lngLat;
  if (lat >= 0 && lat <= 12 && lng >= 41 && lng <= 51) {
    setSelectedCountry(null);  // clear source country panel
    setSomaliaPanel(true);
  }
});
```

**Step 4 — New state + `CountryPanel` component**

Add state:
```typescript
const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
```

Create a new `CountryPanel` component (similar to `SomaliaPanel`) that:
- Shows the attacker country flag image (from `flagcdn.com` using the ISO code)
- Shows the country name + "Source of Attacks" subtitle
- Shows an "ATTACK VOLUME" trend chart (same TREND_30 seeded data, different seed per country)
- Shows "ATTACK TYPES FROM THIS COUNTRY" — a breakdown of attack types used by this country (from the live threats feed filtered to `source.country === selectedCountry`)
- Has a close button that sets `selectedCountry(null)`

**Country ISO code mapping** — a simple lookup object mapping country names to ISO 2-letter codes for `flagcdn.com`:

```typescript
const COUNTRY_ISO: Record<string, string> = {
  'China': 'cn', 'Russia': 'ru', 'Iran': 'ir', 'North Korea': 'kp',
  'USA': 'us', 'Netherlands': 'nl', 'Germany': 'de', 'Ukraine': 'ua',
  'Brazil': 'br', 'India': 'in', 'Nigeria': 'ng', 'Pakistan': 'pk',
  'Vietnam': 'vn', 'Romania': 'ro', 'Turkey': 'tr', 'South Korea': 'kr',
  'Indonesia': 'id', 'France': 'fr', 'UK': 'gb', 'Saudi Arabia': 'sa',
  'Egypt': 'eg', 'Singapore': 'sg', 'Canada': 'ca', 'Japan': 'jp',
  'Israel': 'il',
};
```

**CountryPanel layout** (same visual style as SomaliaPanel, pink border, dark background):
```
┌─────────────────────────────────────┐
│ [flag] China                    [×] │
│ ─────────────────────────────────── │
│ ATTACK VOLUME                       │
│ Last 30 days                        │
│ [area chart — seeded by country]    │
│ ─────────────────────────────────── │
│ ATTACK TYPES                        │
│ Live from this source               │
│ Malware     ~~~~~    31.2%          │
│ Phishing    ~~~~~    18.7%          │
│ Exploit     ~~~~~    14.3%          │
│ DDoS        ~~~~~     9.8%          │
│ Intrusion   ~~~~~     5.1%          │
└─────────────────────────────────────┘
```

The percentages are computed from `threats.filter(t => t.source.country === selectedCountry)` — live-updating as new threats arrive.

**Step 5 — Positioning**

- `SomaliaPanel` — stays at top-right (right: 16, top: 80)
- `CountryPanel` — shows at top-right as well, replacing the Somalia panel (they cannot both be open at once). Use the same `absolute z-30` positioning.

Both panels can appear simultaneously only if the user wants — but simpler UX is to only show one at a time. When clicking a source dot, close Somalia panel; when clicking Somalia, close country panel.

**Step 6 — Update the hint text**

Change the existing hint from "Click Somalia for attack stats" to "🌐 Click Somalia or any attack source for stats".

---

## Files Changed

| File | Changes |
|---|---|
| `src/pages/CyberMap.tsx` | 1) Replace `🇸🇴` emoji with `<img>` flag in SomaliaPanel; 2) Add `COUNTRY_ISO` map; 3) Add `CountryPanel` component; 4) Add `selectedCountry` state; 5) Change map `interactive` to `true` with pan/zoom disabled; 6) Add `click` handler on `attack-sources-dot` layer; 7) Add hover cursor on source dots; 8) Update map click handler to clear country panel when Somalia clicked; 9) Render `CountryPanel` in JSX; 10) Update hint text |

## Visual Result

- The Somalia panel header now shows the actual Somalia flag image (blue with star, from flagcdn.com)
- Clicking any glowing source dot (China, Russia, etc.) opens a dark panel showing that country's flag, attack volume trend, and live attack type breakdown
- Only one panel is open at a time — clicking Somalia closes the country panel and vice versa
- The map cursor changes to a pointer when hovering source dots, giving a clear "clickable" affordance
- The existing Somalia bounding-box click still works exactly as before
