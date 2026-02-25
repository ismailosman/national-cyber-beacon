
Goal: eliminate the recurring 502 runtime error on `/scan-queue` and restore queue listing/start-scan behavior.

## Status: ✅ COMPLETED

### Changes Made

1. **`supabase/functions/scan-queue-proxy/index.ts`** — Fixed upstream paths from `/api/scan/*` to `/scan/*`, added `SECURITY_API_KEY` and `SECURITY_API_URL` env vars (matching `security-scanner-proxy`), and changed list action to always return HTTP 200 with `{ ok, jobs, error? }` structure so polling never causes runtime errors.

2. **`src/pages/ScanQueuePanel.tsx`** — Updated `fetchJobs` to consume the new structured response, added `errorMsg` state, and added a visible error banner when the scanner API is unavailable. The connected/disconnected badge is now driven by `data.ok`.

### Verified
- Edge function returns `200 { ok: true, jobs: [] }` when scanner is healthy with no jobs.
- When upstream is down, returns `200 { ok: false, jobs: [], error: "..." }` — no more 502 loop.
