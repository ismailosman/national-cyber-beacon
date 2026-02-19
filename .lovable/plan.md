
# Create Admin User: osmando@gmail.com

## What Will Happen

Since the sign-up page is not an option, I will create the user account directly in the authentication system using a secure database function, then immediately assign the SuperAdmin role — all in a single migration step.

## Steps

### Step 1 — Create the Auth User
Use Supabase's built-in `auth.users` admin function to create the account with:
- Email: `osmando@gmail.com`
- Password: `W4ry44@2026`
- Email confirmed automatically (no verification email needed)

### Step 2 — Assign SuperAdmin Role
Immediately after creating the user, insert a row into `public.user_roles` linking the new user's UUID to the `SuperAdmin` role with `org_id = NULL` (platform-wide access).

## SQL to Run

```sql
-- Step 1: Create the user via the auth admin extension
SELECT extensions.pgcrypto_encrypt('W4ry44@2026');  -- just ensures pgcrypto is available

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Create user in auth system
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'osmando@gmail.com',
    crypt('W4ry44@2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    'authenticated',
    'authenticated'
  )
  RETURNING id INTO new_user_id;

  -- Step 2: Assign SuperAdmin role
  INSERT INTO public.user_roles (user_id, role, org_id)
  VALUES (new_user_id, 'SuperAdmin', NULL);
END $$;
```

## Result
- Account `osmando@gmail.com` will be created and immediately verified (no email confirmation needed)
- The account will have full SuperAdmin privileges across the entire platform
- You can sign in straight away at `/login` with your credentials

## Security Note
The password is hashed using bcrypt (`crypt()`) — it is never stored in plain text. This is the exact same secure method Supabase uses for all user passwords.
