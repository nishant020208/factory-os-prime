// seed_furniture_v2.cjs — applies all furniture data using delete+insert only (no PATCH/update)
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
  }
}

const supabase = createClient(envVars.SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);
const COMPANY = '11111111-1111-1111-1111-111111111111';

function ok(label) { console.log('OK ' + label); }
function fail(label, e) { console.error('FAIL ' + label + ': ' + e.message); throw e; }

async function q(label, fn) {
  try { const r = await fn(); ok(label); return r; }
  catch (e) { fail(label, e); }
}

async function main() {
  // Verify connection first
  const { data: ping, error: pingErr } = await supabase.from('companies').select('id').eq('id', COMPANY).limit(1);
  if (pingErr) throw new Error('Connection failed: ' + pingErr.message);
  console.log('Connected. Company exists:', ping?.length > 0);

  // 1. COMPANY NAME — use upsert (INSERT ON CONFLICT DO UPDATE)
  await q('Company: upsert Artisan Furniture Works', async () => {
    const { error } = await supabase.from('companies').upsert({
      id: COMPANY,
      name: 'Artisan Furniture Works',
      legal_name: 'Artisan Furniture Works Pvt Ltd',
      industry: 'Custom Furniture Manufacturing',
      currency: 'INR',
      status: 'active',
      plan_tier: 'starter',
      invoice_qr_at_approval: true,
    }, { onConflict: 'id' });
    if (error) throw error;
  });

  // 2. DEPARTMENTS — delete all then insert fresh
  await q('Departments: delete old', async () => {
    const { error } = await supabase.from('departments').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  const deptRows = [
    { company_id: COMPANY, name: 'Carpentry', code: 'DEPT-CARP' },
    { company_id: COMPANY, name: 'Upholstery', code: 'DEPT-UPH' },
    { company_id: COMPANY, name: 'Finishing & Polishing', code: 'DEPT-FIN' },
    { company_id: COMPANY, name: 'Assembly', code: 'DEPT-ASSM' },
    { company_id: COMPANY, name: 'Quality Check', code: 'DEPT-QC' },
    { company_id: COMPANY, name: 'Packing & Dispatch', code: 'DEPT-PACK' },
  ];
  const deptIds = {};
  for (const dept of deptRows) {
    await q('Dept insert: ' + dept.name, async () => {
      const { data, error } = await supabase.from('departments').insert(dept).select('id, name').single();
      if (error) throw error;
      deptIds[data.name] = data.id;
    });
  }
  console.log('Dept IDs:', deptIds);

  // 3. MACHINES — delete all then insert fresh
  await q('Machines: delete old', async () => {
    const { error } = await supabase.from('machines').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  const machineRows = [
    { company_id: COMPANY, name: 'CNC Wood Router', code: 'MC-CNC-01', type: 'Wood Router', status: 'operational', utilization: 88.5 },
    { company_id: COMPANY, name: 'Panel Cutting Saw', code: 'MC-SAW-01', type: 'Panel Saw', status: 'operational', utilization: 92.0 },
    { company_id: COMPANY, name: 'Edge Banding Machine', code: 'MC-EDGE-01', type: 'Edge Bander', status: 'operational', utilization: 75.4 },
    { company_id: COMPANY, name: 'Spray Paint Booth', code: 'MC-SPRY-01', type: 'Finishing Booth', status: 'operational', utilization: 81.0 },
    { company_id: COMPANY, name: 'Sanding Machine', code: 'MC-SND-01', type: 'Sander', status: 'operational', utilization: 79.2 },
    { company_id: COMPANY, name: 'Upholstery Stitching Machine', code: 'MC-STCH-01', type: 'Stitching Machine', status: 'operational', utilization: 84.0 },
  ];
  await q('Machines: insert 6', async () => {
    const { error } = await supabase.from('machines').insert(machineRows);
    if (error) throw error;
  });

  // 4. PRODUCTS — delete all then insert fresh
  await q('Products: delete old', async () => {
    const { error } = await supabase.from('products').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  const productRows = [
    { company_id: COMPANY, sku: 'FRN-DT-001', name: 'Dining Table — Teak', description: 'Solid Teak Wood 6-seater dining table with natural varnish finish', unit: 'pcs', unit_cost: 15000, unit_price: 25000, reorder_level: 10, status: 'active' },
    { company_id: COMPANY, sku: 'FRN-OC-002', name: 'Executive Office Chair', description: 'Ergonomic cushioned office chair with teak frame and leatherette upholstery', unit: 'pcs', unit_cost: 7000, unit_price: 12000, reorder_level: 15, status: 'active' },
    { company_id: COMPANY, sku: 'FRN-SF-003', name: '3-Seater Fabric Sofa', description: 'Premium high-density foam 3-seater sofa with stain-resistant upholstery fabric', unit: 'pcs', unit_cost: 21000, unit_price: 35000, reorder_level: 8, status: 'active' },
    { company_id: COMPANY, sku: 'FRN-WD-004', name: '4-Door Wardrobe', description: 'Spacious 4-door plywood wardrobe with teak veneer and soft-close hinges', unit: 'pcs', unit_cost: 27000, unit_price: 45000, reorder_level: 5, status: 'active' },
    { company_id: COMPANY, sku: 'FRN-BD-005', name: 'Queen Size Bed Frame', description: 'Sturdy teak wood queen size bed frame with upholstered headboard', unit: 'pcs', unit_cost: 22000, unit_price: 38000, reorder_level: 6, status: 'active' },
    { company_id: COMPANY, sku: 'FRN-ST-006', name: 'Study Table with Drawer', description: 'Compact study desk with soft-slide drawers and cable management', unit: 'pcs', unit_cost: 8500, unit_price: 15000, reorder_level: 12, status: 'active' },
  ];
  const productIds = {};
  for (const prod of productRows) {
    await q('Product insert: ' + prod.sku, async () => {
      const { data, error } = await supabase.from('products').insert(prod).select('id, sku').single();
      if (error) throw error;
      productIds[prod.sku] = data.id;
    });
  }
  console.log('Product IDs:', productIds);

  // 5. MATERIALS — delete all then insert fresh
  await q('Materials: delete old', async () => {
    const { error } = await supabase.from('materials').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  const materialRows = [
    { company_id: COMPANY, name: 'Teak Wood', unit: 'cubic feet', unit_cost: 1200, is_active: true, description: 'Grade A Malabar Teak Wood timber' },
    { company_id: COMPANY, name: 'Plywood Sheet', unit: 'pcs', unit_cost: 450, is_active: true, description: '18mm Commercial Hardwood Plywood 8x4 ft' },
    { company_id: COMPANY, name: 'Upholstery Fabric', unit: 'meters', unit_cost: 350, is_active: true, description: 'High durability velvet upholstery fabric' },
    { company_id: COMPANY, name: 'High-Density Foam', unit: 'sq ft', unit_cost: 180, is_active: true, description: '40-density cushion foam for seating' },
    { company_id: COMPANY, name: 'Hinges', unit: 'pcs', unit_cost: 25, is_active: true, description: '3D adjustable soft-close cabinet hinges' },
    { company_id: COMPANY, name: 'Wood Screws', unit: 'box', unit_cost: 150, is_active: true, description: 'Zinc-plated counter-sunk wood screws 500/box' },
    { company_id: COMPANY, name: 'Polish/Varnish', unit: 'liters', unit_cost: 500, is_active: true, description: 'Clear polyurethane wood polish & varnish' },
    { company_id: COMPANY, name: 'Drawer Slides', unit: 'pairs', unit_cost: 220, is_active: true, description: 'Full extension ball-bearing drawer slides 18 inch' },
    { company_id: COMPANY, name: 'Fevicol/Wood Adhesive', unit: 'liters', unit_cost: 280, is_active: true, description: 'High strength synthetic resin wood adhesive' },
  ];
  const materialIds = {};
  for (const mat of materialRows) {
    await q('Material insert: ' + mat.name, async () => {
      const { data, error } = await supabase.from('materials').insert(mat).select('id, name').single();
      if (error) throw error;
      materialIds[mat.name] = data.id;
    });
  }
  console.log('Material IDs:', materialIds);

  // 6. CUSTOMERS — delete all then insert fresh
  await q('Customers: delete old', async () => {
    const { error } = await supabase.from('customers').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  const customerRows = [
    { company_id: COMPANY, name: 'Urban Living Furniture Retail', business_name: 'Urban Living Furniture Retail', email: 'procurement@urbanliving.com', contact_email: 'procurement@urbanliving.com', phone: '+91 98765 43210', contact_phone: '+91 98765 43210', segment: 'Bulk Furniture Retail', status: 'active', is_active: true },
    { company_id: COMPANY, name: 'Home Decor Interiors Pvt Ltd', business_name: 'Home Decor Interiors Pvt Ltd', email: 'orders@homedecorinteriors.com', contact_email: 'orders@homedecorinteriors.com', phone: '+91 98765 43211', contact_phone: '+91 98765 43211', segment: 'Interior Design Firm', status: 'active', is_active: true },
    { company_id: COMPANY, name: 'Ananya Sharma (Individual Customer)', business_name: 'Ananya Sharma', email: 'ananya.sharma@gmail.com', contact_email: 'ananya.sharma@gmail.com', phone: '+91 98765 43212', contact_phone: '+91 98765 43212', segment: 'Individual Customer', status: 'active', is_active: true },
  ];
  for (const cust of customerRows) {
    await q('Customer insert: ' + cust.name, async () => {
      const { error } = await supabase.from('customers').insert(cust);
      if (error) throw error;
    });
  }

  // 7. SUPPLIERS — delete all then insert fresh
  await q('Suppliers: delete old', async () => {
    const { error } = await supabase.from('suppliers').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  await q('Supplier: Kerala Teak Suppliers Pvt Ltd', async () => {
    const { error } = await supabase.from('suppliers').insert({
      company_id: COMPANY,
      name: 'Kerala Teak Suppliers Pvt Ltd',
      category: 'Hardwood & Timber',
      contact_email: 'sales@keralateak.com',
      contact_phone: '+91 484 2345678',
      rating: 4.9,
      status: 'active',
    });
    if (error) throw error;
  });

  // 8. INVENTORY — find or create warehouse, then delete+insert
  const { data: warehouses } = await supabase.from('warehouses').select('id, name').eq('company_id', COMPANY).limit(10);
  console.log('Warehouses:', warehouses?.map(w => w.name));

  let whId = warehouses?.[0]?.id;
  if (!whId) {
    const { data: newWh, error: whErr } = await supabase.from('warehouses').insert({
      company_id: COMPANY,
      name: 'Main Furniture Warehouse',
      code: 'WH-FRN-MAIN',
      is_active: true,
    }).select('id').single();
    if (whErr) throw whErr;
    whId = newWh.id;
    console.log('Created warehouse:', whId);
  }

  await q('Inventory: delete old', async () => {
    const { error } = await supabase.from('inventory').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  // Teak Wood: 5 units ONLY — deliberately LOW so procurement branch triggers
  const inventoryRows = [
    { company_id: COMPANY, warehouse_id: whId, material_id: materialIds['Teak Wood'], quantity: 5 },
    { company_id: COMPANY, warehouse_id: whId, material_id: materialIds['Plywood Sheet'], quantity: 200 },
    { company_id: COMPANY, warehouse_id: whId, material_id: materialIds['Upholstery Fabric'], quantity: 350 },
    { company_id: COMPANY, warehouse_id: whId, material_id: materialIds['High-Density Foam'], quantity: 800 },
    { company_id: COMPANY, warehouse_id: whId, material_id: materialIds['Hinges'], quantity: 1500 },
    { company_id: COMPANY, warehouse_id: whId, material_id: materialIds['Wood Screws'], quantity: 100 },
    { company_id: COMPANY, warehouse_id: whId, material_id: materialIds['Polish/Varnish'], quantity: 150 },
    { company_id: COMPANY, warehouse_id: whId, material_id: materialIds['Drawer Slides'], quantity: 300 },
    { company_id: COMPANY, warehouse_id: whId, material_id: materialIds['Fevicol/Wood Adhesive'], quantity: 120 },
    // Products in finished goods section
    { company_id: COMPANY, warehouse_id: whId, product_id: productIds['FRN-OC-002'], quantity: 12 },
    { company_id: COMPANY, warehouse_id: whId, product_id: productIds['FRN-SF-003'], quantity: 6 },
  ];

  for (const row of inventoryRows) {
    const clean = Object.fromEntries(Object.entries(row).filter(([, v]) => v != null));
    await q('Inventory row: qty=' + clean.quantity, async () => {
      const { error } = await supabase.from('inventory').insert(clean);
      if (error) throw error;
    });
  }

  // === FINAL VERIFICATION ===
  console.log('\n=== VERIFICATION ===');
  const { data: co } = await supabase.from('companies').select('name, industry').eq('id', COMPANY).single();
  console.log('Company:', co?.name, '|', co?.industry);
  const { data: depts2 } = await supabase.from('departments').select('name').eq('company_id', COMPANY).order('name');
  console.log('Departments (' + depts2?.length + '):', depts2?.map(d => d.name).join(', '));
  const { data: prods2 } = await supabase.from('products').select('sku, name, unit_price').eq('company_id', COMPANY).order('sku');
  console.log('Products (' + prods2?.length + '):');
  prods2?.forEach(p => console.log('  ' + p.sku + ' | ' + p.name + ' | Rs.' + p.unit_price));
  const { data: mats2 } = await supabase.from('materials').select('name, unit, unit_cost').eq('company_id', COMPANY).order('name');
  console.log('Materials (' + mats2?.length + '):');
  mats2?.forEach(m => console.log('  ' + m.name + ' / ' + m.unit + ' @ Rs.' + m.unit_cost));
  const { data: custs2 } = await supabase.from('customers').select('name').eq('company_id', COMPANY);
  console.log('Customers (' + custs2?.length + '):', custs2?.map(c => c.name).join(', '));
  const { data: sups2 } = await supabase.from('suppliers').select('name').eq('company_id', COMPANY);
  console.log('Suppliers (' + sups2?.length + '):', sups2?.map(s => s.name).join(', '));
  const { data: mchns2 } = await supabase.from('machines').select('name').eq('company_id', COMPANY);
  console.log('Machines (' + mchns2?.length + '):', mchns2?.map(m => m.name).join(', '));
  const { data: inv2 } = await supabase.from('inventory').select('material_id, product_id, quantity').eq('company_id', COMPANY);
  const teakRow = inv2?.find(i => i.material_id === materialIds['Teak Wood']);
  console.log('Inventory rows:', inv2?.length, '| Teak Wood qty:', teakRow?.quantity, '(should be 5 — LOW STOCK)');

  console.log('\nALL DONE. Furniture pivot data applied successfully!');
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
