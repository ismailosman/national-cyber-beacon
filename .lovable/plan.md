

## Fix Security Scan Errors and Clear Warnings

### Overview
The security scan has identified 4 errors and several warnings. This plan addresses each one through database migrations and finding management.

### Errors to Fix (Database Changes)

**1. Remove Auditor access from `breach_check_results`**
The Auditor role can still read breached emails. Drop the "Auditor read breach_check_results" policy since Auditors don't need access to raw breach data.

**2. Restrict `incident_reports` public insert**
Replace the wide-open `WITH CHECK (true)` insert policy with a more restrictive one that still allows public submissions but limits insertable columns by ensuring only expected fields are populated (or mark as intentional and ignore).

**3. Protect `organizations.contact_email` from Analysts/Auditors**
Create a safe view `organizations_safe` that redacts `contact_email` for non-SuperAdmin users, and update frontend queries to use the view.

**4. Protect `incident_reports` reporter_email from OrgAdmins/Auditors**
The `incident_reports_safe` view already exists and redacts this data. Add RLS policies to the view so it's accessible, and ensure the base table blocks direct SELECT for OrgAdmins and Auditors (they should use the view).

**5. Add RLS policies to `incident_reports_safe` view**
The view currently has RLS enabled but no policies. Add read policies matching the base table roles.

### Warnings to Ignore (Acceptable Risk)

The following will be marked as ignored with justification:
- **RLS Policy Always True**: The public incident insert is intentional for anonymous reporting
- **Leaked Password Protection**: Requires manual dashboard toggle, cannot be fixed via code
- **Phishing domains readable by all auth users**: Intentional for SOC analyst awareness
- **Tech stack details for OrgAdmins**: Acceptable -- OrgAdmins need to see their own tech stack
- **DAST results for OrgAdmins**: Acceptable -- organizations need their own scan results
- **Security check details for OrgAdmins**: Acceptable -- transparency requirement
- **Baselines nullable org_id**: Low risk, existing data pattern
- **SSL/DDoS/Uptime info-level findings**: Acceptable operational data

### Technical Steps

**Migration SQL:**
```sql
-- 1. Drop Auditor read from breach_check_results
DROP POLICY IF EXISTS "Auditor read breach_check_results" ON public.breach_check_results;

-- 2. Add RLS policies to incident_reports_safe view
ALTER VIEW public.incident_reports_safe SET (security_invoker = on);
-- (Add SELECT policies for SuperAdmin, Analyst, Auditor, OrgAdmin)

-- 3. Create organizations_safe view hiding contact_email
CREATE OR REPLACE VIEW public.organizations_safe
WITH (security_invoker = on) AS
SELECT id, name, domain, sector, region, status, risk_score,
       last_scan, lat, lng, created_at, updated_at,
       CASE WHEN public.has_role(auth.uid(), 'SuperAdmin') 
            THEN contact_email ELSE NULL END AS contact_email
FROM public.organizations;
```

**Frontend changes:**
- Update organization queries to use `organizations_safe` view where contact_email is displayed

**Finding management:**
- Ignore warnings that represent acceptable, intentional design decisions
- Delete/update findings resolved by the migration

### Files to Modify
- New database migration (SQL)
- `src/pages/Organizations.tsx` (use safe view if it queries contact_email)
- `src/pages/OrgDetail.tsx` (use safe view if it queries contact_email)

