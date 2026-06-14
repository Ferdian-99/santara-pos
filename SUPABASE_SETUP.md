# Supabase Setup - Santara POS

Santara POS is still localStorage-first, but it can now sync to Supabase when
Supabase Auth is configured and a staff user is logged in.

## 1. Create a Supabase Project

1. Open Supabase and create a new project.
2. Wait until the project finishes provisioning.
3. Open the project dashboard.

## 2. Copy Project Credentials

1. Go to Project Settings.
2. Open API.
3. Copy the Project URL.
4. Copy the anon public key.

Do not commit real keys to GitHub.

## 3. Add Local Environment Variables

Create a local `.env` file in the project root:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The `.env` file is ignored by Git. Keep `.env.example` as the safe template.

## 4. Add Vercel Environment Variables

In Vercel:

1. Open the Santara POS project.
2. Go to Settings.
3. Open Environment Variables.
4. Add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Redeploy after adding the variables.

## 5. Run Database Migrations

Open Supabase SQL Editor and run these files in order:

1. `supabase/migrations/20260614000100_santara_pos_schema.sql`
2. `supabase/migrations/20260614000200_santara_pos_phase5b_sync_policies.sql`
3. `supabase/migrations/20260614000300_santara_pos_auth_policies.sql`
4. `supabase/migrations/20260614000400_santara_pos_legacy_sales.sql`

The Phase 5C migration removes the temporary anon sync policies and replaces
them with authenticated owner/admin/cashier policies.

The Phase 6 migration adds legacy import tables so old POS sales can be included
in local and cloud-backed reports.

## 6. Create a Supabase Auth User

1. In Supabase, open Authentication.
2. Go to Users.
3. Click Add user.
4. Enter the owner email and password.
5. Save the user.

## 7. Create the First Owner Profile

After creating the Auth user, run this in Supabase SQL Editor. Replace the email
with the owner email you created:

```sql
insert into public.profiles (id, email, full_name, role)
select id, email, 'Owner Santara', 'owner'
from auth.users
where email = 'owner@santara.coffee'
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    updated_at = now();
```

Roles supported now:

- `owner`: full access
- `admin`: full access
- `cashier`: cashier and receipt history only

If a logged-in user has no profile row yet, the app safely treats them as
`cashier` and shows a role setup note.

## 8. Current Phase 5C Behavior

- If Supabase env variables are missing, the app stays in local/demo mode.
- If Supabase is configured, users must login before cloud sync.
- localStorage remains the first safety layer.
- The compact sync status shows `Login diperlukan` when cloud sync is waiting
  for login.
- The small `Sync Sekarang` button retries pending sync after login.
- Owner/admin can access Kasir, Kelola Menu, Riwayat Struk, Laporan, and Data
  Lokal backup controls.
- Cashier can access Kasir and Riwayat Struk only.

## 9. What Is Still Not Implemented

- No complex user management UI exists yet.
- No Google Sheets sync exists yet.
- No expenses or shift closing exists yet.
- No realtime subscriptions exist yet.

## 10. Legacy Import Notes

- Owner/admin can open `Import Data Lama`.
- Cashier cannot see the legacy import tab.
- Legacy sales are included in `Laporan`.
- Legacy sales do not appear in `Riwayat Struk`.
- If Supabase sync fails, imported data remains in localStorage and the sync
  queue retries later.

## 11. Next Phase

The next phase should not be Google Sheets until legacy import is tested with a
real CSV from the old POS.
