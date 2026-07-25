
Massive scope — I'll ship in ordered phases, each independently reviewable. Approve and I start Phase 1.

## Phase 1 — Data reset & 3-customer demo seed (foundational)

- Migration that:
  - Wipes existing generic demo rows for ABC Manufacturing (keep companies, plants, departments, whitelist, auth users, roles).
  - Seeds 3 realistic customers under ABC:
    - Kirloskar Pumps Pvt Ltd — Completed (delivered + invoiced + paid)
    - Bajaj Auto Components — Completed (delivered + invoiced + paid)
    - Tata Steel Precision Division — Production In Progress
  - For each customer: sales order → material reservation → PO to supplier → goods receipt → production order + work orders + machine assignment → quality inspection → finished goods → dispatch/shipment → invoice → payment → support tickets → documents → audit logs → notifications.
  - Adds missing tables needed for the lifecycle: `sales_orders`, `sales_order_items`, `work_orders`, `quality_inspections`, `shipments`, `invoices`, `payments`, `support_tickets`, `documents`, `bom`, `bom_items`, `attendance`, `payroll`, `tasks`, `approvals`. All with `company_id`, GRANTs, RLS scoped to `current_company_id()`, and `service_role` full access.
  - Adds Postgres triggers so a customer order automatically decrements inventory, creates PO recommendations on shortage, emits notifications, and writes audit logs.

## Phase 2 — Kill every stub, wire real UIs

Every route currently rendering `<StubModule>` gets replaced with a real module using the existing `ResourceView` / `PageHeader` / `Panel` / `Kpi` primitives. Each gets:
- Live Supabase query scoped to `company_id`
- Working New / Edit / Delete / Approve / Export (CSV + PDF via `jspdf`) / Print buttons
- Filters, search, sort, pagination
- Related-module cross-links (e.g. Sales Order → Production Order → Shipment → Invoice)

Modules covered: BOM, Work Orders, Sales, Dispatch, Shipments, Invoices, Payments, Customer Invoices, Support, Documents, Tasks, Approvals, Attendance, Payroll, Recruitment, Training, Performance, RFQ, Purchase Requests, Goods Receipt, Vendor Comparison, CAPA, Defects, Incoming/In-Process/Final Inspection, Schedules, Breakdowns, Spare Parts, Machine History, Cycle Count, Transfers, Receiving, Stock Movement, Production Planning, Capacity Planning, Scheduling, Production Logs, Issue Reporting, Assigned Work Orders, Assigned Machines, Budgets, Expenses, Taxes, Profit & Loss, Compliance, Knowledge Center, Plant Overview, Plant Performance, all `-reports` pages, Orders, Deliveries, Supplier POs/Invoices/Performance.

## Phase 3 — Interconnection & realtime (already partial)

- Extend `src/routes/__root.tsx` realtime subscriber to cover every new table so cross-module updates invalidate React Query keys instantly.
- Confirm triggers from Phase 1 fire correctly (linter + spot checks).
- Every dashboard (all 14 role dashboards + platform + executive) reads live counts from the seeded data — no random numbers.

## Phase 4 — Copilot upgrade + one-click login + polish

- One-click login: on `/auth`, each role card gets a "Sign in as demo" button that hits the seeded demo creds for that role (no typing).
- Platform Copilot: real natural-language handler backed by Lovable AI (`google/gemini-3.6-flash`) with tools for `navigate`, `create_purchase_order`, `list_low_inventory`, `summarize_today`. Available from every page via `Ctrl+K` and floating action.
- Tab transitions: preload on hover (`defaultPreload: "intent"`) + `defaultPreloadStaleTime: 0` + suspense-friendly loaders so navigation feels instant.
- Global export helper `src/lib/export.ts` (CSV/Excel via `xlsx`, PDF via `jspdf`, print via `window.print`).
- Remove the "Scaffolded / Interconnection / AI Copilot Available" status card from `stub-module.tsx` (moot once stubs are gone; kept only as a fallback that renders nothing user-visible).

## Phase 5 — QA matrix

- Playwright script signs in as each role, screenshots the dashboard + 2 module pages, asserts no empty states and no stub markers. Report table in chat.
- Run `supabase--linter`, fix findings related to new tables.
- Verify Company A ≠ Company B isolation with a second seeded tenant probe.

## Technical notes

- Frontend-only tables use existing `resource-view` + `ui-parts`; no new component libraries.
- New npm deps: `xlsx`, `jspdf`, `jspdf-autotable`, `qrcode.react`.
- All migrations follow: CREATE TABLE → GRANT authenticated + service_role → ENABLE RLS → POLICY (`company_id = current_company_id()`).
- Copilot lives in a server function `src/lib/copilot.functions.ts` using `requireSupabaseAuth` so it reads the caller's tenant only.

## Scope check before I start

Each phase is a large single turn. Options:

1. **Approve as-is** — I run Phase 1 next turn (schema + seed), then message you for the go-ahead on Phase 2.
2. **Squeeze order** — e.g. do Phase 4's one-click login + tab-preload first (fastest visible wins), then Phase 1.
3. **Trim** — drop any modules you don't care about for the demo so Phase 2 stays under one turn.

Which?
