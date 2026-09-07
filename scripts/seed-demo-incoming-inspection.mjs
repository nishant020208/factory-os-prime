/**
 * seed-demo-incoming-inspection.mjs
 *
 * Demonstrates the full Warehouse → Quality Inspector incoming inspection flow:
 *
 *   1. warehouse@abcmfg.demo  receives an existing PO
 *   2. A pending incoming_material_inspections record is created for each PO line
 *   3. quality@abcmfg.demo  verifies the record appears in their queue
 *
 * The demo record is intentionally LEFT IN PLACE so the QC inspector can
 * log in and process (Approve / Reject) it from the Quality → Incoming Materials tab.
 *
 * Run:  node scripts/seed-demo-incoming-inspection.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// ── Load .env.local / .env ──────────────────────────────────────────────────
const env = {};
for (const src of ['.env.local', '.env']) {
  try {
    for (const line of fs.readFileSync(src, 'utf8').replace(/\r/g, '').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    }
  } catch {}
}

const SUPABASE_URL  = env.VITE_SUPABASE_URL  || env.SUPABASE_URL;
const ANON_KEY      = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY   = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('❌  Missing Supabase env vars — check .env.local');
  process.exit(1);
}

// Service-role client (bypasses RLS for setup work)
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const COMPANY_ID  = '11111111-1111-1111-1111-111111111111';
const PLANT_ID    = '22222222-2222-2222-2222-222222222222';
const WH_EMAIL    = 'warehouse@abcmfg.demo';
const QC_EMAIL    = 'quality@abcmfg.demo';
const PASSWORD    = 'Factory@2026';

// ─────────────────────────────────────────────────────────────────────────────
function banner(text) {
  const line = '═'.repeat(60);
  console.log(`\n${line}\n  ${text}\n${line}`);
}

function ok(msg)   { console.log(`  ✅  ${msg}`); }
function warn(msg) { console.log(`  ⚠️   ${msg}`); }
function info(msg) { console.log(`  ℹ️   ${msg}`); }
function fail(msg) { console.log(`  ❌  ${msg}`); }

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  banner('DEMO: Warehouse Receive → QC Pending Inspection');

  // ── STEP 1: Find or create demo data prerequisites ──────────────────────
  console.log('\n📦  Step 1 — Resolving demo prerequisites...');

  // Get a warehouse
  const { data: warehouses } = await admin
    .from('warehouses')
    .select('id, name, code')
    .eq('company_id', COMPANY_ID)
    .order('name')
    .limit(5);

  if (!warehouses?.length) {
    fail('No warehouses found for company. Run sync-warehouse-qc.mjs first.');
    process.exit(1);
  }

  // Prefer a "raw materials" or "receiving" warehouse; fall back to first
  const targetWh =
    warehouses.find(w => /raw|receiv|inbound|staging/i.test(w.name + w.code)) ??
    warehouses[0];
  ok(`Warehouse: ${targetWh.name} (${targetWh.code})  id=${targetWh.id}`);

  // Get a real material
  const { data: materials } = await admin
    .from('materials')
    .select('id, name, unit')
    .eq('company_id', COMPANY_ID)
    .order('name')
    .limit(10);

  if (!materials?.length) {
    fail('No materials found for company.');
    process.exit(1);
  }

  // Pick a wood-type or first material for demo realism
  const demoMat =
    materials.find(m => /wood|teak|pine|oak|timber|plywood/i.test(m.name)) ??
    materials[0];
  ok(`Material: ${demoMat.name} (${demoMat.unit ?? 'pcs'})  id=${demoMat.id}`);

  // Get an active supplier
  const { data: suppliers } = await admin
    .from('suppliers')
    .select('id, name')
    .eq('company_id', COMPANY_ID)
    .eq('status', 'active')
    .order('name')
    .limit(5);

  const demoSupplier = suppliers?.[0];
  if (!demoSupplier) {
    fail('No active suppliers found.');
    process.exit(1);
  }
  ok(`Supplier: ${demoSupplier.name}  id=${demoSupplier.id}`);

  // ── STEP 2: Sign in as warehouse@abcmfg.demo ────────────────────────────
  console.log(`\n🏭  Step 2 — Signing in as ${WH_EMAIL}...`);
  const whClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: whAuth, error: whAuthErr } = await whClient.auth.signInWithPassword({
    email: WH_EMAIL,
    password: PASSWORD,
  });
  if (whAuthErr) {
    fail(`Auth failed for ${WH_EMAIL}: ${whAuthErr.message}`);
    process.exit(1);
  }
  ok(`Authenticated as ${WH_EMAIL}  (uid=${whAuth.user.id})`);

  // Verify warehouse user can see warehouses
  const { data: whVisible } = await whClient
    .from('warehouses')
    .select('id, name')
    .eq('company_id', COMPANY_ID);
  ok(`Warehouse user sees ${whVisible?.length ?? 0} warehouse(s)`);

  // ── STEP 3: Create a demo Purchase Order received by warehouse ──────────
  console.log('\n📋  Step 3 — Creating demo Purchase Order (status=received)...');

  const poNumber = `PO-DEMO-${Date.now().toString().slice(-6)}`;

  const { data: demoPo, error: poErr } = await admin
    .from('purchase_orders')
    .insert({
      company_id: COMPANY_ID,
      supplier_id: demoSupplier.id,
      po_number: poNumber,
      status: 'received',
      delivery_warehouse_id: targetWh.id,
      expected_date: new Date().toISOString().slice(0, 10),
      total_amount: 25000,
      supplier_note: 'Demo PO — seeded for incoming QC inspection walkthrough',
    })
    .select('id, po_number')
    .single();

  if (poErr) {
    fail(`Failed to create demo PO: ${poErr.message}`);
    process.exit(1);
  }
  ok(`Created PO: ${demoPo.po_number}  id=${demoPo.id}`);

  // ── STEP 4: Add PO line items ────────────────────────────────────────────
  console.log('\n📝  Step 4 — Adding PO line items...');

  // Use up to 3 different materials for realism
  const lineItems = materials.slice(0, Math.min(3, materials.length)).map((m, i) => ({
    company_id: COMPANY_ID,
    purchase_order_id: demoPo.id,
    material_id: m.id,
    description: `Demo line — ${m.name}`,
    quantity: [200, 150, 80][i],
    unit_price: [125, 80, 200][i],
    line_total: [25000, 12000, 16000][i],
  }));

  const { data: poItems, error: itemErr } = await admin
    .from('purchase_order_items')
    .insert(lineItems)
    .select('material_id, quantity');

  if (itemErr) {
    warn(`PO items insert issue: ${itemErr.message} (continuing...)`);
  } else {
    ok(`Inserted ${poItems?.length ?? 0} PO line item(s)`);
  }

  // ── STEP 5: Create pending incoming_material_inspections records ─────────
  console.log('\n🔬  Step 5 — Creating pending QC inspection requests...');

  // Find plant_id for the warehouse
  const { data: whRow } = await admin
    .from('warehouses')
    .select('plant_id')
    .eq('id', targetWh.id)
    .maybeSingle();
  const plantId = whRow?.plant_id ?? PLANT_ID;

  // Create goods receipt record (non-fatal — table schema may vary)
  let grId = null;
  try {
    const { data: grRow, error: grErr } = await admin
      .from('goods_receipts')
      .insert({
        company_id: COMPANY_ID,
        purchase_order_id: demoPo.id,
        received_by: whAuth.user.id,
        received_at: new Date().toISOString(),
        status: 'received',
        inspection_status: 'pending',
      })
      .select('id')
      .single();
    if (grErr) warn(`Goods receipt skipped: ${grErr.message}`);
    else { grId = grRow?.id ?? null; if (grId) ok(`Goods receipt logged  id=${grId}`); }
  } catch (e) {
    warn(`Goods receipt exception: ${e.message}`);
  }

  // Insert one QC inspection per PO line material
  const inspectionIds = [];
  for (const line of lineItems) {
    const mat = materials.find(m => m.id === line.material_id);
    const { data: insp, error: inspErr } = await admin
      .from('incoming_material_inspections')
      .insert({
        company_id: COMPANY_ID,
        plant_id: plantId,
        goods_receipt_id: grId,
        purchase_order_id: demoPo.id,
        material_id: line.material_id,
        warehouse_id: targetWh.id,
        quantity: line.quantity,
        status: 'pending',
      })
      .select('id')
      .single();

    if (inspErr) {
      warn(`Failed inspection insert for ${mat?.name}: ${inspErr.message}`);
    } else {
      ok(`Pending QC inspection created — ${mat?.name} × ${line.quantity} ${mat?.unit ?? 'units'}  id=${insp.id}`);
      inspectionIds.push(insp.id);
    }
  }

  if (inspectionIds.length === 0) {
    fail('No inspection records could be created. Check RLS / table permissions.');
    process.exit(1);
  }

  // ── STEP 6: Verify quality@abcmfg.demo can see the pending inspections ───
  console.log(`\n🔍  Step 6 — Verifying ${QC_EMAIL} sees the pending inspection queue...`);

  const qcClient = createClient(SUPABASE_URL, ANON_KEY);
  const { error: qcAuthErr } = await qcClient.auth.signInWithPassword({
    email: QC_EMAIL,
    password: PASSWORD,
  });

  if (qcAuthErr) {
    fail(`Auth failed for ${QC_EMAIL}: ${qcAuthErr.message}`);
  } else {
    ok(`Authenticated as ${QC_EMAIL}`);

    const { data: qcQueue, error: qcErr } = await qcClient
      .from('incoming_material_inspections')
      .select('*, materials(name, unit), warehouses(name, code), purchase_orders(id, po_number, suppliers(name))')
      .eq('company_id', COMPANY_ID)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (qcErr) {
      fail(`Quality inspector query error: ${qcErr.message}`);
    } else {
      ok(`Quality inspector sees ${qcQueue?.length ?? 0} pending inspection(s) total`);

      const ourItems = qcQueue?.filter(q => inspectionIds.includes(q.id)) ?? [];
      ok(`Of those, ${ourItems.length} are from this demo seed:`);
      for (const item of ourItems) {
        info(`  → ${item.materials?.name} × ${item.quantity} ${item.materials?.unit ?? 'units'}`
           + ` | PO: ${item.purchase_orders?.po_number}`
           + ` | Warehouse: ${item.warehouses?.name}`);
      }
    }
  }

  // ── STEP 7: Final summary ────────────────────────────────────────────────
  banner('DEMO DATA SEEDED SUCCESSFULLY');

  console.log(`
  What was created:
  ─────────────────────────────────────────────────────────
  Purchase Order : ${demoPo.po_number}  (status = received)
  Supplier       : ${demoSupplier.name}
  Destination WH : ${targetWh.name} (${targetWh.code})
  Inspections    : ${inspectionIds.length} pending QC inspection(s)

  How to verify in the app:
  ─────────────────────────────────────────────────────────
  1. Log in as  quality@abcmfg.demo  /  Factory@2026
  2. Navigate to  Quality Management  →  Incoming Materials  tab
  3. You should see ${inspectionIds.length} pending inspection(s) with an amber badge
  4. Use Approve & Stock or Reject to process each one

  This demo data is intentionally left in the database.
  ─────────────────────────────────────────────────────────
`);
}

main().catch(err => {
  console.error('\n❌  Unhandled error:', err.message ?? err);
  process.exit(1);
});
