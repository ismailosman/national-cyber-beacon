

## Remove Allowlist from API Proxy

The fix is straightforward: remove the `ALLOWED_PREFIXES` array and the path validation block (lines 10-33), so the proxy forwards **all** requests to the backend, just injecting the `x-api-key` header.

### Changes to `supabase/functions/api-proxy/index.ts`

1. **Delete** lines 10-16 (`ALLOWED_PREFIXES` array)
2. **Delete** lines 27-33 (the `allowed` check and 404 response)
3. Keep everything else intact -- path extraction, upstream fetch, error wrapping, CORS

The resulting flow: extract `path` from query param → build `targetUrl` → forward with API key → return response. No filtering.

