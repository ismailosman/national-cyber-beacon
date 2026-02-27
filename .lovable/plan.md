
## Create Unified API Proxy and Update All References

### Problem
The `security-scanner-proxy` edge function returns 404 errors when polling threat scan results. The `compliance-scan-proxy` is a duplicate with the same logic. Both need to be replaced with a single unified proxy.

### Changes

#### 1. Create new edge function: `supabase/functions/api-proxy/index.ts`
A single proxy that forwards requests to the backend API based on a `path` query parameter. Includes:
- CORS headers for web app compatibility
- Allowlist of valid path prefixes (`/health`, `/scan`, `/scans`, `/compliance/`, `/darkweb/`, `/ddos/`, `/threat/`, `/clients`, `/engagements`)
- Forwards method, body, and API key to the backend
- Returns backend response as-is

#### 2. Add to `supabase/config.toml`
Add `[functions.api-proxy]` with `verify_jwt = false` (matching existing proxy config).

#### 3. Update all frontend proxy references (5 files)
Replace `security-scanner-proxy` with `api-proxy` in:
- `src/pages/ThreatIntelligence.tsx` (line 58) -- the threat intel `proxyFetch`
- `src/services/securityApi.ts` (line 8) -- security scanner API
- `src/services/darkwebApi.ts` (line 11) -- dark web scanner API
- `src/pages/ComplianceScan.tsx` (line 21) -- compliance scan proxy URL
- `src/pages/DdosMonitor.tsx` (line 112) -- DDoS monitor proxy URL

Only the function name changes; path parameters remain identical.

#### 4. Deprecate old edge functions
Replace contents of both old proxy files with a simple 410 Gone response:
- `supabase/functions/security-scanner-proxy/index.ts`
- `supabase/functions/compliance-scan-proxy/index.ts`

#### Not changed
- `scan-queue-proxy` is left as-is since it uses a different action-based body pattern (not path-based routing)
- All UI, styling, and functionality remains unchanged
- The `SECURITY_API_KEY` secret is already configured and shared across all edge functions automatically
