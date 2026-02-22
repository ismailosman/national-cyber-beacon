

## Fix Login Page: Logo, IP Display, and Configurable Geo-Restriction

### Problem Summary
1. **IP address not showing** -- The `check-login-geo` edge function is missing from `supabase/config.toml`, so JWT verification blocks unauthenticated requests on the login page.
2. **Wrong logo** -- Login page imports `login-logo.png` instead of `logo.png`.
3. **No way to manage allowed countries** -- The allowed country list (`US`, `SO`) is hardcoded in the edge function.

### Changes

| # | File | What |
|---|---|---|
| 1 | `supabase/config.toml` | Add `[functions.check-login-geo]` with `verify_jwt = false` |
| 2 | `src/pages/Login.tsx` | Change logo import from `login-logo.png` to `logo.png` |
| 3 | Database migration | Create `geo_allowed_countries` table with columns: `id`, `country_code` (2-letter ISO), `country_name`, `created_at`. Seed with `US` and `SO`. Add RLS: SuperAdmins can manage, authenticated users can read. |
| 4 | `supabase/functions/check-login-geo/index.ts` | Fetch allowed country codes from the `geo_allowed_countries` table instead of using a hardcoded list |
| 5 | `src/pages/Settings.tsx` | Add a "Geo-Restriction" section where SuperAdmins can add/remove allowed countries |

### Technical Details

**1. Config fix (root cause of IP not showing)**

The login page calls `check-login-geo` before the user is authenticated. Without `verify_jwt = false`, the function rejects the request, the catch block silently swallows the error, and `geoInfo` stays `null` so nothing renders.

**2. Logo swap**

```typescript
// Before
import loginLogo from '@/assets/login-logo.png';

// After
import loginLogo from '@/assets/logo.png';
```

**3. New table: `geo_allowed_countries`**

```text
id          uuid (PK, default gen_random_uuid())
country_code text NOT NULL UNIQUE  -- e.g. "US", "SO"
country_name text NOT NULL         -- e.g. "United States", "Somalia"
created_at   timestamptz DEFAULT now()
```

Seeded with two rows: `US`/`United States` and `SO`/`Somalia`.

RLS policies:
- Authenticated users can SELECT (needed for Settings page display)
- SuperAdmins can INSERT and DELETE

**4. Edge function update**

Instead of `['US', 'SO'].includes(countryCode)`, the function will query the `geo_allowed_countries` table using the service role key to check if the detected country code exists.

**5. Settings page addition**

A new "Allowed Countries" card in Settings (visible to SuperAdmins) with:
- A list of currently allowed country codes with delete buttons
- An input to add a new country code and name
- Changes take effect immediately for future login attempts

