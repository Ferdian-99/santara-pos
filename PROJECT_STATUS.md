# Santara POS - Project Status

## Current Deployment

* App has been deployed to Vercel and is working.
* GitHub default branch should be `main`.
* Future work must use `main` only.
* Do not push to `master`.

## Current Implemented Features

The app currently has:

* Vite React TypeScript app
* Tailwind CSS
* Tablet-first cashier UI
* Santara branding and slogan
* Menu categories and items
* Cart
* Quantity controls
* Checkout
* Cash, QRIS, Debit payment
* Cash paid amount and change calculation
* Transaction-level discount
* 58mm receipt preview
* Browser print
* Pending cart / hold orders
* Custom app modals, no browser prompt/confirm/alert
* Kelola Menu
* Add/edit menu
* Edit price
* Edit HPP
* Active/inactive menu
* Custom category dropdown
* HPP transaction snapshots
* Riwayat Struk
* Receipt detail
* Receipt reprint
* Import Data Lama
* CSV legacy sales import
* Legacy import preview and batch history
* Legacy sales included in reports and CSV/JSON report export
* Branch mismatch was fixed, latest work is on `main`

## Important Current Limitation

* Data is still localStorage-first and browser-local, so it is not ready as a multi-device production database.
* Supabase autosync exists, but localStorage remains the first safety layer while cloud setup is tested.
* There is no Google Sheets sync yet.

## Phase 5A Supabase Preparation

What exists:

* `@supabase/supabase-js` dependency is installed.
* `.env.example` documents the required Supabase environment variables.
* `src/lib/supabase.ts` creates a safe Supabase client only when env variables exist.
* `supabase/migrations/20260614000100_santara_pos_schema.sql` prepares tables for profiles, menu categories, menu items, transactions, transaction items, pending orders, pending order items, and app settings.
* RLS is enabled in the migration with simple authenticated-user policies for planning/testing.
* `SUPABASE_SETUP.md` explains setup steps for beginners.

What is still not implemented:

* The app has not replaced localStorage persistence yet.
* Phase 5B added autosync after this planning phase.
* Phase 5C added login/auth and safer role policies after this planning phase.
* Phase 6 added legacy import after this planning phase.
* No Google Sheets sync, expenses, shift closing, or Excel export exists yet.

## Phase 5B Supabase Autosync

What exists:

* A local sync queue stores pending Supabase operations in localStorage.
* Important changes autosync when Supabase is configured: menu edits, completed transactions, pending order changes, and receipt counter updates.
* The app retries sync on load, when the browser comes back online, and when the compact `Sync Sekarang` button is clicked.
* Cloud data is pulled automatically on app load after pending local sync operations are processed.
* The header has a compact sync status indicator: Lokal, Tersinkron, Menyinkronkan, Menunggu, or Error.
* `supabase/migrations/20260614000200_santara_pos_phase5b_sync_policies.sql` adds temporary anon-key policies so autosync can work before auth exists.

What is still not implemented:

* Phase 5C added login/auth UI after this autosync phase.
* Phase 5C replaced the temporary anon policies with authenticated role policies.
* No complex conflict resolution exists yet.
* Phase 6 added legacy import after this autosync phase.
* No Google Sheets sync, expenses, shift closing, realtime subscriptions, or Excel export exists yet.

## Phase 5C Supabase Auth and Role Policies

What exists:

* A Supabase login screen appears when Supabase environment variables are configured.
* If Supabase is not configured, the app continues safely in local/demo mode.
* The compact sync status shows `Login diperlukan` until a staff user logs in.
* Logged-in sync uses Supabase Auth instead of anon table writes.
* Owner/admin can access Kasir, Kelola Menu, Riwayat Struk, Laporan, and Data Lokal.
* Cashier can access Kasir and Riwayat Struk only.
* `supabase/migrations/20260614000300_santara_pos_auth_policies.sql` removes Phase 5B anon policies and adds authenticated role policies.
* `SUPABASE_SETUP.md` documents how to create a Supabase Auth user and owner profile.

What is still not implemented:

* No complex user management UI exists yet.
* Phase 6 added legacy import after this auth phase.
* No Google Sheets sync, expenses, shift closing, realtime subscriptions, or Excel export exists yet.

## Phase 6 Legacy Sales Import

What exists:

* Owner/admin can access `Import Data Lama`.
* Cashier cannot access the legacy import tab.
* CSV import supports flexible columns for date/tanggal, menu/nama menu, category/kategori, qty/jumlah, gross sales/penjualan kotor, discount/diskon, net sales/penjualan bersih, HPP/COGS, payment method/metode pembayaran, and notes/catatan.
* Import preview shows total rows, gross sales, discount, net sales, HPP, and row warnings before saving.
* Import batch history stores file name, import time, total rows, date range, and total net sales.
* Duplicate-like imports show a custom confirmation modal.
* Legacy sales persist in localStorage and are queued for Supabase autosync.
* `supabase/migrations/20260614000400_santara_pos_legacy_sales.sql` adds `legacy_import_batches` and `legacy_sales`.
* Reports include POS transactions plus legacy imported sales by default.
* Report CSV/JSON exports include legacy imported sales.
* Legacy sales do not appear as normal receipt history.

What is still not implemented:

* No XLSX import exists yet.
* No Google Sheets sync exists yet.
* No expenses, shift closing, realtime subscriptions, or complex accounting exists yet.

## Next Recommended Phase

The next phase should be:

Phase 6B - Legacy Import Real CSV Testing

Goal:

* Test the import screen with a real CSV from the old POS.
* Adjust column aliases only if the old POS uses unexpected headings.
* Confirm imported rows appear correctly in Hari Ini, Pilih Tanggal, Bulan Ini, and Semua Waktu reports.
* Confirm Supabase sync stores legacy import batches and legacy sales.

## Future Roadmap

Phase 4 - Reports

* Daily report
* Monthly report
* All-time report
* Gross sales
* Discount
* Net sales
* HPP
* Gross profit
* Gross margin
* Expenses later
* Net profit later
* Payment summary
* Menu sales summary
* Best seller

Phase 5 - Legacy Sales Import

* Import old POS sales from CSV/XLSX
* Include legacy data in all-time reports

Phase 6 - Export and Google Sheets Sync

* Export CSV/XLSX
* One-click sync to Google Sheets

Phase 7 - Supabase/database

* Auth
* Persist real operational data
* Roles: owner/admin/cashier

## Rules for Future Codex Tasks

* Always read `PROJECT_BRIEF.md` and `PROJECT_STATUS.md` before coding.
* Always work only on `main`.
* Never push to `master`.
* Always run build before and after changes.
* Always create/check a safe checkpoint before changes.
* Do not implement more than one phase at a time.
* Keep cashier UI simple.
* Do not add complicated inventory, membership, coupon, or promo automation unless requested.
* Preserve receipt print CSS.
* Preserve warm Santara UI style.
* Prefer small safe commits.

## Recommended Prompt Header for Future Tasks

“Work only in `Ferdian-99/santara-pos`.
Use branch `main` only.
Do not push to `master`.
Do not touch any other repository.
Read `PROJECT_BRIEF.md` and `PROJECT_STATUS.md` first.
Before changes, run git status, git pull origin main, and npm.cmd run build.
Do not continue if build fails or working tree is not clean.
Implement only the requested phase.
After changes, run npm.cmd run build, commit, and push to origin/main.”
