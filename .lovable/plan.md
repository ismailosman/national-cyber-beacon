
# Assign SuperAdmin Role to osmando@gmail.com

## The Problem
The user account for `osmando@gmail.com` does not yet exist in the system. A row in `user_roles` requires a valid `user_id` from the auth system — so the account must be created first.

## Step-by-Step Plan

### Step 1 — You Sign Up First
- Go to the login page at `/login`
- Click "Sign Up" and create an account with `osmando@gmail.com` and your chosen password
- This registers you in the authentication system and gives your account a UUID

### Step 2 — Insert SuperAdmin Role (after signup)
Once the account exists, I will run a database insert that:
- Looks up your user ID by email from `auth.users`
- Inserts a row into `user_roles` with `role = 'SuperAdmin'` and `org_id = NULL` (SuperAdmin is platform-wide, not org-scoped)

The SQL that will run:
```sql
INSERT INTO public.user_roles (user_id, role, org_id)
SELECT id, 'SuperAdmin', NULL
FROM auth.users
WHERE email = 'osmando@gmail.com'
ON CONFLICT DO NOTHING;
```

### Step 3 — Verify Access
After the insert, signing in will give you:
- Full access to Settings page
- Ability to add/delete organizations
- Trigger full platform scans
- View all data across all tables (RLS SuperAdmin policies are already in place)

## Technical Notes
- The `user_roles` table already has the correct RLS: SuperAdmin is granted via the `has_role()` security-definer function
- `org_id` is `NULL` for SuperAdmin because they have platform-wide access, not tied to a single organization
- No code changes are needed — this is purely a data operation

## Action Required from You
Please sign up on the login page first, then come back and let me know — I will immediately insert the SuperAdmin role for your account.
