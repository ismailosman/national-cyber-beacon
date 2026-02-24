

## Fix: Email Notifications Not Sending

### Root Cause

Two bugs prevent emails from being delivered:

**Bug 1 -- Stale Closure (Primary):** In `SecurityDashboard.tsx`, `handleStartScan` calls `setClientEmail(email)` then immediately creates a polling callback that reads `clientEmail`. Since React state updates are asynchronous, the callback captures the **previous** value (`undefined`), not the newly set one. The `email` and `name` parameters from the function arguments must be used directly inside the callback instead.

**Bug 2 -- No Resilience to Page Reloads:** If the user navigates away or the page reloads during a long-running scan, the polling loop dies and the "done" callback never fires. No email is ever sent.

### Changes

**1. `src/components/scanner/SecurityDashboard.tsx`**
- In the polling callback (lines 46-62), replace references to `clientEmail` and `clientName` state variables with the `email` and `name` function parameters passed directly to `handleStartScan` -- these are stable values, not stale closures
- Add a `useEffect` that watches `activeScan?.status`: when it becomes `"done"`, trigger emails if not already sent for that scan ID
- Track already-emailed scan IDs in a `useRef<Set<string>>()` to prevent duplicates
- On component mount, if any scan in history is "queued" or "running", automatically resume polling for it (resilience to page reloads)

**2. `supabase/functions/send-pentest-email/index.ts`**
- The `PENTESTER_EMAIL` defaults to `admin@cybersomalia.com` -- verify this is the intended recipient. If not, it should be updated or set as a secret.

### Technical Summary

The fix replaces `clientEmail`/`clientName` with closure-safe references (`email`/`name` args), adds a safety-net `useEffect` to catch completed scans regardless of how they were loaded, and resumes polling for in-progress scans on page load.

