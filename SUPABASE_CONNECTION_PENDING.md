# Supabase Connection Pending

This file is the complete handoff checklist for the "final Codex phase" — connecting the Event Operations workflow (Steps 1-18) to the real Supabase database. Nothing described as working in the app today touches Supabase for this workflow; every module below runs against local/mocked state by explicit instruction, and this file is the spec for replacing each mock with the real thing. Do not treat anything in this file as "connect Supabase later" — every module lists the exact tables, columns, keys, statuses, CRUD paths, permission rules, storage, realtime and notification requirements, what currently stands in for each, and the precise work left to do.

Organized into the 20 modules of the Event Operations workflow, in pipeline order.

## How to read a module

Each module lists: Tables required · Columns/fields · Primary keys · Foreign keys/relationships · Status values · CRUD operations · Permission/RLS requirements · File storage requirements · Realtime requirements · Notifications · Currently mocked/static/local data · Exact implementation still required.

## Baseline finding that shapes every module below (read first)

The existing database is **single-owner**: every business table (`customers`, `staff_members`, `products`, `packages`, `package_items`, `bookings`, `booking_items`, `booking_payments`, `rental_returns`, `booking_activity`) has an `owner_id uuid references auth.users(id)`, and RLS policies are generated as `auth.uid() = owner_id` for select/insert/update. That model assumes one authenticated user (the business owner). Staff will be **separate `auth.users` rows** with their own uid, which is not equal to any `owner_id` — under today's policies a staff login would see zero rows.

Resolution (least disruptive — do not touch or replace the existing owner policies): add new, additional RLS policies scoped by role/department/assignment for staff, layered on top of the existing owner-only policies (`OR`-style — the owner keeps seeing everything exactly as today; a second policy grants a staff row visibility when their profile/department matches). A `public.profiles.role` column (`admin` | `staff`) plus a way to resolve "which owner does this staff belong to" (staff always belong to the one business owner who created their login) is required so policies can check both facts. Every module's RLS section below builds on this same pattern.

Existing pieces to REUSE rather than duplicate:
- `staff_members` (name, phone, is_active) — extend with login/department columns, don't replace.
- The "modifications" feature already exists as a notes-marker parsed off `bookings.notes` (`lib/modifications.ts`, `components/modifications/modification-queue.tsx`) — not part of this workflow, left untouched throughout Steps 1-18.
- `rental_returns` + `process_rental_return()` RPC already record one summary return per **rental** booking. Modules 13-15 (Collection/Return QC/Return Warehouse) should feed itemized detail into this existing flow (a new child table linked to `booking_items`) rather than creating a second, competing "return" concept. **Open question, still not resolved with the user**: `process_rental_return` and the pickup/due-date fields only apply where `booking_type = 'rental'` — decide whether the Collection → Return QC → Return Warehouse leg applies to rentals only or to sale bookings too.
- `create_booking`, `change_booking_status`, `record_booking_payment`, `process_rental_return` are existing SECURITY INVOKER RPC functions called via `.rpc()` from the client — every new workflow action below (advance a stage, submit QC, approve a stylist, close event, credit performance) should follow this same RPC pattern, not raw table writes from the client where a business rule needs enforcing.
- Quotes are `bookings` rows with `is_quote = true`, not a separate table. "Booking Confirmed" (the Central Event Job trigger) = a non-quote booking whose status is moved to `confirmed` via `change_booking_status`.

---

## Module 1 — Authentication

- **Tables required**: alter `public.profiles` (add `role`); no other new table — staff authentication reuses `auth.users` via synthetic-email accounts, same as the admin owner today.
- **Columns/fields**: `profiles.role text not null default 'admin' check (role in ('admin','staff'))`.
- **Primary keys**: `profiles.id` (already `= auth.users.id`), unchanged.
- **Foreign keys/relationships**: `profiles.id → auth.users.id` (existing, 1:1). A staff `auth.users` row is linked onward to `staff_members.user_id` (see Module 2).
- **Status values**: none beyond the `role` enum above.
- **CRUD operations**: `role` is set once at account creation (admin owner = `'admin'` by default/unchanged; a staff login is provisioned with `role = 'staff'`) and never edited by the account holder — only by the admin owner via Module 4's provisioning flow.
- **Permission/RLS requirements**: only a `security definer` Route Handler using `SUPABASE_SERVICE_ROLE_KEY` may create a staff `auth.users` row or set `role = 'staff'`; a user may read their own `profiles.role` but never write it.
- **File storage requirements**: none.
- **Realtime requirements**: none.
- **Notifications**: none.
- **Currently mocked/static/local data**: the ENTIRE staff auth layer is mocked. `lib/staff-portal/mock-store.ts` reads/writes `lib/staff-portal/mock-staff-accounts.json` with PLAINTEXT passwords (commented as disposable). `lib/staff-portal/session.ts` sets a plain httpOnly cookie (`sw_staff_session`, just the mock account id — not signed/verified) instead of a real Supabase session. `lib/supabase/middleware.ts` only checks that cookie's presence (Edge-safe), not validity. There is NO `profiles.role` column yet — admin vs staff is determined entirely by which portal you're in (Supabase-authed = admin, mock-cookie = staff), never a real role check. 6 demo accounts are seeded for testing (see Module 2), none linked to real `auth.users` rows.
- **Exact implementation still required**: add the `profiles.role` migration; build a server Route Handler (`supabase.auth.admin.createUser` / `updateUserById` / `deleteUser`) that provisions/disables a staff login with a synthetic email (e.g. `<login_id>@staff.internal`); replace `lib/staff-portal/session.ts` with real `supabase.auth.getUser()`, keeping the exported `StaffSession` shape identical so every page using `requireDepartment()` needs no changes; update `lib/supabase/middleware.ts` to branch staff vs admin by `profiles.role` instead of cookie presence; delete `lib/staff-portal/mock-store.ts` and its JSON file once cut over.

## Module 2 — User/Staff

- **Tables required**: alter `public.staff_members` (add `user_id`, `login_id`, `portal_active`).
- **Columns/fields**: `staff_members.user_id uuid references auth.users(id)` (nullable until a login is created), `staff_members.login_id text unique`, `staff_members.portal_active boolean not null default false`. Existing `name`, `phone`, `is_active` columns unchanged.
- **Primary keys**: `staff_members.id` (existing, unchanged).
- **Foreign keys/relationships**: `staff_members.user_id → auth.users.id` (1:1, nullable); `staff_members.owner_id → auth.users.id` (existing, unchanged — a staff row still belongs to the one business owner who created it).
- **Status values**: `portal_active` (boolean: has a usable login) is independent of the existing `is_active` (boolean: shown in the staff directory at all) — a staff member can be an active directory entry with no portal login yet.
- **CRUD operations**: directory create/edit exactly as today (unchanged `/staff` page, admin-only); `user_id`/`login_id`/`portal_active` are set only through Module 4's Manage Access flow, never edited directly on the directory record.
- **Permission/RLS requirements**: existing owner-only RLS (`auth.uid() = owner_id`) is unchanged for directory reads/writes; a staff `auth.users` row may additionally `select` its own `staff_members` row (`user_id = auth.uid()`) once Module 1's staff auth exists.
- **File storage requirements**: none.
- **Realtime requirements**: none.
- **Notifications**: none.
- **Currently mocked/static/local data**: 6 demo accounts seeded in `lib/staff-portal/mock-staff-accounts.json` for testing — `booking1`/`booking123`, `warehouse1`/`warehouse123`, `qc1`/`qc123456`, `stylist1`/`stylist123`, `collection1`/`collection123` (collection + modification departments), `disabled1`/`disabled123` (deactivated, proves disabled accounts are rejected at login). None are linked to real `staff_members` rows yet — the mock layer is entirely separate from the real staff directory.
- **Exact implementation still required**: the `staff_members` migration above; the Manage Access provisioning flow (Module 4) must optionally link a new login to an existing `staff_members` row (or create one) instead of the mock layer's disconnected account list.

## Module 3 — Departments/Roles

- **Tables required**: new `public.staff_departments` (staff can hold more than one department).
- **Columns/fields**: `staff_departments.staff_id uuid`, `staff_departments.department text check (department in ('booking','warehouse','qc','stylist','collection','modification'))`, `staff_departments.granted_at timestamptz not null default now()`, `staff_departments.granted_by uuid references auth.users(id)`.
- **Primary keys**: composite `primary key (staff_id, department)` (a staff member holds each department at most once).
- **Foreign keys/relationships**: `staff_departments.staff_id → staff_members.id` (1:many — one staff member, many department rows).
- **Status values**: none beyond the department enum above; presence of a row = granted, absence = not granted (no separate "revoked" state — revoking deletes the row, per the existing mock behavior, so history of past grants is not kept at this layer — see Module 18 for how the grant/revoke action itself is still recorded in Activity History).
- **CRUD operations**: insert/delete only via Module 4's Manage Access admin flow.
- **Permission/RLS requirements**: only `profiles.role = 'admin'` (scoped to their own staff, via `staff_members.owner_id = auth.uid()`) may insert/delete; a staff auth user may `select` only their own rows (`staff_id in (select id from staff_members where user_id = auth.uid())`).
- **File storage requirements**: none.
- **Realtime requirements**: none required for v1 — a staff member's department grants only need to be current the next time they load the portal (already how the mock layer behaves, since the session is re-read per request).
- **Notifications**: none.
- **Currently mocked/static/local data**: department grants live as a plain array (`departments: StaffDepartment[]`) on each mock account object in `lib/staff-portal/mock-staff-accounts.json`, toggled by admin checkboxes in the Manage Access tab.
- **Exact implementation still required**: the migration above; each toggle in Manage Access becomes an insert/delete against `staff_departments` instead of an array mutation.

## Module 4 — Manage Access

- **Tables required**: none beyond Modules 1-3 — this is a UI/action layer over `staff_members` + `staff_departments` + the Supabase Auth admin API.
- **Columns/fields**: exposed in the UI: login ID, temporary/reset password (write-only — never stored or read back in plaintext by the app; Supabase Auth stores only the hash), department multi-select, active/inactive toggle (`portal_active`).
- **Primary keys**: n/a (uses existing tables' keys).
- **Foreign keys/relationships**: extends the existing `/staff` admin page (staff directory) as a second tab, per the "reuse existing UI" rule — not a new nav item.
- **Status values**: n/a.
- **CRUD operations**: create login (optionally linked to an existing `staff_members` row or creating a new one), reset password, change department grants, enable/disable portal access — all admin-only, all server-side.
- **Permission/RLS requirements**: `profiles.role = 'admin'` only, enforced both in the Route Handler and by RLS on `staff_departments`/`staff_members`.
- **File storage requirements**: none.
- **Realtime requirements**: none.
- **Notifications**: none.
- **Currently mocked/static/local data**: fully built and working against the mock store — admin can create a portal login, toggle each of the 6 departments on/off per account, disable/enable the whole account, and reset its password, as a "Manage access" tab on the existing `/staff` page next to the untouched staff directory. All writes go through Server Actions in `app/staff/portal-access-actions.ts` into the local JSON file — nothing touches Supabase.
- **Exact implementation still required**: wire `app/staff/portal-access-actions.ts` to the Route Handler from Module 1 and the `staff_departments` CRUD from Module 3, once approved to connect; the UI itself needs no redesign.

## Module 5 — Booking

- **Tables required**: none new — this module documents the EXISTING real tables the Event Operations workflow reads from and is triggered by: `bookings`, `booking_items`, `booking_payments`, `customers`.
- **Columns/fields used by this workflow**: `bookings.id`, `booking_number`, `is_quote`, `status`, `booking_type` (`rental`/`sale`), `event_date`, `venue`, `customer_id`, and the payment snapshot columns now read for Module 16 — `total`, `paid_amount`, `balance_amount`, `security_deposit`, `payment_status`; `booking_items.*` (product/quantity detail the Warehouse/QC stages are seeded from); `customers.name`/`phone` for display.
- **Primary keys**: `bookings.id`, `booking_items.id` (existing, unchanged).
- **Foreign keys/relationships**: `bookings.customer_id → customers.id`, `booking_items.booking_id → bookings.id` (existing, unchanged); new: `event_jobs.booking_id → bookings.id` (Module 6, 1:1).
- **Status values**: existing `bookings.status` enum, unchanged by this workflow — the Event Job's own `status` (Module 6) is a parallel, separate value; closing an Event Job does not currently write back to `bookings.status` (flagged below).
- **CRUD operations**: booking creation/confirmation/payment are entirely the EXISTING `create_booking` / `change_booking_status` / `record_booking_payment` RPCs — this workflow only reads booking data, it never writes to `bookings`/`booking_items`/`booking_payments` directly.
- **Permission/RLS requirements**: existing owner-only RLS, unchanged.
- **File storage requirements**: none.
- **Realtime requirements**: none required for v1.
- **Notifications**: none at this layer (see Module 6 for "booking confirmed → stylists notified").
- **Currently mocked/static/local data**: none — this is the one module already fully real. The admin `/event-jobs` list page's Supabase `.select()` was extended (Step 13) to also fetch `total, paid_amount, balance_amount, security_deposit, payment_status` so the new `paymentSummary` snapshot (Module 16) can be built from real data at sync time.
- **Exact implementation still required**: decide (not yet resolved) whether closing an Event Job (Module 17) should also transition `bookings.status` to a terminal value like `completed`, or whether the two statuses are intentionally kept independent; if the former, extend `close_event_job` to call the existing `change_booking_status` RPC internally rather than writing `bookings.status` directly.

## Module 6 — Central Event Job

- **Tables required**: new `public.event_jobs`; new `public.event_job_stages`.
- **Columns/fields**: `event_jobs`: `id`, `booking_id` (unique), `owner_id`, `job_number text` (derived from `bookings.booking_number`, e.g. `SW-S-2026-0001` → `JOB-2026-0001`, to avoid dual numbering), `status text check (status in ('active','closed'))`, `stylists_required_count integer not null default 1`, `payment_summary jsonb` (or normalized columns mirroring Module 16), `booking_final_check jsonb` (or normalized columns mirroring Module 17), `performance_credited boolean not null default false`, `created_at`, `closed_at`, `closed_by uuid references auth.users(id)`. `event_job_stages`: `id`, `event_job_id`, `stage text check (stage in ('warehouse_pick','quality_check','packing','stylist_opportunity','collection','return_quality_check','return_warehouse','booking_final_check'))`, `status text check (status in ('not_started','open','in_progress','done','blocked'))`, `assigned_staff_id` nullable, `opened_at`, `completed_at`, `completed_by`, `notes jsonb`.
- **Primary keys**: `event_jobs.id`; `event_job_stages.id` (with a unique constraint on `(event_job_id, stage)` since each job has exactly one row per stage).
- **Foreign keys/relationships**: `event_jobs.booking_id → bookings.id` (1:1, unique); `event_job_stages.event_job_id → event_jobs.id` (1:many — one job, 8 stage rows); `event_job_stages.assigned_staff_id → staff_members.id`.
- **Status values**: job: `active` | `closed` (see Module 17 for the closing transition and its guards). Stage: `not_started` | `open` | `in_progress` | `done` | `blocked`.
- **CRUD operations**: `event_jobs` + all 8 `event_job_stages` rows created together by a trigger/RPC (`open_event_job(booking_id)`) when `change_booking_status` moves a booking to `confirmed`, seeding `warehouse_pick` and `stylist_opportunity` open in parallel and the rest `not_started`; stage rows advanced only through stage-specific RPCs (Modules 7-15), never freeform client updates; `event_jobs.status` changed only by Module 17's `close_event_job`.
- **Permission/RLS requirements**: a staff row may `select`/`update` an `event_job_stages` row only when the stage's department matches one of their `staff_departments`, scoped to their owner's jobs; admin sees everything for their own `owner_id`, as today.
- **File storage requirements**: none at this module (see Module 8 for packing-proof photos).
- **Realtime requirements**: parallel stage opening and "job closed" visibility across every department are well suited to a Realtime subscription (`postgres_changes` on `event_job_stages`/`event_jobs`) so portals update live without polling — a genuine improvement, not required for a correct v1 (polling/refetch works).
- **Notifications**: "Booking confirmed → eligible Stylists see opportunity" (see Module 9) fires from this same creation step.
- **Currently mocked/static/local data**: fully built against a local JSON file (`lib/event-jobs/mock-event-jobs.json`), read/written by `lib/event-jobs/store.ts`. `syncEventJobs()` derives the Job ID from the real booking number, creates exactly one job per confirmed booking (duplicate-safe, checked by `bookingId`), and seeds all 8 stages with `warehouse_pick` + `stylist_opportunity` open in parallel. The sync only runs when the admin's `/event-jobs` page loads (the only page with a real Supabase session under current RLS) — it is NOT a live database trigger. Customer/venue/item detail is joined live from `bookings`/`booking_items` on the admin side each time, never duplicated into the job record; only `bookingNumber` is kept on the job record itself so the (mock-session) Staff Portal can show a human-readable reference. `DATA_FILE` supports an `EVENT_JOBS_DATA_FILE` env override, added purely to let this Step's automated end-to-end test run against a throwaway file — harmless and inert when unset, safe to leave in place or strip during the backend phase.
  - **Step 14 addition — Admin Master Event Job page**: `buildJobOverview(job)` in `lib/event-jobs/store.ts` is a pure function (no new table) that reduces the live job record into the "at a glance" rows (Booking/Warehouse/QC & Packing/Stylist/Travel/Event/Collection/Return QC/Return Warehouse/Settlement/Final Closure) shown on both the admin `/event-jobs/[id]` detail page and the Booking Final Check screen. `canCloseEventJob(job)` mirrors the real closing gate (Module 17) without mutating anything, purely to show/hide the Close Event action ahead of time. Both are pure reducers over the same mock `EventJob` record — once the record is a real row + real stage rows, these become straightforward SQL views or the equivalent server-side reducer over real data; no new schema is implied by the Master Event Job page itself.
- **Exact implementation still required**: the migration above; an `open_event_job(booking_id)` RPC (or trigger) that creates the job + seeds the parallel stages, following the existing `create_booking`-style pattern; port `buildJobOverview`/`canCloseEventJob` to read from real stage rows once they exist.

## Module 7 — Warehouse

- **Tables required**: reuses `event_job_stages` (stage = `warehouse_pick`); new `public.event_job_pick_items` (`event_job_stage_id`, `booking_item_id`, `prepared_quantity integer`, `unavailable_quantity integer`, `damaged_quantity integer`, `issue_note text`, `remarks text`).
- **Columns/fields**: see above; `completed_by`/`completed_at` live on the parent `event_job_stages` row.
- **Primary keys**: `event_job_pick_items.id`.
- **Foreign keys/relationships**: `event_job_pick_items.event_job_stage_id → event_job_stages.id`; `event_job_pick_items.booking_item_id → booking_items.id`.
- **Status values**: stage status only (Module 6's enum) — no separate per-item status beyond the quantity/issue fields.
- **CRUD operations**: warehouse-department staff insert/update their own job's pick items and call `complete_warehouse_stage(stage_id)`, which validates every item has a prepared quantity before flipping `warehouse_pick` to `done` and opening `quality_check`.
- **Permission/RLS requirements**: warehouse-department staff only, scoped to their owner's jobs.
- **File storage requirements**: none.
- **Realtime requirements**: none required for v1; stage completion opening `quality_check` should happen inside the same RPC/transaction, not via a separate realtime step.
- **Notifications**: "Warehouse completed → QC notified" (Module 19) fires from the same completion step.
- **Currently mocked/static/local data**: fully built in-theme against the mock layer. `app/staff-portal/warehouse/page.tsx` lists open/in-progress jobs; `app/staff-portal/warehouse/[jobId]/page.tsx` + `components/staff-portal/warehouse-prep-form.tsx` record, per item (snapshotted as `RequiredItem` on the job, NOT a live `booking_items` join — see Module 6's RLS limitation): prepared quantity, unavailable, damaged, other issue, remarks. `submitWarehousePreparation()` validates every item then marks the stage done and opens QC, and now also calls `notifyDepartment(job.id, 'qc', ...)` (Module 19). The full job stays `active` — warehouse can never close it.
- **Exact implementation still required**: the migration + `complete_warehouse_stage` RPC above; replace `submitWarehousePreparation()`'s JSON read/write with the RPC; replace the `RequiredItem` snapshot with a live `booking_items` join once staff RLS (Module 1/3) exists.

## Module 8 — QC & Packing

- **Tables required**: reuses `event_job_stages` (stage = `quality_check` and `packing`); new `public.event_job_qc_items` (`event_job_stage_id`, `booking_item_id`, `checked_quantity integer`, `good_quantity integer`, `issue_type text`, `remarks text`, `evidence_photo_url text`); new `public.event_job_packing_checklist` (`event_job_stage_id`, `safas_packed boolean`, `labels_applied boolean`, `count_verified boolean`, plus the remaining 3 of the 6 required checks, `proof_photo_url text not null before completion`).
- **Columns/fields**: see above.
- **Primary keys**: `event_job_qc_items.id`; `event_job_packing_checklist.event_job_stage_id` (1:1 with its stage, so the stage id can double as the primary key).
- **Foreign keys/relationships**: `event_job_qc_items.event_job_stage_id → event_job_stages.id`; `event_job_qc_items.booking_item_id → booking_items.id`; `event_job_packing_checklist.event_job_stage_id → event_job_stages.id`.
- **Status values**: stage status only (Module 6's enum); Packing cannot be `open`/`in_progress` until Quality Check's stage is `done` — enforced in the RPC, not just the UI.
- **CRUD operations**: qc-department staff submit per-item results via `submit_quality_check(stage_id, results)`, then the packing checklist + required photo via `complete_packing(stage_id, ...)`, which is rejected server-side unless QC is `done` and all 6 checks are true.
- **Permission/RLS requirements**: qc-department staff only.
- **File storage requirements**: a new Supabase Storage bucket (e.g. `packing-proofs`), owner-scoped folder structure, mirroring the existing `product-images` bucket pattern — needed for both the QC evidence photo and the packing proof photo.
- **Realtime requirements**: none required for v1.
- **Notifications**: none fire directly from this module today (Collection's opening is a separate notification, see Module 13) — Packing completion opening Collection could optionally notify the collection department once that stage exists structurally the same way warehouse→qc does, worth adding for symmetry during the backend phase.
- **Currently mocked/static/local data**: fully built in-theme against the mock layer, gated exactly as specified. `app/staff-portal/qc/page.tsx` lists jobs on `quality_check` or `packing`; `app/staff-portal/qc/[jobId]/page.tsx` shows `components/staff-portal/quality-check-form.tsx` (checked/good qty, issue type, remarks, evidence note — a TEXT PLACEHOLDER, not a real photo upload) until `submitQualityCheck()` completes it, then swaps in `components/staff-portal/packing-checklist-form.tsx` (6 required checks) until `submitPackingChecklist()` completes it. Both are enforced server-side in `lib/event-jobs/store.ts`. Neither ever resets `warehousePrep`, and neither closes the full Event Job.
- **Exact implementation still required**: the migration + Storage bucket + RPCs above; wire the evidence-note field to a real uploaded photo URL.

## Module 9 — Stylist Interest

- **Tables required**: new `public.event_job_stylist_interest` (`event_job_id`, `staff_id`, `status text check (status in ('interested','approved','rejected','backup'))`, `expressed_at`, `decided_at`, `decided_by`).
- **Columns/fields**: see above — this table is shared with Module 10 (Approval writes `status`/`decided_at`/`decided_by` on the same row Interest created).
- **Primary keys**: `event_job_stylist_interest.id`, unique on `(event_job_id, staff_id)` (one interest row per stylist per job).
- **Foreign keys/relationships**: `event_job_stylist_interest.event_job_id → event_jobs.id`; `event_job_stylist_interest.staff_id → staff_members.id`. Many stylists per job, many jobs per stylist (many:many via this table).
- **Status values**: `interested` (initial — see the assumption noted below) | `approved` | `rejected` | `backup`.
- **CRUD operations**: any `stylist`-department staff can insert their own `interested` row (idempotent — one per stylist per job) via `express_stylist_interest(job_id)`. Nothing else in this module writes `status` — that is Module 10 only.
- **Permission/RLS requirements**: stylist staff can read all open interest rows for jobs whose `stylist_opportunity` stage is `open` (to see the opportunity list) and their own interest rows; they can never update `status`.
- **File storage requirements**: none.
- **Realtime requirements**: the opportunity list benefits from realtime so all interested stylists see it update live as others express interest or admin decides; not required for a correct v1.
- **Notifications**: "Booking confirmed → eligible Stylists see opportunity" (Module 6's creation step notifies the whole `stylist` department, per Module 19).
- **Currently mocked/static/local data**: fully built against the mock layer. `app/staff-portal/stylist/page.tsx` lists jobs whose `stylist_opportunity` stage is open with an "I'm Interested" button (`expressStylistInterest()`); a stylist's own status then shows in place of the button. **Assumption made, not yet confirmed with the user**: the original spec listed 5 statuses (Interested, Pending Admin Approval, Approved, Rejected, Backup) but only 4 read as distinct outcomes, so "Interested" and "Pending Admin Approval" were collapsed into one backing status (`'interested'`), displayed to the stylist as "Interested — pending admin approval." The 4-value model can be split back into 5 if the user wants "Interested" shown separately from "Pending."
- **Exact implementation still required**: the migration + `express_stylist_interest` RPC above; decide with the user whether to keep the 4-status model or restore a distinct 5th status.

## Module 10 — Stylist Approval

- **Tables required**: none new — writes `status`/`decided_at`/`decided_by` on the same `event_job_stylist_interest` row from Module 9; reads/writes `event_jobs.stylists_required_count` (Module 6).
- **Columns/fields**: `event_job_stylist_interest.decided_at timestamptz`, `decided_by uuid references auth.users(id)`.
- **Primary keys**: n/a (shared table with Module 9).
- **Foreign keys/relationships**: n/a beyond Module 9's.
- **Status values**: transitions `interested → approved | rejected | backup`, admin-only, and (per the user's confirmation) reversible/re-decidable, with multiple approvals per job allowed.
- **CRUD operations**: `decide_stylist_interest(interest_id, decision)` — admin only, `security definer`/admin-checked so it is unreachable even by direct API call from a stylist session, not just hidden in the UI; `set_stylists_required_count(job_id, count)` — admin only.
- **Permission/RLS requirements**: only `profiles.role = 'admin'` may call `decide_stylist_interest`/`set_stylists_required_count` — this is the one rule the user emphasized must be structural, not just a hidden button, since "Stylist interest ≠ approval" and "Stylist cannot self-approve" are non-negotiable rules.
- **File storage requirements**: none.
- **Realtime requirements**: none required for v1.
- **Notifications**: "Stylist approved → Stylist sees assigned event" (Module 19) fires from this decision.
- **Currently mocked/static/local data**: fully built against the mock layer, including the admin-only approval boundary. `app/stylist-approvals/page.tsx` (admin-only, sidebar-linked) lists every job needing a stylist, lets the admin edit `stylistsRequiredCount`, and Approve/Reject/Backup each interest via `decideStylistInterest()` — that function is never imported by anything under `app/staff-portal/`, so a stylist has no code path to approve themselves (enforced structurally by import boundaries, matching the intended RLS boundary). When approvals reach the required count, `stylist_opportunity` auto-marks `done` (a defined end-state added beyond the original spec; never blocks or closes the full Event Job since it is a parallel track). The admin page also shows interested-count alongside approved/required and a visible (non-blocking) warning when approvals exceed `stylistsRequiredCount`, recorded as an explicit `stylist_approved_beyond_required` activity entry so the exception is auditable.
- **Exact implementation still required**: the RPCs above with the admin-only enforcement described; port the "approved beyond required" warning/activity entry to a real trigger or the RPC itself.

## Module 11 — Travel & Accommodation

- **Tables required**: new `public.stylist_travel_bookings`.
- **Columns/fields**: `event_job_stylist_interest_id` (→ Module 9/10), `leg_type text check (leg_type in ('onward','return'))`, `mode text`, `from_location text`, `to_location text`, `departure_at timestamptz`, `arrival_at timestamptz`, `ticket_reference text`, `ticket_file_url text`, `pickup_details text`, `accommodation_hotel text`, `accommodation_check_in date`, `accommodation_check_out date`, `accommodation_room_details text`, `cost numeric`, `created_by`, `created_at`.
- **Primary keys**: `stylist_travel_bookings.id`.
- **Foreign keys/relationships**: `stylist_travel_bookings.event_job_stylist_interest_id → event_job_stylist_interest.id` (1:many — one onward leg + one optional return leg per approved stylist, per the current form; the schema itself does not prevent more legs later).
- **Status values**: none beyond the interest row's `approved` status being a precondition — a plan cannot be saved for a non-approved stylist (enforced server-side).
- **CRUD operations**: admin-only full CRUD via `upsert_travel_plan(interest_id, ...)`, which refuses to save for a stylist whose interest isn't `approved`. Read-only for the stylist themselves (their own plan).
- **Permission/RLS requirements**: `profiles.role = 'admin'` only for writes, per the user's explicit "franchise admin only" instruction; the approved stylist may `select` their own row.
- **File storage requirements**: a new Supabase Storage bucket for the ticket file (not yet built — currently a text placeholder).
- **Realtime requirements**: none required.
- **Notifications**: none specified for this module beyond the stylist being able to view their plan on "My Assigned Events" (Module 12).
- **Currently mocked/static/local data**: fully built against the mock layer. Admin-only `app/travel/page.tsx` (lists every APPROVED stylist assignment across active jobs — never interested/rejected/backup) and `app/travel/[jobId]/[interestId]/page.tsx` (`components/travel/travel-plan-form.tsx`) record one onward + optional one return leg and accommodation detail. `upsertTravelPlan()` is admin-only by construction (only imported from `app/travel/actions.ts`) and refuses non-approved stylists. The stylist can VIEW (never edit) their own plan on "My Assigned Events" — no edit path for staff exists anywhere in the code. **Assumption made, not yet confirmed with the user**: there is no separate "Franchise Admin" role today — this page is reachable by any Supabase-authenticated admin, same as every other admin page; a narrower role would need a `profiles.role` value beyond `admin`/`staff` (e.g. `franchise_admin`).
- **Exact implementation still required**: the migration + admin-only screen wiring above; a Storage bucket for the ticket file; decide whether a distinct franchise-admin role is required.

## Module 12 — Event Execution

- **Tables required**: reuses `event_job_stylist_interest` (Module 9/10) as the anchor; new `public.event_job_stylist_execution` (`event_job_stylist_interest_id`, `action text check (action in ('reached_venue','start_work','complete_work'))`, `recorded_at timestamptz`).
- **Columns/fields**: see above.
- **Primary keys**: `event_job_stylist_execution.id`, unique on `(event_job_stylist_interest_id, action)` (each action recorded once).
- **Foreign keys/relationships**: `event_job_stylist_execution.event_job_stylist_interest_id → event_job_stylist_interest.id` (1:many, exactly 3 rows max per approved stylist assignment).
- **Status values**: the 3 actions must be recorded strictly in order — `reached_venue → start_work → complete_work` — enforced server-side (an out-of-order or repeated call is rejected), not just by disabling buttons in the UI.
- **CRUD operations**: `record_stylist_execution(interest_id, action)` — insert-only, approved-stylist-only, sequence-checked.
- **Permission/RLS requirements**: only the approved stylist themselves (`staff_id` matches their session) may record their own execution steps.
- **File storage requirements**: none.
- **Realtime requirements**: none required.
- **Notifications**: none specified.
- **Currently mocked/static/local data**: fully built against the mock layer as `stylistExecutions` entries on the job record. "My Assigned Events" (`app/staff-portal/stylist/assigned/page.tsx`) shows only jobs where the stylist has an `approved` interest, with sequential Reached Venue → Start Work → Complete Work actions; `recordStylistExecution()` enforces the `EXECUTION_ORDER` sequence and rejects an out-of-order or repeat call. **Assumption made, not yet confirmed with the user**: backup stylists do not appear on "My Assigned Events" at all — the brief says "Backup remains identifiable" but doesn't say backups should see the event as an assignment, so only `approved` interests match, not `backup`.
- **Exact implementation still required**: the migration + RPC above with the sequence guard; decide with the user whether backup stylists should see a clearly-labeled "you are backup" entry.

## Module 13 — Collection

- **Tables required**: reuses `event_job_stages` (stage = `collection`); new `public.event_job_collection_items` (`event_job_stage_id`, `booking_item_id`, `sent_quantity integer`, `returned_quantity integer`, `visible_damage boolean`, `wrong_product boolean`, `client_holding_item boolean`, `short_quantity_flag boolean`, `remarks text`, `evidence_photo_url text`).
- **Columns/fields**: see above; `missing_quantity` is intentionally NOT a stored column (see the assumption below).
- **Primary keys**: `event_job_collection_items.id`.
- **Foreign keys/relationships**: `event_job_collection_items.event_job_stage_id → event_job_stages.id`; `event_job_collection_items.booking_item_id → booking_items.id`.
- **Status values**: stage status only (Module 6's enum).
- **CRUD operations**: collection-department staff record per-item return condition, then `complete_collection_stage(stage_id)` marks `collection` `done` and opens `return_quality_check`.
- **Permission/RLS requirements**: collection-department staff only.
- **File storage requirements**: an evidence photo field is currently a text placeholder — needs the same Storage-bucket treatment as Module 8 if real photos are required.
- **Realtime requirements**: none required for v1.
- **Notifications**: "Collection completed → Return QC notified" (Module 19) fires from the same completion step.
- **Currently mocked/static/local data**: fully built against the mock layer — `app/staff-portal/collection/page.tsx` + `app/staff-portal/collection/[jobId]/page.tsx` + `components/staff-portal/collection-check-form.tsx`. Opens automatically once Packing completes. Per item, staff record sent quantity (pre-filled from Warehouse's actual prepared quantity), returned quantity, visible damage, wrong product, client holding item, a "short quantity" flag, remarks, and an evidence-note placeholder. `submitCollectionCheck()` marks the stage done and opens Return QC — it deliberately does NOT decide final client charges and does NOT write to any inventory table (there isn't one yet in this project). **Assumption made, not yet confirmed with the user**: the brief lists both a "Missing quantity" field and a separate "Short quantity" field, which read as overlapping (missing is naturally `sent − returned`), so `missingQuantity` was implemented as a COMPUTED value (shown in activity/summary text, never stored) while `shortQuantity` was kept as its own boolean flag staff can tick to call out a shortage explicitly.
- **Exact implementation still required**: the migration + RPC above; confirm the missing-vs-short-quantity split with the user; feeds damage/loss totals forward to Module 16.

## Module 14 — Return QC

- **Tables required**: reuses `event_job_stages` (stage = `return_quality_check`) and the SAME `event_job_qc_items` shape as Module 8, kept as a SEPARATE set of rows (different `event_job_stage_id`) so pre-event QC history is never overwritten.
- **Columns/fields**: `good_quantity`, `damaged_quantity`, `repair_required_quantity`, `unusable_quantity`, `remarks`, per item — pre-filled with the returned quantity from Module 13.
- **Primary keys**: `event_job_qc_items.id` (shared table with Module 8, differentiated by stage).
- **Foreign keys/relationships**: `event_job_qc_items.event_job_stage_id → event_job_stages.id` where `stage = 'return_quality_check'`.
- **Status values**: stage status only; validated so `good + damaged ≤ returned`.
- **CRUD operations**: qc-department staff submit via `submit_return_quality_check(stage_id, results)`, which marks `return_quality_check` `done` and opens `return_warehouse`.
- **Permission/RLS requirements**: qc-department staff only (same department as Module 8 — reuses the same screens, not a separate portal area, per the "departments are work areas, not new portals" rule).
- **File storage requirements**: same Storage-bucket need as Module 8 if evidence photos are required for returns too.
- **Realtime requirements**: none required for v1.
- **Notifications**: "Return QC completed → Return Warehouse notified" (Module 19) fires from the same completion step.
- **Currently mocked/static/local data**: fully built against the mock layer, in the SAME `app/staff-portal/qc/*` screens as Module 8 — `return_quality_check` opens automatically once Collection completes, never resets the pre-event `qualityCheck` record (kept as separate history on the job), and is itself its own `returnQualityCheck` field. `components/staff-portal/return-quality-check-form.tsx` records good/damaged/repair-required/unusable per item; `submitReturnQualityCheck()` validates `good + damaged ≤ returned`, marks the stage done, and opens Return Warehouse. Return QC never decides client payment — that stays with Module 17.
- **Exact implementation still required**: the migration + RPC above (reusing Module 8's table shape with a stage discriminator).

## Module 15 — Return Warehouse

- **Tables required**: reuses `event_job_stages` (stage = `return_warehouse`) and the SAME `event_job_pick_items` shape as Module 7, kept as a separate set of rows.
- **Columns/fields**: `usable_quantity`, `damaged_repair_quantity`, `missing_lost_quantity`, per item — pre-filled from Return QC's good/damaged split and Collection's sent-vs-returned gap.
- **Primary keys**: `event_job_pick_items.id` (shared table with Module 7, differentiated by stage).
- **Foreign keys/relationships**: `event_job_pick_items.event_job_stage_id → event_job_stages.id` where `stage = 'return_warehouse'`.
- **Status values**: stage status only.
- **CRUD operations**: warehouse-department staff confirm via `complete_return_warehouse_stage(stage_id, results)`, which marks `return_warehouse` `done` and opens `booking_final_check`.
- **Permission/RLS requirements**: warehouse-department staff only (same department as Module 7, same screens reused).
- **File storage requirements**: none.
- **Realtime requirements**: none required for v1.
- **Notifications**: "Return Warehouse completed → Booking receives Final Closure task" (Module 19) fires from the same completion step.
- **Currently mocked/static/local data**: fully built against the mock layer, in the SAME `app/staff-portal/warehouse/*` screens as Module 7 — `return_warehouse` opens automatically once Return QC completes. `components/staff-portal/return-warehouse-form.tsx` pre-fills usable/damaged-repair from Return QC's good/damaged split and missing/lost from Collection's sent-vs-returned gap, so staff confirm rather than re-type. `submitReturnWarehouseCheck()` marks the stage done and opens `booking_final_check`, and now also calls `notifyDepartment(job.id, 'booking', ...)` (Module 19). **Important limitation, flagged per the user's explicit instruction**: there is no real inventory/stock table anywhere in this project yet, so "don't automatically restock the full sent quantity" is trivially satisfied today (nothing restocks anything) — the real backend phase must wire `usable_quantity` into actual product stock (not the original sent quantity) and `damaged_repair_quantity`/`missing_lost_quantity` into whatever damage/loss ledger is decided for Module 16.
- **Exact implementation still required**: the migration + RPC above (reusing Module 7's table shape with a stage discriminator); wire real inventory disposition once a stock table exists.

## Module 16 — Payment/Settlement

- **Tables required**: none new for the snapshot itself — reads existing `bookings`/`booking_payments` columns (Module 5); new fields live on `event_jobs` (or a child `public.event_job_final_check` table if normalized columns are preferred over jsonb — either is acceptable, the shape below is the same either way).
- **Columns/fields**: snapshot copied onto the job at sync/close time — `total_amount`, `amount_received`, `pending_balance`, `deposit_amount`, `payment_status` (mirrors `bookings.total`/`paid_amount`/`balance_amount`/`security_deposit`/`payment_status`); plus, recorded only at closure: `additional_payment_amount numeric`, `refund_amount numeric`.
- **Primary keys**: n/a if stored as `jsonb` on `event_jobs`; otherwise `event_job_final_check.event_job_id` (1:1).
- **Foreign keys/relationships**: `event_job_id → event_jobs.id` if normalized.
- **Status values**: `payment_status` mirrors whatever enum `bookings.payment_status` already uses — not reinvented here.
- **CRUD operations**: the snapshot is written automatically whenever `syncEventJobs` refreshes a job from its booking (read-only mirror, never edited directly by staff); `additional_payment_amount`/`refund_amount` are written once, by Booking staff, as part of Module 17's close action — optionally also posted through the existing `record_booking_payment` RPC so the real payment ledger reflects it, not just the job snapshot (recommended, not yet decided).
- **Permission/RLS requirements**: booking-department staff (or admin) may read the full payment snapshot for a job in their scope; no staff department may edit `bookings`/`booking_payments` directly through this workflow — any real settlement should go through the existing payment RPC.
- **File storage requirements**: none.
- **Realtime requirements**: none required.
- **Notifications**: none directly — see Module 17 for the closure notification.
- **Currently mocked/static/local data**: fully built. `EventJob.paymentSummary` is populated at sync time from the booking's real Supabase payment columns (Module 5) — this is the one field on the mock job record that is NOT itself mocked, since it's copied from a live query. `EventJob.bookingFinalCheck` (additional payment / refund / notes / who / when) is recorded once, at close time, by `closeEventJob()`. The Booking Final Check screen (`app/staff-portal/booking/[jobId]/page.tsx`) renders a "Payment" card from `paymentSummary`, plus the additional-payment/refund fields once closed, and a "Damage / Missing" card computed from `collectionCheck`/`returnQualityCheck` item data (Modules 13-14).
- **Exact implementation still required**: decide whether `additional_payment_amount`/`refund_amount` should also post through `record_booking_payment` at close time (recommended so the real ledger and the job's settlement summary never diverge); normalize the snapshot into real columns/child table once `event_jobs` exists.

## Module 17 — Final Closure

- **Tables required**: none new beyond what's already on `event_jobs` (Module 6) — `status`, `closed_at`, `closed_by`, `performance_credited`.
- **Columns/fields**: `event_jobs.status = 'closed'`, `closed_at timestamptz`, `closed_by uuid references auth.users(id)`; the `booking_final_check` stage row (Module 6) is marked `done` in the same transaction.
- **Primary keys**: n/a (uses `event_jobs.id`).
- **Foreign keys/relationships**: n/a beyond Module 6's.
- **Status values**: `active → closed`, one-way, never reversed by this workflow (no "reopen" action exists or was requested).
- **CRUD operations**: a single `close_event_job(job_id, input)` RPC that validates, in order: the job exists and is not already `closed` (**duplicate-closure guard**); every required stage (`warehouse_pick, quality_check, packing, collection, return_quality_check, return_warehouse`) is `done`; if stylists were required, either the opportunity stage closed naturally or the approved count meets the required count; the `booking_final_check` stage is open/in-progress (not already done); there are no unresolved issues on the job; and the three booking checks (`payment_complete`, `deposit_settled`, `damage_loss_acknowledged`) are all true. Only on passing every check does it set `status = 'closed'`, `closed_at`, `closed_by`, and mark `booking_final_check` done.
- **Permission/RLS requirements**: **only** staff whose department includes `booking` (or admin) may call `close_event_job` — every other department must be rejected server-side, not merely hidden in the UI, since the user emphasized this rule twice ("No department can close the full Event Job", "Only authorised Booking staff can CLOSE EVENT"). Enforce via `security definer` + an explicit department check inside the function, mirroring how `decideStylistInterest` (Module 10) is structurally unreachable from the wrong portal today.
- **File storage requirements**: none.
- **Realtime requirements**: this is the one place realtime genuinely matters — every department that touched the job should see it move to "closed" in their own history without refreshing; a Realtime subscription on `event_jobs.status`, or at minimum each portal polling a `notifications`/activity feed, is worth prioritizing here.
- **Notifications**: "Event closed → participating staff can receive completion notification" (Module 19) — fires to every department that touched the job (warehouse, qc, collection, booking) plus each individually-approved stylist by account.
- **Currently mocked/static/local data**: fully built and exercised end-to-end (Step 18's automated test covers every guard, including the duplicate-closure rejection, below). `closeEventJobAction` (`app/staff-portal/booking/actions.ts`) calls `requireDepartment('booking')` before ever reaching `closeEventJob()` in the store — so a non-booking session cannot reach the action at all, matching the intended RLS boundary. `components/staff-portal/close-event-form.tsx` shows a locked message (via `canCloseEventJob`, Module 6) until every gate is satisfied, then three required checkboxes (payment complete / deposit settled / damage-loss acknowledged), additional-payment and refund numeric inputs, a notes field, and a destructive-styled "Close Event" button. A second close attempt on an already-closed job is rejected with an explicit "already closed" error (verified by the automated test).
- **Exact implementation still required**: the `close_event_job` RPC above with the department check enforced server-side (not just via `requireDepartment` in a Server Action, which is a Next.js-layer check, not a database-layer one); the Realtime subscription for live cross-department visibility.

## Module 18 — Activity History

- **Tables required**: new `public.event_job_activity` (append-only).
- **Columns/fields**: `event_job_id`, `actor text` (name/login of who performed the action), `department text` (`'admin'` for anything done from the Admin Portal, `'system'` for automated transitions, or a staff department for a Staff Portal action), `action text`, `details text` (relevant status/value change), `created_at timestamptz not null default now()`.
- **Primary keys**: `event_job_activity.id`.
- **Foreign keys/relationships**: `event_job_activity.event_job_id → event_jobs.id` (1:many — every entry belongs to exactly one Central Event Job, per the "same job ID throughout" rule; there is no cross-job activity feed).
- **Status values**: none — this is a log, append-only, never updated or deleted.
- **CRUD operations**: insert-only, called internally by every other module's RPC at the moment of the action it's logging (job created, warehouse/QC/packing/collection/return-QC/return-warehouse completed, stylist interest/approval/rejection/backup, travel added, event execution steps, issue added/resolved, final closure) — never a freeform client insert.
- **Permission/RLS requirements**: admin sees the full history for their own jobs; a staff member sees the full history of any job they have a stage assigned on (matches "Admin sees complete history / Staff see only permitted work" from the Step 18 validation requirement) — reading history is broader than editing a stage, so this is intentionally more permissive than the stage-level RLS in other modules.
- **File storage requirements**: none.
- **Realtime requirements**: pairs naturally with the same Realtime subscription proposed in Module 17, so the admin detail page's activity list updates live.
- **Notifications**: none directly — Module 19 is a distinct, filtered subset of "interesting" activity, not a mirror of the full log.
- **Currently mocked/static/local data**: fully built against the mock layer. Every mutating store function in `lib/event-jobs/store.ts` appends an `activityEntry(actor, department, action, details)` row to the job's in-memory `activity` array (job_created, warehouse/QC/packing/collection/return-QC/return-warehouse completed, stylist_interest_expressed, stylist decision incl. `stylist_approved_beyond_required`, travel_plan_saved, stylist execution steps, issue_added/issue_resolved, `event_job_closed`). `normalizeJob()` backfills the `department` field to `'system'` for any activity entry written before this field existed, so old mock records never crash newer reads. The admin `/event-jobs/[id]` detail page renders each entry as `actor (department) — action, details, timestamp`.
- **Exact implementation still required**: the migration above; convert every `activityEntry()` call site into an insert inside its corresponding RPC (same transaction as the state change it's logging, so the log can never drift from the actual state).

## Module 19 — Notifications

- **Tables required**: new `public.event_job_notifications`.
- **Columns/fields**: `event_job_id`, `recipient_department text` nullable, `recipient_account_id uuid` nullable references `auth.users(id)`, `message text`, `created_at timestamptz not null default now()`, `read_at timestamptz` nullable. Exactly one of `recipient_department`/`recipient_account_id` is set, never both, never neither (a `check` constraint should enforce this — the mock layer already enforces it in code).
- **Primary keys**: `event_job_notifications.id`.
- **Foreign keys/relationships**: `event_job_notifications.event_job_id → event_jobs.id`; `recipient_account_id → auth.users.id`.
- **Status values**: unread (`read_at is null`) / read (`read_at` set) — no other state.
- **CRUD operations**: inserted internally by the triggering module's RPC (never a freeform client insert); `mark_all_read(account_id)` — updates every unread row visible to that session's account/departments.
- **Permission/RLS requirements**: a staff session may `select`/`update read_at` only on rows where `recipient_account_id = auth.uid()` OR `recipient_department` is one of their active `staff_departments` — this is what keeps notifications "role/permission appropriate and not spammy," per the user's explicit requirement.
- **File storage requirements**: none.
- **Realtime requirements**: this module is the natural candidate for a live badge count (Realtime subscription or short poll interval) so the bell icon updates without a full page reload — not required for a correct v1 (the current mock layer recomputes the count on every server-rendered page load, which is correct but not live).
- **Notifications** (i.e., the trigger map this module exists to implement): Warehouse completed → QC department; Booking confirmed → Stylist department (whole department, since no specific stylist is known yet); Stylist approved → that one stylist's account; Collection completed → QC department; Return QC completed → Warehouse department; Return Warehouse completed → Booking department; Event closed → warehouse/qc/collection/booking departments plus each individually-approved stylist's account.
- **Currently mocked/static/local data**: fully built as a new fs-backed store (`lib/notifications/store.ts`, `lib/notifications/mock-notifications.json`), following the exact same JSON-file pattern as `lib/event-jobs/store.ts` (including an `EVENT_JOBS`-style `NOTIFICATIONS_DATA_FILE` env override added solely for the Step 18 automated test). `notifyDepartment(jobId, department, message)` and `notifyAccount(jobId, accountId, message)` are called from every trigger point listed above (see Modules 7, 9-10, 13-15, 17 for the exact call sites). `notificationsForSession`/`unreadCountForSession`/`markAllReadForSession` resolve the "one-or-the-other" targeting rule for the current session's account + active departments. `components/staff-portal/staff-portal-shell.tsx` shows a bell icon with an unread-count badge (capped display at "9+"); `app/staff-portal/notifications/page.tsx` lists them newest-first with unread ones tinted, and a "Mark all read" action.
- **Exact implementation still required**: the migration + check constraint above; convert every `notifyDepartment`/`notifyAccount` call site into an insert inside its triggering RPC; add the `check` constraint enforcing exactly-one-recipient at the database level (currently only enforced in application code).

## Module 20 — Performance Credit

- **Tables required**: new `public.staff_performance_credits`.
- **Columns/fields**: `identifier text` (staff account/id or a stable key like `stylist:acct-<id>`, `booking:<email>` — see the note below on why a compound key was used in the mock), `name text`, `department text`, `completed_job_ids text[]` (or a normalized child table `staff_performance_credit_jobs(credit_id, job_id)` if an array column is undesirable).
- **Primary keys**: `staff_performance_credits.identifier` (or `id` with a unique constraint on `identifier`, if a normalized child table is preferred for job ids).
- **Foreign keys/relationships**: conceptually `identifier → staff_members`/`auth.users`, but kept as a loosely-typed key in the mock because not every participant (e.g. a stylist keyed by account id, booking staff keyed by email) maps to the same identity column today — this should be tightened to a real `staff_id`/`user_id` foreign key once Module 1/2's real staff identity exists.
- **Status values**: none — a job id present in `completed_job_ids` means credited, absent means not; there is no partial/pending state.
- **CRUD operations**: `credit_performance(identifier, name, department, job_id)` — idempotent (only appends `job_id` if not already present); called only from inside `close_event_job` (Module 17), never directly by any client.
- **Permission/RLS requirements**: no staff department may write to this table directly — it is populated only by the server-side closure RPC; admin (and eventually each staff member, for their own row) may read it for future performance reporting.
- **File storage requirements**: none.
- **Realtime requirements**: none required.
- **Notifications**: none specified — this module is data-only, feeding a future reporting UI.
- **Currently mocked/static/local data**: fully built as a new fs-backed store (`lib/performance/store.ts`, `lib/performance/mock-performance-credits.json`). `closeEventJob()` calls `creditPerformance()` for every participant exactly once per job, guarded THREE ways so a participant is never double-counted: (1) the `job.status !== 'closed'` check in `closeEventJob` prevents the whole close-and-credit path from running twice; (2) a `job.performanceCredited` boolean is checked before the crediting block runs and set immediately after; (3) `creditPerformance()` itself only appends a job id if it isn't already in that identifier's `completed_job_ids`. Credited on a successful close: warehouse staff (`warehousePrep.completedBy`, `returnWarehouseCheck.completedBy`), qc staff (`qualityCheck.completedBy`, `packingChecklist.completedBy`, `returnQualityCheck.completedBy`), collection staff (`collectionCheck.completedBy`), each individually APPROVED stylist (never rejected or backup), and the booking staff who closed it. `app/performance/page.tsx` (admin, Supabase-authenticated) lists `listPerformanceCredits()` sorted by completed-event count. All three guards were exercised by the Step 18 automated test, including a repeated close attempt confirming the credited count never grows past one per participant per job.
- **Exact implementation still required**: the migration above; convert `creditPerformance()` calls into inserts/upserts inside the `close_event_job` RPC's own transaction (so crediting can never succeed independently of the closure it's tied to); tighten `identifier` into a real foreign key once every participant type has a stable identity column.

## Resolved (2026-09-05)

- Event Operations is connected to Supabase project `sqiljwblevjopdakqcsh` through migrations `20260906000000`, `20260906001000`, and `20260906002000`.
- Existing Event Job history was imported into `event_jobs` and `event_job_activity`; local mock stores were removed.
- Collection → Return QC → Return Warehouse applies to rental bookings only.
- Stylist interest uses four statuses: Interested, Approved, Rejected, and Backup.
- Travel remains available to the existing full Admin role; no separate Franchise Admin role was added.
- Missing quantity is computed from sent minus returned; Short Quantity remains a manual exception flag.
- Backup stylists appear in My Assigned Events with a clear backup label and cannot perform approved-stylist actions.
- Closing an Event Job completes the underlying booking.
- Final additional payments and refunds update the booking ledger and payment totals.

## Cross-cutting implementation notes

The Admin and Staff portals now share Supabase Auth. Staff authorization is resolved from `staff_members` and `staff_departments`, and department guards still protect direct route access as well as navigation visibility. The former cookie-only mock session and JSON-backed Event Job, notification, and performance stores have been removed.

The migrations were applied in dependency order: identity and department access, Event Jobs and operational records, collision-safe sale/rental Job IDs, and self-promotion protection. Runtime reads and writes now target the confirmed Supabase project.

**Step 18 end-to-end validation — result: all checks passed.** The exact scenario BK-2005 → JOB-2005 was run as a compiled-and-executed test (not just inspected) against the real `lib/event-jobs/store.ts`, `lib/notifications/store.ts`, and `lib/performance/store.ts` logic, covering: no duplicate Event Job on repeated sync; same Job ID used throughout (booking link, notifications, performance credits all keyed consistently); Warehouse/QC did not close the job; 7 stylists' interest reduced to exactly 3 approved + 1 backup, auto-closing the opportunity stage; travel plan accepted for an approved stylist and rejected for a non-approved one; stylist execution enforced strict step order; Collection → Return QC → Return Warehouse chained correctly while the pre-event Quality Check record stayed untouched and separate from Return QC throughout; Return Warehouse did not restore anything to stock (there is no stock table to restore to yet — flagged in Module 15); `canCloseEventJob` correctly reported not-ready then ready; closing was rejected with `paymentComplete: false` and succeeded once all three checks were satisfied; a second close attempt was rejected (duplicate-closure guard); performance credit landed exactly once each for warehouse, qc, collection, the approved stylist, and booking staff, did NOT land for the rejected or backup stylist, and did not grow on a repeated close attempt; the approved stylist and the qc department each received their expected notification. 46 assertions, 0 failures. Full project `tsc --noEmit` also passes with zero errors, and `git status --porcelain` shows only the files this build touched (plus the pre-existing, unrelated in-progress changes to `app/bookings/[id]/page.tsx`, `app/bookings/calendar/page.tsx`, and `components/modifications/modification-queue.tsx`, which are not part of this workflow and were not modified by it).

The seven workflow questions previously listed here were resolved with the user and are recorded in the **Resolved (2026-09-05)** section above.
