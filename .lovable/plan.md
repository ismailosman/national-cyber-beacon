
Goal: eliminate the recurring 502 runtime error on `/scan-queue` and restore queue listing/start-scan behavior.

What’s happening now:
- The frontend is repeatedly calling the backend function with `{ action: "list" }` every 3 seconds.
- The backend function is currently calling `https://cybersomalia.com/api/scan/jobs`.
- That upstream URL returns an HTML `502 Bad Gateway`, which the function now wraps correctly as JSON, but still returns HTTP 502.
- Because polling is continuous, the same error is produced repeatedly.

Important finding from endpoint checks:
- `https://cybersomalia.com/health` is healthy (JSON response).
- `https://cybersomalia.com/scan/jobs` and `/scan/start` exist and return a JSON validation error when no `x-api-key` is sent.
- This indicates the scan queue API is likely under `/scan/*` (not `/api/scan/*`) and requires `x-api-key`.

Implementation plan:

1) Fix upstream base + auth source in `scan-queue-proxy`
- File: `supabase/functions/scan-queue-proxy/index.ts`
- Replace hardcoded API base with configured secret pattern already used elsewhere:
  - `const API_BASE = Deno.env.get("SECURITY_API_URL") ?? "https://cybersomalia.com";`
  - `const API_KEY = Deno.env.get("SECURITY_API_KEY") ?? "";`
- Build requests using these values so environments can be changed without code edits.

2) Correct endpoint paths to the live queue API
- File: `supabase/functions/scan-queue-proxy/index.ts`
- Change:
  - list: from `/api/scan/jobs` -> `/scan/jobs`
  - start: from `/api/scan/start` -> `/scan/start`
- Add required upstream header:
  - `"x-api-key": API_KEY`
- Keep `Accept: application/json` and content-type headers as appropriate.

3) Keep robust JSON parsing and improve list-action resilience
- File: `supabase/functions/scan-queue-proxy/index.ts`
- Retain `parseJsonResponse` guard (already good).
- For `action: "list"`:
  - Return a stable payload format (jobs + connection info), even when upstream is down/misconfigured.
  - This avoids noisy fatal runtime loops from polling and lets UI show “Disconnected” gracefully.
- For `action: "start"`:
  - Keep explicit error response when scan launch fails (so user gets immediate actionable failure feedback).

4) Update `/scan-queue` page to consume structured list responses
- File: `src/pages/ScanQueuePanel.tsx`
- Adjust `fetchJobs` to handle either:
  - success: jobs array
  - degraded: empty jobs + backend error metadata
- Track/display a readable connection error message in the panel (instead of silent failure).
- Preserve current `connected` badge behavior, but make it data-driven from response metadata.

5) Improve operator visibility (small UI hardening)
- File: `src/pages/ScanQueuePanel.tsx`
- Add a compact error strip/card when backend queue API is unavailable:
  - human-readable message
  - upstream status (if available)
- Keep current history display intact so existing jobs remain visible if last fetch fails.

6) Validate end-to-end after patch
- Backend function test:
  - invoke `scan-queue-proxy` with `{ action: "list" }` and confirm non-crashing structured response.
  - invoke `{ action: "start", scan_type: "DAST", target: "https://example.com" }` and confirm expected status path.
- UI test on `/scan-queue`:
  - confirm no runtime-error loop from polling
  - confirm connected/disconnected indicator matches backend availability
  - start a new scan and verify it appears in queue/history when upstream is healthy.

Expected outcome:
- The HTML parse error path is fully removed.
- The function calls the correct queue endpoints with required API key.
- `/scan-queue` no longer floods runtime errors during outages and shows clear operational status.
