

## Fix False "Website Offline" Alerts for Sites Returning 403

### Problem

The `ping-website` function uses HTTP HEAD requests to check if websites are online. Some sites (like `etas.gov.so`) return a **403 Forbidden** status to HEAD requests due to bot protection or Cloudflare rules. The current logic treats any status outside 200-399 as "down", causing false offline alerts even though the site is perfectly reachable.

### Solution

Update the `pingUrl` function to **fall back to a GET request** when HEAD returns 403 or 405. Many sites block HEAD but respond normally to GET. Also treat 403 specifically as "up" if the response itself was received (a 403 from a WAF/Cloudflare means the server is online and responding).

### Changes

| File | Change |
|---|---|
| `supabase/functions/ping-website/index.ts` | Modify `pingUrl`: if HEAD returns 403 or 405, retry with GET. Also expand "up" definition to include 403 (server is responding, just blocking the request type). |

### Technical Details

The updated `pingUrl` logic:

1. Try HEAD request (fast, current behavior)
2. If HEAD returns 403 or 405, retry with GET request
3. Consider the site "up" if any response is received with status 200-499 (excluding 5xx server errors). A 403 from a WAF means the server is online.
4. Only mark as "down" if: connection times out, DNS fails, or server returns 5xx

This fixes `etas.gov.so` and similar government/institutional sites behind Cloudflare that block automated HEAD requests.

