
# Four Changes: Alert Detail Page, Map Popup Navigation, Org Coordinates, Landing Page, Sign-Up Removal

## Overview

1. **`/alerts/:id` detail page** — full single-alert view with acknowledge/close actions
2. **Update ThreatMap popup** — "View" button navigates to `/alerts/:id`
3. **Seed 12 missing org coordinates** — data update via the insert tool
4. **Public landing page** — read-only view at `/` accessible without login
5. **Remove sign-up from login** — sign-in only

---

## 1. Alert Detail Page — `src/pages/AlertDetail.tsx` (NEW)

### Route
`/alerts/:id` — added to both the protected routes (in `AppLayout`) so logged-in users see the full detail, and accessible from the threat map popup.

### Layout
```text
← Back to Alerts           [Acknowledge] [Close Alert]
────────────────────────────────────────────────────
CRITICAL  open            SSL Certificate Expired
                          Hormuud Telecom · Banaadir · Telecom

Description:
  The SSL certificate for the main portal expired 3 days ago...

  Organization:   Hormuud Telecom
  Source:         scanner
  Created:        Feb 19, 2026, 14:32 UTC (3 hours ago)
  Status:         open → history of changes (if closed/ack)
```

### Data Fetching
```ts
// Single alert with org join
const { data: alert } = useQuery({
  queryKey: ['alert', id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('alerts')
      .select('*, organizations(id, name, region, sector, lat, lng, contact_email, domain)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }
});
```

### Action Buttons
- **Acknowledge** (visible if `status === 'open'`, SuperAdmin + Analyst only): `UPDATE alerts SET status='ack', is_read=true WHERE id=...`
- **Close** (visible if `status !== 'closed'`, SuperAdmin + Analyst only): `UPDATE alerts SET status='closed' WHERE id=...`
- On success: toast + invalidate `['alerts']` + `['alert', id]` queries

### Fields Displayed
| Field | Value |
|---|---|
| Severity | Colored badge (critical/high/medium/low) |
| Status | Colored pill (open/ack/closed) |
| Title | Large heading |
| Description | Full text (or "No description provided") |
| Organization | Name + link to `/organizations/:id` |
| Region | From org |
| Sector | From org |
| Source | e.g. "scanner", "manual" |
| Created | Full date + relative time |

### Error / Loading States
- Loading: skeleton card
- 404: "Alert not found" with back button

---

## 2. Update ThreatMap Popup — `src/pages/ThreatMap.tsx`

The current popup (click on unclustered dot) shows no navigation. We add a "View Details →" button that uses `react-router-dom`'s `useNavigate`.

Since Mapbox popup HTML is a string, we use a **delegated click handler** on the map container:

```ts
// Add a data-alert-id attribute to the button in the popup HTML
const html = `
  <div style="${POPUP_STYLE}">
    ...existing content...
    <button 
      data-alert-id="${p.id}"
      style="margin-top:8px;width:100%;padding:5px 0;background:#00e5ff18;
             border:1px solid #00e5ff40;border-radius:5px;color:#00e5ff;
             font-size:11px;font-weight:600;cursor:pointer;font-family:monospace;"
    >View Details →</button>
  </div>`;
```

Then a single delegated listener on the map container `div`:
```ts
mapContainer.current.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('[data-alert-id]');
  if (btn) {
    const alertId = btn.getAttribute('data-alert-id');
    navigate(`/alerts/${alertId}`);
  }
});
```

This avoids re-running Mapbox event setup and works cleanly with React Router's `navigate`.

---

## 3. Seed Missing Org Coordinates — Data Update

12 organizations in Banaadir currently have `lat IS NULL`. All are government ministries located in/around Mogadishu. We assign unique, slightly offset coordinates around Villa Somalia and the government district (Hamarweyne / Shangani areas).

| Organization | lat | lng |
|---|---|---|
| Villa Somalia | 2.0674 | 45.3245 |
| Ministry of Commerce & Industry | 2.0620 | 45.3310 |
| Ministry of Communications & Technology | 2.0598 | 45.3289 |
| Ministry of Environment & Climate Change | 2.0555 | 45.3257 |
| Ministry of Fishery and Blue Economy | 2.0510 | 45.3222 |
| Ministry of Foreign Affairs | 2.0480 | 45.3198 |
| Ministry of Interior | 2.0645 | 45.3335 |
| Ministry of Justice & Constitutional Affairs | 2.0412 | 45.3175 |
| Ministry of Labor | 2.0375 | 45.3148 |
| Ministry of Planning | 2.0438 | 45.3266 |
| National Communications Authority | 2.0561 | 45.3415 |
| Immigration and Custom Authority | 2.0500 | 45.3450 |

These are real geographic coordinates within central Mogadishu, spread enough to be distinguishable at zoom level 12.

**Method:** Use the Lovable Cloud insert tool with `UPDATE` statements for each org by its UUID.

---

## 4. Public Landing Page — `src/pages/Landing.tsx` (NEW)

### Route
`/` — **public**, no authentication required. When a logged-in user visits `/`, they still see the Dashboard (the ProtectedRoutes component handles this). The landing page is rendered at `/` only when **not logged in**.

**Routing logic change in `App.tsx`:**
```tsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/" element={<PublicOrDashboard />} />  {/* Smart route */}
  <Route path="/*" element={<ProtectedRoutes />} />
</Routes>
```

Where `PublicOrDashboard` checks auth:
```tsx
const PublicOrDashboard = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (user) return <Navigate to="/dashboard-home" replace />; // or render dashboard directly
  return <Landing />;
};
```

Actually simpler: keep `/` as the dashboard for logged-in users and use `/public` for the landing. Then the landing links to `/login`. The `ProtectedRoutes` wrapper already redirects to `/login` when not authenticated — so the landing page should be at a **separate public route**, not `/`.

**Better approach:**
- Landing page lives at `/` — always public
- Logged-in users who go to `/` see the landing with a "Go to Dashboard" button
- The protected dashboard moves to — no, that breaks the existing sidebar links.

**Cleanest approach:** The landing page is served at `/` for unauthenticated users. When authenticated users visit `/`, they're shown the Dashboard (existing behavior). We wrap the `/` route:

```tsx
// In App.tsx routes (outside ProtectedRoutes):
<Route path="/" element={<RootRoute />} />
// RootRoute:
const RootRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/-/dashboard" replace /> : <Landing />;
};
// ProtectedRoutes serves /-/dashboard and all other protected routes
```

This is over-engineered. The simplest solution that fits the current structure:

**Final approach:**
- Landing page at route `/landing` — linked from the login page ("View Public Dashboard →")
- The landing page fetches data using an **anonymous Supabase client call** (no auth required if we make a public RLS policy for the landing)

Wait — current RLS on `alerts` requires `has_role(auth.uid(), ...)`. Anonymous users will get 0 rows. We need either:
1. A public-facing Edge Function that returns summary stats (no sensitive details)
2. Or add a public SELECT policy on a summary view

**Best approach for a public landing:**
- The landing page calls a **new edge function** `public-stats` that uses the service role key to aggregate: total open alerts by severity, org count, recent critical count — **no PII, no alert titles or org names**
- The map on the landing shows **only severity-colored dots at region centroids** (no specific org/title data), using hardcoded Somali region coordinates
- The landing is read-only, fully public, no auth required

### Landing Page Content
```text
┌─────────────────────────────────────────────────────────────────┐
│  [Logo]  Somalia National Cyber Observatory        [Sign In →]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LIVE THREAT OVERVIEW  ●  Updated 2 min ago                     │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Critical │  │   High   │  │  Medium  │  │   Low    │       │
│  │    12    │  │    8     │  │    23    │  │    5     │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│  [Mini Mapbox map showing dots at region centroids]             │
│   — Interactive, dark style, zoom/pan enabled                   │
│   — Dots colored by dominant severity per region                │
│   — No popups with sensitive detail, just region name + count   │
│                                                                 │
│  [Sign In to Access Full Platform →]                           │
└─────────────────────────────────────────────────────────────────┘
```

### Edge Function: `public-stats`
```ts
// supabase/functions/public-stats/index.ts
// Uses service role to return:
// - counts by severity (critical, high, medium, low)
// - count by region (for heatmap dots)
// - total orgs monitored
// Returns NO titles, NO org names, NO descriptions
```

RLS note: Since the edge function runs with service role, we don't need to change any RLS policies. The landing page data is aggregated and anonymized.

---

## 5. Remove Sign-Up from Login Page — `src/pages/Login.tsx`

Changes:
- Remove the `mode` state (`signin | signup`)
- Remove the tab switcher (`Sign In | Sign Up` pills)
- Remove the `signUp` import and call
- Remove the `success` state
- Keep only the sign-in form
- Remove the `signUp` reference from `useAuth` destructuring (the function still exists in context, just unused on this page)

The login page becomes a clean, minimal sign-in only form.

---

## Route Updates — `src/App.tsx`

```tsx
// New imports
import AlertDetail from "@/pages/AlertDetail";
import Landing from "@/pages/Landing";

// Public routes (outside ProtectedRoutes):
<Route path="/login" element={<Login />} />
<Route path="/public" element={<Landing />} />  // public landing

// Protected routes (inside AppLayout):
<Route path="/alerts" element={<AlertsPage />} />
<Route path="/alerts/:id" element={<AlertDetail />} />  // NEW
```

---

## Files to Create / Edit

| File | Action |
|---|---|
| `src/pages/AlertDetail.tsx` | CREATE — single alert detail page |
| `src/pages/Landing.tsx` | CREATE — public read-only landing page |
| `supabase/functions/public-stats/index.ts` | CREATE — public aggregated stats edge function |
| `src/pages/ThreatMap.tsx` | EDIT — add "View Details →" button to popup + delegated nav |
| `src/pages/Login.tsx` | EDIT — remove sign-up tab and form |
| `src/App.tsx` | EDIT — add `/alerts/:id` and `/public` routes |

### Database
Use the insert tool to `UPDATE` the 12 organizations missing lat/lng with precise Mogadishu coordinates.

No schema migrations required — `lat` and `lng` columns already exist and are nullable.
