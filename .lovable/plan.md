
# Two New Features: Add Alert to Organization + Threat Map

## Feature 1 — Add Alert to Any Organization

### Where the button appears
- **OrgDetail page** (`src/pages/OrgDetail.tsx`): Add a "Create Alert" button in the header actions row, visible to SuperAdmin and Analyst roles. Opens a `Dialog` modal.
- **Alerts page** (`src/pages/Alerts.tsx`): Add a "+ New Alert" button in the top-right header, also visible to SuperAdmin and Analyst. Same modal with an extra organization dropdown.

### Modal form fields (both locations)
| Field | Type | Required |
|---|---|---|
| Title | text input | Yes |
| Description | textarea | No |
| Severity | select: critical / high / medium / low | Yes |
| Source | text (default: "manual") | No |
| Organization | select (list of all orgs) | Yes (only on Alerts page — pre-filled on OrgDetail) |

### DB operation
```ts
await supabase.from('alerts').insert({
  title, description, severity, source: 'manual',
  organization_id, status: 'open', is_read: false
});
```
RLS already allows SuperAdmin `ALL` and Analyst `ALL` on the `alerts` table — no migration needed.

---

## Feature 2 — Threat Map Page

### Overview
A new `/threat-map` route showing an interactive map of Somalia with:
- **Organization markers** — color-coded dots by status (green = Secure, amber = Warning, red = Critical)
- **Threat event heatmap** — semi-transparent circles at lat/lng coordinates from the `threat_events` table

### Tech approach
Since `mapbox-gl` is not currently installed, there are two options:

**Option A (Mapbox):** Install `mapbox-gl` + `react-map-gl`, fetch the public token from a lightweight edge function that returns `MAPBOX_PUBLIC_TOKEN` to authenticated users.

**Option B (No extra install):** Use `react-simple-maps` or an SVG-based Somalia map with organization pin overlays — works entirely with existing packages.

Given we already have `MAPBOX_PUBLIC_TOKEN` stored as a secret, **Option A** is the right choice for a production-quality map. The plan:

1. Install packages: `mapbox-gl` and `react-map-gl` 
2. Create edge function `get-map-token` that returns the public token to authenticated users
3. Create `src/pages/ThreatMap.tsx` with:
   - Map centered on Somalia (lng: 46, lat: 5.5, zoom: 5)
   - Organization markers (dots) loaded from `organizations` table, color-coded by status
   - Threat event circles from `threat_events` table
   - Sidebar panel showing active threat count and org status breakdown
4. Add `/threat-map` route in `src/App.tsx`
5. Add "Threat Map" nav item in `src/components/layout/Sidebar.tsx` (using `Map` icon from lucide-react)

### Edge function: `get-map-token`
```ts
// supabase/functions/get-map-token/index.ts
// Returns MAPBOX_PUBLIC_TOKEN to authenticated requests only
```

### Map page layout
```
┌────────────────────────────────────────────────────┐
│  Threat Map header (org count, threat count)       │
├──────────────────────────────┬─────────────────────┤
│                              │ Side panel:         │
│   Mapbox map of Somalia      │ - Secure orgs: N    │
│   with org markers +         │ - Warning orgs: N   │
│   threat event circles       │ - Critical orgs: N  │
│                              │ - Recent threats    │
└──────────────────────────────┴─────────────────────┘
```

Organizations without lat/lng coordinates will be given default coordinates based on their region (Banaadir → 2.05, 45.34 / Puntland → 8.4, 49.0 / Somaliland → 9.56, 44.06).

---

## Files to Change

| File | Change |
|---|---|
| `src/pages/OrgDetail.tsx` | Add "Create Alert" button + Dialog |
| `src/pages/Alerts.tsx` | Add "+ New Alert" button + Dialog with org select |
| `src/App.tsx` | Add `/threat-map` route |
| `src/components/layout/Sidebar.tsx` | Add "Threat Map" nav item |
| `src/pages/ThreatMap.tsx` | New file — full map page |
| `supabase/functions/get-map-token/index.ts` | New edge function — returns public token |
| `package.json` | Add `mapbox-gl` and `react-map-gl` |

No database migrations required. All alert inserts are covered by existing RLS. The map reads `organizations` and `threat_events` — both already have RLS policies for all roles.
