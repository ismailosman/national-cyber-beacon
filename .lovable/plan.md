

## Add Prominent Per-Site Scan Button to DDoS Monitor

### What's Changing
Make the per-site scan button more visible and prominent in the DDoS Monitor table. Currently there's a small "Re-check" button in the Actions column that may be hard to spot. We'll make it stand out better.

### Changes

**File: `src/pages/DdosMonitor.tsx`**

1. Rename the "Re-check" button to "Scan" with a play/scan icon for better visibility
2. Style the button with a more prominent color (green/cyan accent) so it stands out from the table
3. For rows with no scan results yet, show a primary-colored "Scan" button instead of "Re-check" to indicate first-time scanning
4. On mobile cards, add a visible "Scan" button as well (the `MobileCard` component)

The existing `recheckSingle()` function already handles single-site scanning via the `/ddos/scan/single` API endpoint, so no backend changes are needed -- just UI improvements to make the button more discoverable.

