

## Three Changes to Threat Map

### 1. Add live attack count badges next to each country

Compute per-country attack counts from the `threats` array using `useMemo`. Display a small colored badge (pill) next to each country name showing the count of attacks targeting that country.

**In `src/pages/ThreatMapStandalone.tsx`:**
- Add a `useMemo` that builds a `Record<string, number>` of `target.country` counts from `threats`
- In both the desktop right panel country list and the mobile bottom panel country list, add a badge after the country name:
  ```
  <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-full"
    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
    {countMap[name] || 0}
  </span>
  ```

### 2. Make Top Targeted Countries visible on mobile/tablet

The mobile bottom panel currently exists but is collapsed by default (`mobileStatsOpen` starts as `false`). Change the initial state to `true` so mobile and tablet users see the countries immediately without needing to tap.

**Change:** `const [mobileStatsOpen, setMobileStatsOpen] = useState(true);`

### 3. Remove the PAUSE/RESUME button

Delete the pause/resume button from the header entirely and remove the `liveOn` state (hardcode it to always be `true`).

**Changes:**
- Remove `const [liveOn, setLiveOn] = useState(true)` -- replace with `const liveOn = true`
- Remove the `<button>` block (lines 105-116) for PAUSE/RESUME from the header
- Remove `Pause` and `Play` from the lucide-react import

### File modified
- `src/pages/ThreatMapStandalone.tsx`

