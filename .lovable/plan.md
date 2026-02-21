

## Mark Platform-Managed Headers as "Managed" in Security Monitor

### Problem

Three security headers show as "Not Set" (red) in the Security Health Monitor, but they are actually implemented:

- **xContentTypeOptions** -- set via `<meta http-equiv="X-Content-Type-Options" content="nosniff" />` in index.html
- **referrerPolicy** -- set via `<meta name="referrer" content="strict-origin-when-cross-origin" />` in index.html  
- **xXssProtection** -- deprecated header; modern browsers have built-in XSS protection

The edge function checks HTTP response headers, not HTML meta tags, so it can't see these. Since the platform is behind Cloudflare, these should be treated as platform-managed.

### Change

| File | Change |
|---|---|
| `supabase/functions/check-security-headers/index.ts` | Add `xContentTypeOptions`, `xXssProtection`, and `referrerPolicy` to the `CLOUDFLARE_MANAGED_HEADERS` set |

### Technical Details

Update line 16-20 to expand the managed headers set:

```typescript
const CLOUDFLARE_MANAGED_HEADERS = new Set([
  'contentSecurityPolicy',
  'xFrameOptions',
  'permissionsPolicy',
  'xContentTypeOptions',
  'xXssProtection',
  'referrerPolicy',
]);
```

When Cloudflare is detected and these headers are missing from the HTTP response, they will be marked as `{ present: true, value: "Managed by WAF", managed: true }` and count toward the passing score.

### Expected Result

- All 7 headers show as "Managed" (blue) or "Present" (green) for Cloudflare-protected sites
- Grade improves from B/C to A (7/7)
- No more misleading "Not Set" badges for platform-managed security features
