
# Fix: "Run Scan Now" Button — Edge Function Schema Mismatch

## Root Cause

The `run-security-checks` edge function was written against a different schema than what actually exists in the database. There are 4 critical mismatches causing silent failures:

| What the function does | What the DB actually has | Result |
|---|---|---|
| Inserts to `security_checks` with `org_id` | Column is `asset_id` (not `org_id`) | Insert fails silently |
| Inserts to `risk_score_history` table | Table is `risk_history` with `organization_id` + `created_at` | Table not found |
| Updates `organizations.last_scanned_at` | Column is `last_scan` | Column not found |
| Inserts alerts with `type` and `message` | Columns are `title` and `description` | Insert fails |

Additionally, the `security_checks` table is asset-based, not org-based. The function needs to look up the org's assets first (or scan without storing per-asset), then write checks correctly.

## Fix Strategy

The cleanest fix is to rewrite the edge function to match the actual schema:

1. **`security_checks`** — the table requires an `asset_id`. We fetch the org's primary domain asset first. If no assets exist, we create a temporary "website" asset for the domain before inserting checks. We also need to map `result` (pass/warn/fail) to the `status` column, and compute a numeric `score` (100 for pass, 50 for warn, 0 for fail).

2. **`risk_history`** — insert with `organization_id` (not `org_id`) and no `recorded_at` (the table has `created_at` which defaults automatically).

3. **`organizations`** — update `last_scan` (not `last_scanned_at`).

4. **`alerts`** — use `title` + `description` (not `type` + `message`). Also set `source: 'scanner'` which the table already has.

## Updated Edge Function Logic

```ts
// 1. Fetch org assets — use primary website asset or create one
const { data: existingAssets } = await supabase
  .from('assets')
  .select('id')
  .eq('organization_id', org_id)
  .eq('asset_type', 'website')
  .limit(1);

let assetId: string;
if (existingAssets?.length) {
  assetId = existingAssets[0].id;
} else {
  // Create a website asset on the fly for this org
  const { data: newAsset } = await supabase.from('assets').insert({
    organization_id: org_id,
    asset_type: 'website',
    url: `https://${domain}`,
    is_critical: true,
  }).select('id').single();
  assetId = newAsset.id;
}

// 2. Insert security_checks with correct columns
await supabase.from('security_checks').insert(
  checks.map(c => ({
    asset_id: assetId,           // ✅ was: org_id
    check_type: c.check_type,
    status: c.result,            // ✅ column is 'status' not 'result'
    score: c.result === 'pass' ? 100 : c.result === 'warn' ? 50 : 0,
    details: c.details,
    checked_at: checkedAt,
  }))
);

// 3. Update organization with correct column name
await supabase.from('organizations').update({
  risk_score: riskScore,
  status,
  last_scan: checkedAt,          // ✅ was: last_scanned_at
}).eq('id', org_id);

// 4. Insert risk history with correct table + column names
await supabase.from('risk_history').insert({
  organization_id: org_id,       // ✅ was: org_id in risk_score_history
  score: riskScore,
  // created_at defaults automatically
});

// 5. Insert alerts with correct column names
alertsToCreate.push({
  org_id,
  title: '...',                  // ✅ was: type
  description: '...',            // ✅ was: message
  severity: '...',
  source: 'scanner',
  status: 'open',
  is_read: false,
});
```

## Also: The OrgDetail page queries security_checks by `asset_id`

The `OrgDetail.tsx` page already queries security_checks correctly using `asset_id IN (assetIds)` — so it will work as soon as the edge function starts inserting correctly.

## Files to Change

| File | Change |
|---|---|
| `supabase/functions/run-security-checks/index.ts` | Fix all 4 schema mismatches — org_id→asset_id, risk_score_history→risk_history, last_scanned_at→last_scan, type/message→title/description |

No database migrations needed. No frontend changes needed. The button and its `handleRunScan` handler in `OrgDetail.tsx` are correct — the problem is entirely in the edge function writing to the wrong column/table names.
