

## Fix Breaches Tab: Load from Correct Table and Show Actual Domains

### Problems Identified

1. **Breach data loaded from wrong table on mount**: Lines 898-919 load cached breach data from `threat_intelligence_logs` (the OLD table) instead of `breach_check_results` (the new table). This old data stores the organization name in the `domain` field, which is why the Domain column shows "Dahabshiil Bank" instead of "dahabshilbank.com".

2. **`breach_check_results` table is empty**: Even though the upsert code exists (lines 559-578), results never got persisted successfully (possibly due to RLS or the `as any` cast). The table remains empty, so it always falls back to the old broken data.

3. **HIBP API key not being used**: The edge function times out (takes ~23s per org with 15 email checks at 1.5s each), but the frontend `invokeWithRetry` call at line 507 has a 120s timeout which should be sufficient. The issue is likely that the previous scan ran before the HIBP key was added, so the cached results from `threat_intelligence_logs` still show "Free Breach Check" as the source. Once a fresh scan completes with the key present, results should show HIBP data.

### Changes

**File: `src/pages/ThreatIntelligence.tsx`**

1. **Fix mount data loading (lines 898-919)**: Replace the `threat_intelligence_logs` query with a `breach_check_results` query. Map the correct columns:
   - `domain` from `breach_check_results.domain` (actual domain like "dahabshilbank.com")
   - `organization` from `breach_check_results.organization_name`
   - `breachCount` from `breach_check_results.breach_count`
   - `breaches` from `breach_check_results.breaches` (JSONB)
   - `breachedEmails` from `breach_check_results.breached_emails`
   - `isClean` from `breach_check_results.is_clean`
   - `source` from `breach_check_results.source`
   - `checkedAt` from `breach_check_results.checked_at`

2. **Fix upsert persistence**: Remove the `as any` cast from the `breach_check_results` table reference since it now exists in the types. Ensure the upsert works correctly with the UNIQUE constraint on `organization_id`.

3. **Show all 36 organizations**: When breach results are displayed, show ALL organizations (even those not yet checked) so the user sees the full list with "Not checked" status for orgs without cached results.

### Technical Details

```text
-- Current broken loading (lines 898-919):
supabase.from('threat_intelligence_logs').select('*').eq('check_type', 'breach')
  --> sets domain = orgName (WRONG)

-- Fixed loading:
supabase.from('breach_check_results').select('*').order('checked_at', { ascending: false })
  --> sets domain = row.domain (CORRECT: "dahabshilbank.com")
```

The edge function itself is correct and already uses the HIBP API key when present. The fix is purely on the frontend data loading side.

