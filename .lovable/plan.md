

## Problem Analysis

The threat map shows "Threat feed temporarily unavailable" because requests to `/threat/map/combined` are timing out. Network logs confirm: both requests failed with **"signal is aborted without reason"**.

**Root cause chain:**
1. The client (`useLiveThreatAPI.ts` line 222) sets a **25-second** `AbortController` timeout
2. The edge function (`api-proxy`) now has a 55s timeout for `/threat/map` paths (good)
3. But the **client aborts at 25s** before the edge function can finish its upstream request

The backend server at `187.77.222.249:8000` is responding slowly to `/threat/map/combined`, exceeding 25 seconds.

## Plan

### 1. Increase client-side timeout in `useLiveThreatAPI.ts`
- Change the `AbortController` timeout from **25,000ms → 50,000ms** (line 222)
- This aligns with the edge function's 55s timeout for slow paths

### 2. Add `/threat/map/combined` to edge function slow-path detection (safety fix)
- In `api-proxy/index.ts`, the current check is `path.startsWith('/threat/map')` which already matches `/threat/map/combined` — no change needed here

**Single file change:** `src/hooks/useLiveThreatAPI.ts` line 222, timeout `25000` → `50000`.

