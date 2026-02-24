

## Fix Security Scanner Proxy Edge Function

### What's happening
The upstream API at `cybersomalia.com` returns HTML (nginx 502 page) when it's down, causing the edge function to forward raw HTML to the frontend, which breaks JSON parsing and shows a blank screen.

### Changes

**1. Update `supabase/functions/security-scanner-proxy/index.ts`**
- Replace the current implementation with the user-provided version that has cleaner error handling
- Key improvements:
  - Read `API_BASE` from `SECURITY_API_URL` env var (with fallback to `https://cybersomalia.com`)
  - Check upstream `content-type` before parsing -- if non-JSON, return a structured JSON error with status 502
  - Simpler, more readable flow
  - Updated CORS headers to match the standard pattern

**2. Add `SECURITY_API_URL` secret**
- Add a new secret `SECURITY_API_URL` set to `https://cybersomalia.com` so the API base URL is configurable without code changes

No frontend changes needed -- `securityApi.ts` already handles non-ok responses gracefully.

