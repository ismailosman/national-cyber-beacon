

## Fix WAF Detection False Positives for Cloudflare-Protected Sites

### Problem

When a site is behind Cloudflare (or any known WAF/CDN), the scanner still flags two false positives:

1. **"Server Header Present: cloudflare"** (LOW) -- The "cloudflare" server header is set by Cloudflare itself, not the origin server. It is expected and harmless; flagging it as a security issue is incorrect.
2. **"No Rate Limiting Detected"** (MEDIUM) -- Cloudflare handles rate limiting at its edge with sophisticated rules. A simple 5-request burst test will never trigger it. Reporting this as a failure is misleading for any WAF-protected site.

### Changes

**File: `supabase/functions/dast-waf-detection/index.ts`**

1. **Skip server header finding when it belongs to a detected WAF/CDN**: If a WAF is detected and the server header value matches the WAF name (e.g., "cloudflare", "CloudFront", "Sucuri", "DDoS-Guard"), mark it as `status: "pass"` with `severity: "info"` and a message like "Server header identifies the WAF/CDN provider (expected behavior)" instead of flagging it as a fail.

2. **Skip rate limiting finding when a WAF with built-in rate limiting is detected**: Cloudflare, AWS WAF, Akamai, Imperva, Sucuri, and DDoS-Guard all provide rate limiting at the edge. If any of these WAFs are detected, mark the rate limiting check as `status: "pass"` with `severity: "info"` and note "Rate limiting is provided by the detected WAF (Cloudflare)" instead of running the naive 5-request test and reporting failure.

3. **Only flag server header and rate limiting as issues when NO WAF is detected**, which is when these findings are genuinely actionable.

### Logic Summary

```
IF WAF detected:
  - Server header matches WAF name -> INFO / PASS ("expected WAF identifier")
  - Server header has version info AND is not WAF name -> MEDIUM / FAIL (origin server leaking through)
  - Rate limiting -> INFO / PASS ("handled by WAF")
ELSE (no WAF):
  - Keep current server header checks (LOW/MEDIUM)
  - Keep current rate limiting test (MEDIUM)
```

No other files need changes. No database changes needed.

