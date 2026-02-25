

## Fix: Scan Queue - Match Exact API Format and Persist Scans

### Problem
1. The scan payload doesn't match the exact API spec -- it sends either `target_url` OR `repo_url`, but the API expects **both** fields
2. Scans disappear after 60 seconds because `/scan/jobs` returns empty and the local tracking expires too quickly
3. No individual scan status polling -- we start scans but never check their progress

### Changes

**File 1: `supabase/functions/scan-queue-proxy/index.ts`**

Update the `start` action payload to always include both fields per the user's confirmed API format:
```json
{
  "scan_type": "vuln",
  "target_url": "<user URL>",
  "repo_url": ""
}
```
- For DAST: `scan_type: "vuln"`, `target_url: target`, `repo_url: ""`
- For SAST: `scan_type: "sast"`, `target_url: ""`, `repo_url: target`

Add a new `status` action that proxies `GET /scan/{scan_id}` to check individual scan progress.

**File 2: `src/pages/ScanQueuePanel.tsx`**

- Extend local scan tracking from 60 seconds to **5 minutes** (300,000ms)
- After starting a scan, poll its individual status via the new `status` action every 5 seconds
- Update the local job's status/progress when the individual poll returns data
- Keep the scan visible in the queue even after the success banner disappears

### Technical Details

Edge function new `status` action:
```typescript
if (action === "status") {
  const { scan_id } = body;
  const upstream = await fetch(`${API_BASE}/scan/${scan_id}`, {
    headers: { "x-api-key": API_KEY }
  });
  // return parsed result
}
```

Frontend scan tracking update:
- Change expiry from `age < 60000` to `age < 300000`
- After successful start, begin a per-scan poller that calls `action: "status"` and updates the ref entry's status/progress
- Stop polling when status is `completed` or `failed`
