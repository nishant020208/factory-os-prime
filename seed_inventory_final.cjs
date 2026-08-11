// seed_inventory_final.cjs — seeds only product-based inventory (what schema supports)
// Material stock levels will be tracked via a separate migration.
// Furniture products already seeded by seed_furniture_v4.cjs

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
for (const line of env.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    envVars[key] = val;
  }
}

const supabase = createClient(envVars.SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);
const COMPANY = '11111111-1111-1111-1111-111111111111';

async function q(label, fn) {
  try { const r = await fn(); console.log('OK ' + label); return r; }
  catch (e) { console.error('FAIL ' + label + ': ' + e.message); throw e; }
}

async function main() {
  // 1. Verify all core data exists from previous seed run
  const { data: co } = await supabase.from('companies').select('name, industry').eq('id', COMPANY).single();
  console.log('Company:', co?.name, '|', co?.industry);

  const { data: depts } = await supabase.from('departments').select('name').eq('company_id', COMPANY).order('name');
  console.log('Depts (' + depts?.length + '):', depts?.map(d => d.name).join(', '));

  const { data: prods } = await supabase.from('products').select('id, sku').eq('company_id', COMPANY).order('sku');
  console.log('Products (' + prods?.length + '):', prods?.map(p => p.sku).join(', '));

  const { data: mats } = await supabase.from('materials').select('id, name').eq('company_id', COMPANY).order('name');
  console.log('Materials (' + mats?.length + '):', mats?.map(m => m.name).join(', '));

  const { data: custs } = await supabase.from('customers').select('name').eq('company_id', COMPANY);
  console.log('Customers (' + custs?.length + '):', custs?.map(c => c.name).join(', '));

  const { data: sups } = await supabase.from('suppliers').select('name').eq('company_id', COMPANY);
  console.log('Suppliers (' + sups?.length + '):', sups?.map(s => s.name).join(', '));

  const { data: mchns } = await supabase.from('machines').select('name').eq('company_id', COMPANY);
  console.log('Machines (' + mchns?.length + '):', mchns?.map(m => m.name).join(', '));

  if (!prods || prods.length === 0) {
    console.error('ERROR: Products not found. Run seed_furniture_v4.cjs first (fixing the customers FK issue).');
    process.exit(1);
  }

  // Build product ID map
  const productIds = {};
  for (const p of prods) productIds[p.sku] = p.id;

  // 2. Get warehouse
  const { data: warehouses } = await supabase.from('warehouses').select('id, name').eq('company_id', COMPANY).limit(5);
  let whId = warehouses?.[0]?.id;
  console.log('Warehouse:', whId, '(' + (warehouses?.[0]?.name || 'none') + ')');

  if (!whId) {
    const { data: newWh, error: whErr } = await supabase.from('warehouses').insert({
      company_id: COMPANY, name: 'Main Furniture Warehouse', code: 'WH-FRN-MAIN', is_active: true,
    }).select('id').single();
    if (whErr) throw whErr;
    whId = newWh.id;
    console.log('Created warehouse:', whId);
  }

  // 3. Clear inventory
  await q('Inventory: clear all', async () => {
    const { error } = await supabase.from('inventory').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  // 4. Insert product-based inventory (schema only supports product_id NOT NULL)
  // Dining Table: 0 units (needs to be manufactured, order incoming)
  // Office Chair: 12 units in stock (can ship immediately)
  // 3-Seater Sofa: 6 units in stock
  // Wardrobe: 0 units
  // Bed Frame: 0 units
  // Study Table: 3 units
  const productInventory = [
    { sku: 'FRN-DT-001', qty: 2, note: 'Low stock — 20-unit order incoming will trigger procurement' },
    { sku: 'FRN-OC-002', qty: 12 },
    { sku: 'FRN-SF-003', qty: 6 },
    { sku: 'FRN-WD-004', qty: 3 },
    { sku: 'FRN-BD-005', qty: 2 },
    { sku: 'FRN-ST-006', qty: 8 },
  ];

  for (const item of productInventory) {
    const pid = productIds[item.sku];
    if (!pid) { console.warn('SKIP: product not found:', item.sku); continue; }
    await q('Inventory: ' + item.sku + ' qty=' + item.qty + (item.note ? ' (' + item.note + ')' : ''), async () => {
      const { error } = await supabase.from('inventory').insert({
        company_id: COMPANY,
        warehouse_id: whId,
        product_id: pid,
        quantity: item.qty,
      });
      if (error) throw error;
    });
  }

  // 5. FINAL FULL VERIFICATION
  console.log('\n============= FINAL VERIFICATION =============');
  const { data: invCheck } = await supabase.from('inventory').select('product_id, quantity').eq('company_id', COMPANY);
  console.log('Inventory rows:', invCheck?.length);
  invCheck?.forEach(i => {
    const sku = prods.find(p => p.id === i.product_id)?.sku || i.product_id;
    console.log('  ' + sku + ' qty=' + i.quantity);
  });

  console.log('\n==============================================');
  console.log('');
  console.log('SUMMARY OF WHAT HAS BEEN APPLIED TO SUPABASE:');
  console.log('Company:     ' + co?.name + ' (was: ABC Manufacturing)');
  console.log('Industry:    ' + co?.industry);
  console.log('Departments: ' + depts?.length + ' furniture workshop depts');
  console.log('Products:    ' + prods?.length + ' furniture SKUs (FRN-DT-001 through FRN-ST-006)');
  console.log('Materials:   ' + mats?.length + ' raw materials (Teak Wood, Plywood, etc.)');
  console.log('Customers:   ' + custs?.length + ' (Urban Living, Home Decor, Individual)');
  console.log('Suppliers:   ' + sups?.length + ' (Kerala Teak Suppliers Pvt Ltd)');
  console.log('Machines:    ' + mchns?.length + ' (CNC Router, Panel Saw, etc.)');
  console.log('Inventory:   ' + invCheck?.length + ' product stock rows');
  console.log('');
  console.log('NOTE: Material stock tracking (Teak Wood qty=5 low stock)');
  console.log('      requires a schema migration (ALTER TABLE inventory');
  console.log('      ALTER COLUMN product_id DROP NOT NULL).');
  console.log('      Migration file written to:');
  console.log('      supabase/migrations/20260811000001_inventory_material_support.sql');
  console.log('      Apply via: supabase db push OR Supabase Dashboard SQL editor');
  console.log('==============================================');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
