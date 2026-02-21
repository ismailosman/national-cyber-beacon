

## Fix DAST False Positives and Scoring

### Root Cause

The DAST scanner has two major problems generating inaccurate results:

**Problem 1: Massive False Positives in API Discovery**
The `dast-api-discovery` edge function checks 20+ paths like `/graphiql`, `/debug/`, `/actuator`, `/actuator/env`, etc. It flags them as "Exposed" if the HTTP response is 200. However, most CMS sites (WordPress, Joomla) return a 200 status code with their homepage or a generic page for ANY URL -- this is called a "soft 404." The function does not validate whether the response body actually contains the expected content (GraphQL schema, Spring Actuator data, debug output, etc.), so it incorrectly reports these endpoints as critical/high findings. This is why the screenshot shows "Exposed: GraphQL IDE", "Exposed: Debug Endpoint", "Exposed: Spring Actuator" on sites that clearly don't run those technologies.

**Problem 2: False Positives in Info Disclosure**
The `dast-info-disclosure` function has similar issues. It flags `robots.txt` and `sitemap.xml` as security failures when they return 200, but these are standard, expected files on any website. It also suffers from the same soft-404 problem for paths like `/.env`, `/.git/HEAD`, etc.

**Problem 3: Score of 0**
The false positive critical/high findings inflate the `weightedFail` score so much that legitimate passes are drowned out, resulting in scores near or at 0.

---

### Changes

#### 1. `supabase/functions/dast-api-discovery/index.ts` -- Content Validation

For each path check, after receiving a 200 response, read the response body and validate it actually contains relevant content before flagging it:

- `/graphiql` and `/graphql`: Verify body contains "GraphiQL" or "graphql" schema keywords, not just a CMS page
- `/debug/`: Verify body contains debug-specific content like "traceback", "stack trace", "debugger"
- `/actuator`, `/actuator/env`: Verify body contains JSON with actuator-specific keys like `"status"`, `"beans"`, `"env"`
- `/_profiler/`: Verify body contains Symfony profiler markup
- `/metrics`: Verify body contains metric-style content (numeric data, prometheus format)
- `/Dockerfile`, `/docker-compose.yml`: Verify body starts with expected syntax (`FROM`, `version:`)
- `/package.json`, `/composer.json`: Verify body is valid JSON with expected keys (`dependencies`, `require`)

Add a **baseline check**: Fetch a random non-existent path first to get the "soft 404" response body. Then compare each subsequent response -- if the body is substantially similar to the baseline (same length within 20%, or same title tag), skip it as a soft 404.

#### 2. `supabase/functions/dast-info-disclosure/index.ts` -- Fix False Positives

- Mark `robots.txt` and `sitemap.xml` as `status: "pass"` with `severity: "info"` (these are expected files, not vulnerabilities)
- Add body content validation for sensitive paths (`.env`, `.git/HEAD`, `phpinfo.php`, etc.):
  - `/.env`: Check body contains `=` assignments (e.g., `DB_HOST=`, `APP_KEY=`)
  - `/.git/HEAD`: Check body starts with `ref: refs/`
  - `/phpinfo.php`: Check body contains `phpinfo()` or PHP configuration tables
  - `/backup.sql`, `/dump.sql`, `/db.sql`: Check content-type is not HTML, or body contains SQL syntax
- Add the same soft-404 baseline detection as API Discovery

#### 3. `supabase/functions/dast-error-handling/index.ts` -- Reduce Admin Panel False Positives

- For admin panel detection (`/admin`, `/wp-admin`, etc.), treat 302 redirects as expected behavior (login redirect), not as "exposed"
- Only flag admin panels that return 200 AND contain login form elements (not just any 200 page)

#### 4. Scoring Weight Adjustment in `src/pages/DastScanner.tsx`

The current formula unfairly penalizes: each critical finding counts 5x against passes that count 1x each. Adjust weights to be more balanced:
- `weightedFail = critical * 3 + high * 2 + medium * 1.5 + low * 0.5`
- `weightedPass = passed * 1`

This prevents a single false positive critical from wiping out 5 legitimate passes.

Apply the same formula update in `supabase/functions/scheduled-dast-scan/index.ts`.

---

### Technical Summary

| File | Action |
|---|---|
| `supabase/functions/dast-api-discovery/index.ts` | Add soft-404 baseline detection; validate response body content before flagging |
| `supabase/functions/dast-info-disclosure/index.ts` | Mark robots.txt/sitemap.xml as pass; add body validation for sensitive paths; add soft-404 baseline |
| `supabase/functions/dast-error-handling/index.ts` | Only flag admin panels with actual login form content; ignore 302 redirects |
| `src/pages/DastScanner.tsx` | Reduce severity weights to prevent single false positives from tanking score |
| `supabase/functions/scheduled-dast-scan/index.ts` | Same scoring weight adjustment |

No database changes needed.

