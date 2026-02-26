

## Add LeakCheck Findings to Dark Web PDF Report and Email

### Overview
Enhance the `send-darkweb-report` edge function to include a dedicated LeakCheck detail page in the generated PDF, with findings grouped by type (Domain Breaches, Email Breaches, Keyword Mentions), showing breach names, severity, password exposure flags, and exposed fields. The email recipients are already correctly configured as `osmando@gmail.com` and `info@cyberdefense.so`.

### Changes

**`supabase/functions/send-darkweb-report/index.ts`**

1. **Add LeakCheck detail page(s) to the PDF** after the existing detailed findings pages:
   - New section header: "LeakCheck Pro Intelligence"
   - Group findings into 3 sub-sections: Domain Breaches, Email Breaches, Keyword Mentions
   - Each finding row shows:
     - Severity badge (CRITICAL = red, HIGH = orange, MEDIUM = yellow)
     - `breach_name` in bold + `breach_date`
     - `email` and/or `username`
     - "PASSWORD EXPOSED" flag when `has_password === true`
     - `fields` array as comma-separated list
   - Sort CRITICAL findings to top within each group
   - Handle pagination if findings exceed page capacity

2. **Add LeakCheck to the source summary table** on page 1 (already present as "LeakCheck" in `sourceConfigs` -- no change needed there)

3. **Add LeakCheck summary to email HTML body**: Add a row or note in the email HTML showing LeakCheck finding counts broken down by type

4. **Include cavalier in PDF summary counts**: Augment the total/critical/high counts in the PDF the same way the frontend does (adding cavalier + leakcheck counts)

### PDF LeakCheck Page Layout
```text
+-------------------------------------------------------+
| SOMALIA CYBER DEFENCE          LeakCheck Intelligence  |
+-------------------------------------------------------+
|                                                        |
| DOMAIN BREACHES (X found)                              |
| ┌───────────────────────────────────────────────────┐  |
| │ [CRITICAL] LinkedIn  |  2024-05-12                │  |
| │ user@example.com  |  PASSWORD EXPOSED             │  |
| │ Fields: email, username, password, phone           │  |
| └───────────────────────────────────────────────────┘  |
|                                                        |
| EMAIL BREACHES (X found)                               |
| ...                                                    |
|                                                        |
| KEYWORD MENTIONS (X found)                             |
| ...                                                    |
+-------------------------------------------------------+
| Footer with page number                                |
+-------------------------------------------------------+
```

### Email Recipients
Already configured on line 413: `["osmando@gmail.com", "info@cyberdefense.so"]` -- no changes needed.

### Technical Details

- The PDF generation uses raw PDF operators (not a library), so the new page will follow the same pattern: create content stream arrays, render text with `BT/ET` operators, use severity-based colors
- Augment summary counts: `total += cavalierCount + leakcheckCount`, same for critical/high
- Add a helper function `buildLeakCheckPages()` that returns page content arrays
- The severity sort order: CRITICAL first, then HIGH, then MEDIUM

### Files Modified
- `supabase/functions/send-darkweb-report/index.ts` -- add LeakCheck detail pages to PDF, augment summary counts, add LeakCheck note to email HTML

