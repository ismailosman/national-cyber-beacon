

## Fix: Compliance API Returns 404

### Root Cause

The compliance scan proxy edge function is **working correctly**. The 404 error is coming from the **upstream backend API** itself -- the `/compliance/scans` and `/compliance/scan` endpoints do not exist at the configured `SECURITY_API_URL` backend (which serves the "CyberSomalia Pentest API").

I confirmed this by calling the same path through the already-working `security-scanner-proxy` edge function and getting the identical 404 response. The backend health endpoint responds fine (`/health` returns 200), but the compliance endpoints have not been deployed to that server.

### What Needs to Happen

Since the backend API doesn't have compliance endpoints, there are two options:

**Option A (Recommended): Add debug logging and a user-friendly error message**
- Update `ComplianceScan.tsx` to catch 404 errors specifically and show a clear message: "Compliance scanning API is not available. Please verify the backend has compliance endpoints deployed."
- Add error state handling so users aren't left with a blank screen
- Add console logging of the actual error response for debugging

**Option B: If you have a different URL for the compliance API**
- If the compliance endpoints live at a different base URL than the security scanner (e.g., a separate service), we need to configure a separate secret (e.g., `COMPLIANCE_API_URL`) and update the proxy to use it
- This would require you to provide the correct URL

### Proposed Changes (Option A)

**File: `src/pages/ComplianceScan.tsx`**
- Add an `error` state variable to display API errors
- In `startScan`, catch non-OK responses and show `data.detail` or `data.error` message
- In the history fetch, catch 404 gracefully and show "Compliance API not available" instead of silently failing
- In `pollScan`, handle error status from the API response
- Display error messages in a red-bordered card with clear text

This way, when the backend compliance endpoints become available, everything will work automatically without frontend changes.

### Technical Details

- The edge function `compliance-scan-proxy` does NOT need changes -- it correctly proxies to the upstream API
- The `security-scanner-proxy` is confirmed working (200 on `/health`)
- Both proxies use the same `SECURITY_API_URL` and `SECURITY_API_KEY` secrets
- The 404 `{"detail":"Not Found"}` is a FastAPI-style response from the upstream server

