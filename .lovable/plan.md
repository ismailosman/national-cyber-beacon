

## Add Ransomware Country/Keyword Search

### Overview
Add a search section between the stat cards and the Recent Victims list in the Ransomware Feed tab (both desktop and mobile). It calls `/ransomware/country/{CC}` or `/ransomware/search/{keyword}` via the existing `api-proxy`.

### Changes

**File: `src/pages/ThreatMapStandalone.tsx`**

1. **Add state variables** (near existing state declarations):
   - `ransomwareSearchMode: 'country' | 'keyword'`
   - `ransomwareCountry: string` (ISO2 code, default `''`)
   - `ransomwareKeyword: string`
   - `ransomwareSearchResults: { victims: RansomwareVictim[], total: number, country?: string, message?: string } | null`
   - `ransomwareSearchLoading: boolean`

2. **Add search function** that calls the proxy:
   - Country mode: `GET /ransomware/country/{CC}`
   - Keyword mode: `GET /ransomware/search/{keyword}`
   - Uses `fetch(PROXY_BASE + '?path=...')` with the supabase anon key header

3. **Insert search UI between stat cards (line 362) and the 3-column grid (line 364)** on desktop:
   - Mode toggle: Country / Keyword tabs
   - Country mode: dropdown `<select>` with the 18 specified countries + custom text input for other ISO2 codes, plus a pinned "Check Somalia" button
   - Keyword mode: text input
   - Search button triggers the fetch
   - Results panel below: victim cards with group (red), flag, org name, sector, date, domain, description (120 chars)
   - Zero results: green message "No ransomware victims recorded for [Country]"
   - Somalia special note when SO is searched

4. **Insert simplified search UI in mobile tab** (line 965, after stat cards):
   - Same functionality, compact layout

5. **Country list constant**:
```
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
```

### No backend changes needed
The `api-proxy` already forwards all paths unrestricted.

