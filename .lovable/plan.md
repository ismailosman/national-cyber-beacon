## Override CSP and X-Frame-Options for Cloudflare-Managed Sites

### Problem

When running a compliance scan on a site whose DNS is managed by Cloudflare, the `csp` (Content-Security-Policy) and `x_frame_options` (X-Frame-Options) controls are marked as failed because Cloudflare manages these headers at the WAF/edge level and they may not appear in direct HTTP responses. These should be marked as passed since Cloudflare provides this protection.

### Solution

Add a post-processing step in the frontend that detects Cloudflare and reclassifies these two controls as passed.

### Changes

**File: `src/pages/ComplianceScan.tsx**`

Add a helper function `applyCloudflareOverrides` that:

1. Checks if Cloudflare is detected via `raw_checks.ddos.providers` (contains "Cloudflare") or `raw_checks.headers.present` keys suggesting Cloudflare
2. If detected, moves `csp` and `x_frame_options` from `failed_controls` to `passed_controls` with updated detail text: "Managed by Cloudflare WAF"
3. Adjusts `passed`/`failed` counts and recalculates `overall_score` proportionally
4. Adds a `cloudflare_managed: true` flag to the evidence data

Apply this function in two places:

- In `pollScan` when `compliance_status === 'done'` (before calling `setResults`)
- In the history reload handler (when loading a previous scan's results)

### Technical Detail

```text
function applyCloudflareOverrides(results):
  - Detect CF from raw_checks.ddos.providers or headers server field
  - CF_MANAGED_KEYS = ['csp', 'x_frame_options']
  - For each key in CF_MANAGED_KEYS:
    - If key exists in failed_controls, remove it and add to passed_controls
    - Update detail to "Managed by Cloudflare WAF"
    - Adjust passed/failed counts
  - Recalculate overall_score based on new pass ratio
  - Return modified results
```

This mirrors the existing pattern in `check-security-headers` edge function which already marks these headers as "Managed by WAF" with `managed: true` for Cloudflare sites.  
  
Please make sure only authenticated admin users can access /dashboard and run any scan or generate report. 