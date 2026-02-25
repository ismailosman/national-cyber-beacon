

## Fix: Scan Queue Proxy Not Returning Jobs

### Root Cause
`supabase.functions.invoke()` always sends HTTP POST requests regardless of any `method` parameter. This means:
- The "fetch jobs" call hits the POST handler (which tries to start a scan)
- The GET handler in the proxy is never reached
- Jobs are never returned to the frontend

### Solution
Use an `action` field in the request body to distinguish between "list jobs" and "start scan" operations.

### Changes

**1. Update `supabase/functions/scan-queue-proxy/index.ts`**

Instead of relying on HTTP method, parse the request body for an `action` field:
- No body or `action: "list"` → fetch jobs from `/api/scan/jobs`
- `action: "start"` with `scan_type` and `target` → POST to `/api/scan/start`

**2. Update `src/pages/ScanQueuePanel.tsx`**

- `fetchJobs`: invoke with `body: { action: "list" }`
- `startScan`: invoke with `body: { action: "start", scan_type, target }`
- Remove the invalid `method: "GET"` parameter

### Technical Details

Proxy logic:
```text
body.action === "start"  -> POST to /api/scan/start with { scan_type, target }
body.action === "list" or no body -> GET /api/scan/jobs -> return JSON
```

Frontend calls:
```text
fetchJobs:  supabase.functions.invoke("scan-queue-proxy", { body: { action: "list" } })
startScan:  supabase.functions.invoke("scan-queue-proxy", { body: { action: "start", scan_type, target } })
```
