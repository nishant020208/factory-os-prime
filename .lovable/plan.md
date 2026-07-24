This is a large multi-part refactor. I'll ship it in ordered phases so you can review each before I move on. All existing UI, animations, tables, and RLS stay intact — I'm layering scoping and eventing on top.

## Phase 1 — Role scoping & Root Super Admin isolation

**Nav config becomes role-driven** (`src/components/nav-config.ts`)
- Replace the single flat nav with `NAV_BY_ROLE: Record<AppRole, NavItem[]>` matching the sidebars you listed (Company Admin, Plant Admin, Plant Manager, Production Manager, Warehouse Manager, Procurement Manager, Quality Inspector, Maintenance Engineer, Finance Manager, HR Manager, Production Operator, Customer, Supplier, Auditor, Root Super Admin).
- `AppShell` picks the current user's highest-priority role from `useAuth().roles` and renders only that sidebar.

**Route guard by role** (new `src/lib/route-access.ts` + update `_authenticated/route.tsx`)
- Map every route path → allowed roles.
- In `beforeLoad`, after `getUser()`, load roles and `throw redirect({ to: '/' })` (their own dashboard) if the path isn't allowed. Root Super Admin trying to hit `/inventory` etc. bounces to `/platform`.

**Root Super Admin console** (new routes under `src/routes/_authenticated/platform/*`)
- `platform/index.tsx` — platform overview (companies count, pending requests, MRR-style placeholders using live counts).
- `platform/whitelist.tsx` — whitelist Company Admins (reuses existing whitelist table filtered to `role = 'company_admin'`).
- `platform/pending.tsx`, `platform/companies.tsx` (approved), `platform/suspended.tsx` — company management with Approve / Suspend / Activate / Delete actions.
- `platform/audit.tsx` — platform-wide audit logs.
- `platform/settings.tsx`, `platform/profile.tsx`.
- Root Super Admin's sidebar shows ONLY these. All ERP modules are hidden and blocked at the route guard.

**Per-role dashboards** (`src/routes/_authenticated/dashboard.tsx` becomes a router)
- Split into role-specific dashboard components: `PlantManagerDashboard`, `ProductionManagerDashboard`, `WarehouseDashboard`, `ProcurementDashboard`, `QualityDashboard`, `MaintenanceDashboard`, `FinanceDashboard`, `HRDashboard`, `OperatorDashboard`, `CustomerDashboard`, `SupplierDashboard`, `AuditorDashboard`, `CompanyAdminDashboard`. Each shows only KPIs/widgets relevant to that role, all fed by live Supabase queries.

## Phase 2 — Company isolation hardening

- Audit every table for `company_id` and every RLS policy for `company_id = current_company_id()`.
- Add a `withCompany()` helper that asserts `companyId` from `useAuth` is present before any insert/update; server-side, keep relying on RLS + `current_company_id()`.
- Add missing `company_id` filter on any client query that currently does bare `.select("*")`.

## Phase 3 — Event-driven interconnection

New `src/lib/events.ts` — a lightweight typed event bus over Supabase Realtime + a local pub/sub for UI invalidation.

- Whenever a mutation completes (production order status change, PO received, quality fail, machine breakdown, employee added, etc.), it:
  1. Writes the row.
  2. Inserts an `audit_logs` row (already exists).
  3. Publishes an event via a new `events` table (or via Realtime channels on the source table).
  4. React Query invalidates related keys via a subscription registered in `__root.tsx`.

- Cross-module reactions run as Postgres triggers on the relevant tables, e.g.:
  - `production_orders` insert with `status='completed'` → increment `inventory` for the finished-goods SKU + insert a `notifications` row.
  - `inventory` update where `quantity < reorder_level` → insert `notifications` row targeted at procurement.
  - `machines.status = 'breakdown'` → insert maintenance work order + notification.
  - `purchase_orders.status = 'received'` → bump `inventory` + finance AP entry (placeholder row).

- Realtime subscriptions in `__root.tsx` listen to `notifications`, `audit_logs`, and each user's `company_id`-scoped changes, and call `queryClient.invalidateQueries()` on the affected keys so every open dashboard/report refreshes without manual reload.

## Phase 4 — Verification

- Playwright script that signs in as each demo role (root, company_admin, plant_manager, operator, customer, supplier, auditor), screenshots the sidebar, and asserts blocked routes redirect. Report a matrix in chat.
- Run `supabase--linter` after migrations.

## Scope notes

- I'm not creating brand-new "Knowledge Center", "BOM", "Recruitment", "Payroll" tables/pages in this pass — those would each need their own build. The sidebars will link to placeholder pages with "Coming soon" panels using the existing PageHeader/Panel design so nothing is broken, and I'll flag which ones are stubs vs. wired.
- If you'd rather I ALSO build out full CRUD for the new stub pages (BOM, Recruitment, Payroll, Knowledge Center, RFQ, CAPA, etc.), say the word and I'll do that as Phase 5 in a follow-up turn — it's another large chunk.

Approve and I'll start with Phase 1.