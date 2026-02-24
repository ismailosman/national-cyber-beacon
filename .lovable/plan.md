

## Set Application Timezone to US Eastern Time (New York)

### Overview
Create a centralized timezone utility so all dates and times displayed throughout the application use the "America/New_York" timezone consistently, rather than the user's local browser timezone.

### Changes

**1. Create timezone utility (`src/lib/dateUtils.ts`)**
- Export a constant `APP_TIMEZONE = 'America/New_York'`
- Create helper functions that wrap common date operations with the Eastern timezone:
  - `formatET(date, formatStr)` -- formats a date using `date-fns` `format()` but shifts the date to ET first using `Intl.DateTimeFormat` with `timeZone`
  - `toETLocaleString(date)` -- replacement for `new Date().toLocaleString()` with ET timezone
  - `toETLocaleTimeString(date, options?)` -- replacement for `toLocaleTimeString()`
  - `toETLocaleDateString(date, options?)` -- replacement for `toLocaleDateString()`
  - `formatDistanceET(date)` -- wraps `formatDistanceToNow` (relative times like "5 minutes ago" are timezone-agnostic, so this just re-exports)
  - `nowET()` -- returns current time formatted in ET for display

The approach uses the browser's built-in `Intl.DateTimeFormat` with `timeZone: 'America/New_York'` for `toLocale*` calls, and a manual offset conversion for `date-fns` `format()` calls.

**2. Update all pages and components that display dates**

Replace raw `new Date().toLocaleString()`, `.toLocaleDateString()`, `.toLocaleTimeString()` and `date-fns` `format()` calls with the new ET-aware helpers. Files to update:

- `src/pages/DdosMonitor.tsx` -- sparkline time labels
- `src/pages/DastScanner.tsx` -- scan dates, last scan display
- `src/pages/UptimeMonitor.tsx` -- last checked times, SSL expiry
- `src/pages/EarlyWarning.tsx` -- last checked time
- `src/pages/Incidents.tsx` -- incident timestamps
- `src/pages/Reports.tsx` -- report dates
- `src/pages/AlertDetail.tsx` -- alert timestamps
- `src/pages/OrgDetail.tsx` -- scan history dates
- `src/pages/Dashboard.tsx` -- dashboard dates
- `src/pages/SecurityMonitor.tsx` -- chart dates
- `src/pages/CertAdvisories.tsx` -- advisory dates
- `src/components/scanner/ScanResults.tsx` -- scan start time
- `src/components/scanner/ScanHistory.tsx` -- scan history timestamps
- `src/components/dashboard/OrgCard.tsx` -- org card dates
- `src/components/dashboard/DastCoverageSummary.tsx` -- coverage dates
- `src/components/dashboard/AlertSidebar.tsx` -- alert timestamps

**3. Edge functions (no change needed)**
Edge functions generate ISO timestamps (`new Date().toISOString()`) which are UTC -- this is correct. The timezone conversion happens only on the frontend display layer.

### Technical Approach

```text
// src/lib/dateUtils.ts

export const APP_TIMEZONE = 'America/New_York';

// For toLocaleString/toLocaleDateString/toLocaleTimeString replacements:
// Simply pass { timeZone: APP_TIMEZONE } in the options

export function toETLocaleString(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleString('en-US', { timeZone: APP_TIMEZONE, ...options });
}

export function toETLocaleDateString(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleDateString('en-US', { timeZone: APP_TIMEZONE, ...options });
}

export function toETLocaleTimeString(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleTimeString('en-US', { timeZone: APP_TIMEZONE, ...options });
}

// For date-fns format(): convert the date to ET-adjusted Date object
export function formatET(date: string | Date, formatStr: string) {
  // Use Intl to get the ET offset, then adjust the Date
  const d = new Date(date);
  const etStr = d.toLocaleString('en-US', { timeZone: APP_TIMEZONE });
  const etDate = new Date(etStr);
  return format(etDate, formatStr);
}
```

### Files Modified
- `src/lib/dateUtils.ts` -- **new** centralized timezone utility
- ~16 page/component files -- replace raw date formatting with ET-aware helpers

### Notes
- `formatDistanceToNow` (relative time like "3 minutes ago") is timezone-agnostic, so those calls need no change
- All `new Date().toISOString()` calls for data storage remain unchanged (UTC is correct for storage)
- Only display-layer formatting is affected
- No new dependencies needed -- uses built-in `Intl.DateTimeFormat` API

