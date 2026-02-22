

## Show IP Address and Geo-Restrict Login to USA and Somalia

### Overview
Display the visitor's IP address on the login page and block login attempts from countries other than the United States and Somalia. We'll use a free IP geolocation API to fetch the visitor's IP and country on page load.

### Changes

#### 1. New Edge Function: `supabase/functions/check-login-geo/index.ts`
- Receives the request, extracts the caller's IP from headers (x-forwarded-for, x-real-ip, or connection info)
- Calls a free geolocation API (ip-api.com) to get country code
- Returns `{ ip, country_code, country_name, allowed }` where `allowed` is true only for `US` or `SO`
- Includes CORS headers

#### 2. Update `supabase/config.toml`
- Add `[functions.check-login-geo]` with `verify_jwt = false` (unauthenticated users need this)

#### 3. Update `src/pages/Login.tsx`
- On mount, call the `check-login-geo` edge function
- Display the user's IP address below the "Operator Sign In" heading (styled subtly with a globe/wifi icon)
- Display the detected country name
- If the country is not US or Somalia:
  - Show a red "Access Denied" banner explaining geographic restriction
  - Disable the login form (grey out inputs and submit button)
- If geo lookup is still loading, show a small spinner where the IP will appear

### UI Preview

```
  OPERATOR SIGN IN
  IP: 203.0.113.42 | Location: Somalia
  
  [email input]
  [password input]
  [Access System button]
```

If blocked:
```
  OPERATOR SIGN IN
  IP: 203.0.113.42 | Location: Germany
  
  ⚠ ACCESS RESTRICTED
  Login is only permitted from USA or Somalia.
  
  [email input - disabled]
  [password input - disabled]  
  [Access System button - disabled]
```

### Technical Details

**Edge function** (`check-login-geo/index.ts`):
```typescript
// Extract IP from request headers
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  || req.headers.get('x-real-ip')
  || 'unknown';

// Lookup via ip-api.com (free, no key needed, 45 req/min)
const geo = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,country`);
const { countryCode, country } = await geo.json();
const allowed = ['US', 'SO'].includes(countryCode);

return new Response(JSON.stringify({ ip, country_code: countryCode, country_name: country, allowed }));
```

**Login page** additions:
- New state: `ipInfo` (ip, country, allowed), `geoLoading`
- `useEffect` on mount calls `supabase.functions.invoke('check-login-geo')`
- IP/country displayed in a small info bar
- Form disabled when `ipInfo?.allowed === false`
- Error banner shown for blocked countries

