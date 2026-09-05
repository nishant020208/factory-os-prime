# FactoryOS AI — Complete Application Guide

Everything the app does, every workflow and sub-workflow, and which role owns
each piece. Written from the actual code (nav config, route access, RLS tests)
and the live database — not from intentions.

- **What it is:** a multi-tenant ERP for custom furniture manufacturers.
- **Stack:** TanStack Start (React + Vite) on the front, Supabase (Postgres +
  Auth + RLS) behind it, Vercel for hosting, Groq (primary) / Cerebras
  (fallback) for the AI Copilot.
- **Tenancy:** every company is isolated at the database level via
  Row-Level Security. A role never reads another company's rows — this is
  enforced in Postgres, not just hidden in the UI.
- **Demo company:** ABC Mfg (`abcmfg.demo` accounts, password
  `Factory@2026`), with a main plant (Chicago) and a second plant (Kochi).

---

## 1. The 15 roles and who they are

| Role | Account (demo) | Scope |
|---|---|---|
| Root Super Admin | `root@factoryos.demo` | The whole platform: company registrations, suspensions, platform audit. Never sees any company's operational data. |
| Company Admin | `admin@abcmfg.demo` | Full cross-module control of ONE company: master data, approvals, whitelist, everything. |
| Plant Admin | `plantadmin@abcmfg.demo` (Kochi: a separate test account) | One plant: its people, its orders, its whitelist for plant-level roles. |
| Plant Manager | `plantmanager@abcmfg.demo` | Oversight of one plant's day-to-day: production, machines, quality, stock. Read/monitor, not execute. |
| Production Manager | `production@abcmfg.demo` | Plans manufacturing: work orders, BOM, material checks, scheduling. |
| Production Operator | `operator@abcmfg.demo` | Executes assigned work orders, reports issues, own attendance only. |
| Warehouse Manager | `warehouse@abcmfg.demo` | Inventory, stock movement, transfers, receiving, dispatch, cycle counts. |
| Procurement Manager | `procurement@abcmfg.demo` | Purchase requests → RFQ → POs → goods receipt; supplier relationships. |
| Quality Inspector | `quality@abcmfg.demo` | Incoming, in-process and final inspections, defects, NCR, CAPA. |
| Maintenance Engineer | `maintenance@abcmfg.demo` | Machines, breakdowns, preventive schedules, spare parts. |
| Finance Manager | `finance@abcmfg.demo` | Invoices, payments, expenses, budgets, taxes, P&L. Company-wide (not plant-scoped). |
| HR Manager | `hr@abcmfg.demo` | Employees, attendance, leaves, recruitment, training, performance, payroll. |
| Customer (portal) | `customer@abcmfg.demo` | External: places orders against the product catalog, tracks shipments/invoices. |
| Supplier (portal) | `supplier@abcmfg.demo` | External: receives POs, quotes RFQs, manages own catalog prices, deliveries, invoices. |
| Auditor | `auditor@abcmfg.demo` | Read-only over everything in the company: audit logs, compliance, access logs, data export. |

Hierarchy: Root → whitelists Company Admin → whitelists Plant Admins and all
others. Plant Admin whitelists plant-level roles **for their plant only** and
cannot whitelist Finance Manager, Auditor, Root or another admin. Finance and
Auditor are deliberately company-wide, never plant-scoped.

Whitelisting works by email: the admin whitelists an address + role, the
person signs up with that email, and the account activates with the assigned
role. All sign-ins go through `/auth`, which offers role-quick-pick then
email/password.

---

## 2. Role-by-role workspaces

Each role has its own sidebar (defined in `src/components/nav-config.ts`,
enforced by `src/lib/route-access.ts` — direct URLs to another role's pages
redirect).

**Root Super Admin** — Platform dashboard, Admin Whitelist, Pending company
requests, Approved companies, Suspended, Platform Audit Logs, Security
Center, Reports, Platform Settings.

**Company Admin** — Overview (dashboard, company profile, plants,
departments, order approvals), Customers (requests, list), People (employees,
users & roles with role filter defaulting to All, whitelist, pending profile
requests), Operations (inventory, warehouse, production, products, BOM,
machines, maintenance, quality, QR codes), Commerce (procurement, suppliers,
CRM, finance, HR reports), Intelligence (reports, analytics, AI Center,
knowledge center).

**Plant Admin** — plant-scoped mirror: dashboard, plant overview, order
approvals for its plant, Customers tab (approve/invite customers whose
nearest plant is theirs), departments, employees, whitelist (plant roles
only), operations (production, warehouse, machines, quality, maintenance).

**Plant Manager** — plant performance, production schedule, work orders
(view), attendance, machine status, warehouse, maintenance, quality, reports.

**Production Manager** — approved orders, production planning (material
check + trigger procurement), production orders, work orders, BOM,
scheduling, capacity planning, QR codes, production reports.

**Warehouse Manager** — inventory, warehouses, stock movement, transfers,
receiving, dispatch, cycle count, QR codes, reports.

**Procurement Manager** — suppliers, purchase requests, purchase orders
(multi-material builder), RFQ, vendor comparison, goods receipt, messages.

**Quality Inspector** — incoming inspection, in-process inspection, final
inspection, defects, CAPA, quality reports.

**Maintenance Engineer** — machines, maintenance, schedules, machine
history, breakdowns, spare parts, reports.

**Finance Manager** — invoices, payments received, supplier payments,
customer ledger, expenses, GST/tax, budgets, profit & loss, QR codes,
finance reports. Cross-plant by design.

**HR Manager** — employees, attendance, leaves, recruitment, departments,
training, performance, payroll, HR reports.

**Production Operator** — assigned work orders, issue reporting, own
attendance, profile.

**Customer Portal** — orders (new order from product catalog), invoices,
shipments, support tickets, documents, reports.

**Supplier Portal** — purchase orders received, my catalog (raw materials +
own prices), RFQ requests, deliveries, invoices, payments, performance,
messages.

**Auditor** — audit logs, compliance reports, access logs, data export,
documents. Receives no notifications by design.

---

## 3. Main workflows (end-to-end, all verified live)

### 3.1 Company onboarding
1. A new company registers at `/auth` → Register your company.
2. Root Super Admin reviews it under Pending Requests and approves.
3. The company admin signs in, sets up plants and departments.
4. Company Admin whitelists employees (email + role, optionally plant).
5. Whitelisted people sign up and appear under Employees / Users & Roles.
Every step writes to `audit_logs` with actor and diff.

### 3.2 Customer order → delivery (the money chain)
1. **Customer** registers selecting the company; shares a shop location
   (geocoded) → auto-assigned to the **nearest plant**. With one plant it
   trivially assigns; with two, the nearer plant wins. Company or Plant
   Admin approves the request in Customer Requests; the customer then signs
   in from Customer Portal.
2. **Customer** places a New Order: picks a **product** (finished goods only
   — never raw materials) from the active catalog with quantity and delivery
   date. Order lands `pending_approval` tied to that plant.
3. **Approval** — Company Admin (company-wide) or the owning plant's Plant
   Admin sees it in Order Approvals. Either can approve; whichever acts
   first wins and the other sees it already-approved (DB guard prevents
   double approval). Approval notifies the plant's Production Manager and
   creates the sales order + QR code.
4. **Production Manager** opens Approved Orders / Production Planning:
   the BOM for the product resolves raw material needs against live stock.
   - All covered → schedule and create work orders.
   - Anything short → order flips `procurement_pending` and PM clicks
     **Trigger Procurement**, which creates a real purchase requisition.
5. **Procurement** — Purchase Requests lists the requisition; converting it
   opens quotes/pricing; the PO is created **Sent** with material lines
   priced from the supplier catalog or latest quote (the DB RPC rejects
   forged line prices). Company Admin/Plant Admin also approve customer
   orders here when relevant.
6. **Supplier** sees the PO in the portal, Accepts, then Dispatches with
   shipment details — which generates an inbound QR code.
7. **Warehouse** scans/enters the QR in Goods Receipt; the receipt creates
   or updates inventory rows for the material.
8. **Auto-resume** — a DB function checks every `procurement_pending` sales
   order: once its BOM is covered by stock, it flips back to `approved` and
   the Production Manager gets a "Materials received — start production"
   notification.
9. **Production** — PM creates production orders/work orders; operators
   progress them; QC gates apply (below).
10. **Dispatch** — warehouse packs, creates shipment + tracking; customer
    sees status in the portal.
11. **Finance** — invoice generated on dispatch; payment recorded against
    it; supplier invoices/payments mirror this on the buy side.

### 3.3 Procurement sub-workflow (RFQ path)
Procurement raises an RFQ to selected suppliers → each supplier quotes
price/lead time in the portal → Procurement compares quotes (vendor
comparison) → converts the winning quote into a PO (same auto-priced,
auto-Sent path as above). Suppliers maintain their own raw-material catalog
(My Catalog) that seeds PO pricing.

### 3.4 Production sub-workflow
Approved order → production order → work orders per station → operators
progress their assigned work orders (with in-process QC checkpoints) →
final inspection passes → finished goods → packing/dispatch. Operator
issue reports create maintenance tickets automatically.

### 3.5 Quality sub-workflow
Incoming materials inspection (against PO) → in-process checks during
production → final inspection with parameters (moisture, joint tightness,
finish) → failures raise NCR → CAPA actions tracked to closure → quality
certificates attach to shipments.

### 3.6 Maintenance sub-workflow
Breakdown reported (operator or engineer) → ticket → diagnosis → repair →
machine history updated; preventive maintenance schedules fire on intervals;
spare parts stock decrements on use.

### 3.7 HR sub-workflow
Whitelisted hire → employee record → attendance → leaves with approval →
trainings → performance reviews → payroll runs. Recruitment pipeline
(job postings → candidates) feeds hiring.

### 3.8 Finance sub-workflow
Customer invoice → payment received (ledger per customer); supplier invoice
→ supplier payment; expenses entered by category; budgets vs actuals;
GST/tax; profit & loss rolls everything up. Cross-plant visibility.

### 3.9 Warehouse sub-workflow
Goods receipt (QR) → putaway → stock movement log → transfers between
warehouses → cycle counts → dispatch with QR → shipments.

---

## 4. AI Copilot (role-scoped)

Available in the AI Center and as a module-level copilot on every page.
- **Routing:** questions go to **Groq first** (`openai/gpt-oss-120b`), with
  Cerebras as automatic fallback. Both keys live server-side; the browser
  never sees them.
- **Scoping:** the server verifies the caller's JWT, reads role + company
  from the database (client hints are ignored), re-checks the scope gate
  server-side, then injects live role-scoped data as context.
- **Out of scope:** any question touching another role's domain is refused —
  blocked client-side *and* server-side — with an explicit OUT OF SCOPE
  reply listing what the role *can* ask.
- Status pills on AI Center show live Groq/Cerebras connectivity.

---

## 5. Data model (90 tables, see `database-schema-audit.md`)

Grouped: identity & tenancy (companies, plants, profiles, user_roles,
whitelist), master data (materials, products, BOM, warehouses, suppliers,
machines), manufacturing (sales_orders, production_orders, work_orders,
inventory, goods_receipts), commerce (customer_orders, purchase_orders,
rfq_*, invoices, payments, shipments), quality (inspections, ncr, capa),
people (employees, attendance, leaves, payroll), system (notifications,
audit_logs, qr_codes, documents).

Key relationships:
- `products` --BOM--> `materials` (what a product consumes)
- `sales_orders` → `production_orders` → `work_orders` → `quality_inspections`
- `purchase_requisitions` → `purchase_orders` → `goods_receipts` → `inventory`
- Orders, employees and whitelists carry `plant_id` where plant-scoped.

Current live counts: 8 companies, 6 plants, 25 users, 9 materials,
6 products, 12 inventory rows, 11 sales orders, 26 POs, 19 work orders,
~3,000 audit log rows.

---

## 6. Cross-cutting guarantees

- **RLS everywhere:** every operational table filters by company; plant roles
  additionally by plant. Regression tests for each role live in `scripts/`.
- **Audit trail:** mutations write `audit_logs` with actor + diff; the
  Auditor reads them, Root reads across the platform.
- **Notifications:** in-app bell with per-role targeting; approval chains,
  material-ready pings and order status changes all flow through it.
- **QR codes:** inbound goods, shipments and assets get single-use QR codes
  scanned by warehouse/receiving.
- **Sound & themes:** optional click/hover sounds (localStorage mute), three
  themes (dark, light, aesthetic) with native dropdowns readable in all.
- **Realtime:** lists re-render on DB changes without reload; reloads keep
  you signed in on the same tab.

---

## 7. Repo map

| Path | Owns |
|---|---|
| `src/routes/_authenticated/` | one file per page (~97 routes) |
| `src/components/nav-config.ts` | per-role sidebars |
| `src/lib/route-access.ts` | role → route enforcement |
| `src/lib/role-scope.ts` | copilot domain permissions |
| `src/lib/copilot-llm.server.ts` | server LLM gateway (Groq→Cerebras) |
| `src/lib/copilot-engine.ts` | intent routing + live data gathering |
| `src/hooks/use-auth.tsx` | session, roles, company/plant resolution |
| `src/styles.css` | theme tokens (3 themes) |
| `supabase/migrations/` | schema history (122 migrations, all applied) |
| `scripts/` | per-role RLS regression tests |
| `database-schema-audit.md` | live schema reference (90 tables) |
