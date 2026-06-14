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
* Pengeluaran tab for owner/admin
* Expense local persistence and Supabase sync queue
* Reports include expenses, net profit, and net margin
* Simple daily closing inside Laporan
* Google Sheets sync via Apps Script Web App URL
* Branch mismatch was fixed, latest work is on `main`

## Important Current Limitation

* Data is still localStorage-first and browser-local, so it is not ready as a multi-device production database.
* Supabase autosync exists, but localStorage remains the first safety layer while cloud setup is tested.
* Google Sheets sync uses a simple Apps Script endpoint, not Google OAuth.

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
* Phase 7 added expenses, simple daily closing, and Google Sheets Apps Script sync after this legacy import phase.
* No realtime subscriptions or complex accounting exists yet.

## Phase 7 Expenses, Closing, and Google Sheets Sync

What exists:

* Owner/admin can access `Pengeluaran`.
* Cashier cannot access the expense screen.
* Expenses are stored in localStorage and queued for Supabase autosync.
* Expenses support date, name, category, amount, payment method, notes, edit, and delete.
* `Laporan` includes total expenses, net profit, and net margin.
* Report CSV/JSON export includes expense summary, expense list, and daily closing data.
* `Closing Harian` can save a simple daily closing for Hari Ini or Pilih Tanggal.
* Daily closing stores sales, HPP, expenses, net profit, payment summary, expected cash, actual cash, cash difference, and notes.
* Google Sheets sync uses an Apps Script Web App URL saved in the app.
* `GOOGLE_SHEETS_SYNC.md` documents the Apps Script setup for beginners.
* `supabase/migrations/20260614000500_santara_pos_expenses_closing.sql` adds expenses, daily closings, Google Sheet sync settings, and Google Sheet sync logs.

What is still not implemented:

* No Google OAuth or direct Google API client exists.
* No XLSX export exists yet.
* No expense approval workflow exists.
* No shift closing with cashier handover exists.
* No realtime subscriptions or complex accounting exists yet.

## Next Recommended Phase

The next phase should be:

Phase 7B - Production Sync Testing

Goal:

* Run the new Supabase migration in production.
* Test owner/admin expense create, edit, delete, and sync.
* Test daily closing with real daily totals.
* Deploy Apps Script and test Google Sheets sync from Vercel.
* Confirm reports and exports include expenses and closing data.

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
