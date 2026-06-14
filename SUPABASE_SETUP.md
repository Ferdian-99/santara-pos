# Supabase Setup - Santara POS

This project is still localStorage-first after Phase 5A. Supabase files are
prepared so the next phase can add a data service and sync safely.

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

## 5. Run the Migration SQL

1. Open Supabase SQL Editor.
2. Open this repository file:
   `supabase/migrations/20260614000100_santara_pos_schema.sql`
3. Copy the SQL.
4. Paste it into Supabase SQL Editor.
5. Run it.

The migration creates tables for menu data, transactions, transaction item
snapshots, pending orders, profiles, and app settings.

## 6. Current Phase 5A Behavior

- The app still works without Supabase environment variables.
- If Supabase variables are missing, the app continues in localStorage mode.
- No login/auth UI exists yet.
- No data is synced to Supabase yet.
- Existing cashier, reports, receipt, backup, and local persistence behavior is unchanged.

## 7. Next Phase

Phase 5B should add a Supabase data service and sync plan. It should decide how
localStorage data is migrated or synchronized without risking existing local
data.
