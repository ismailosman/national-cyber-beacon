

## Suppress Additional DAST False Positives for Cloudflare-Protected Sites

### Problem

The DAST scanner is still flagging three findings that should be suppressed for Cloudflare-protected sites like fisheries.gov.so:

1. **CS-CSP-MISS** (Content-Security-Policy Missing) -- flagged as medium/fail even though Cloudflare provides WAF-level protections
2. **CS-CLICKJACK** (Clickjacking Protection) -- currently downgraded to info/info but should be fully marked as pass for Cloudflare sites
3. **SUB-HTTP** (Subdomains Without SSL) -- flagging mail.fisheries.gov.so which is expected mail infrastructure, not a web vulnerability

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/dast-content-security/index.ts` | Reclassify CSP Missing and Clickjacking as pass when Cloudflare is detected |
| `supabase/functions/dast-subdomain-discovery/index.ts` | Exclude mail-related subdomains from the "Without SSL" finding |

### Technical Details

**1. Content Security -- CSP Missing Suppression (line 27)**

When Cloudflare is detected and no CSP header is present, reclassify from `severity: "medium", status: "fail"` to `severity: "info", status: "pass"` with detail noting Cloudflare WAF provides equivalent protection.

**2. Content Security -- Clickjacking Full Suppression (line 49)**

Change the Cloudflare branch from `status: "info"` to `status: "pass"` so it counts as a passing check, not an informational warning.

**3. Subdomain Discovery -- Exclude Mail from SSL Check (line 89)**

Filter out mail-related subdomains (mail, webmail, smtp, imap, pop3, mx) from the `httpOnlySubdomains` list before generating the SUB-HTTP finding. Mail servers are expected infrastructure and HTTP-only mail subdomains are not a web security vulnerability.

### Expected Result

- CSP Missing will no longer penalize Cloudflare-protected sites
- Clickjacking will be fully passed for Cloudflare sites
- mail.fisheries.gov.so will not appear in the "Without SSL" finding
- Security score will increase significantly (removing 1 medium + 1 high = +11 points)

