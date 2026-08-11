// seed_furniture.cjs — applies all furniture data directly via Supabase JS client
// Reads env from .env.local, bypasses SQL exec
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

async function step(label, fn) {
  try {
    await fn();
    console.log(`✅ ${label}`);
  } catch (e) {
    console.error(`❌ ${label}: ${e.message}`);
    throw e;
  }
}

async function main() {
  // 1. Update company name
  await step('Update company name → Artisan Furniture Works', async () => {
    const { error } = await supabase.from('companies').update({
      name: 'Artisan Furniture Works',
      legal_name: 'Artisan Furniture Works Pvt Ltd',
      industry: 'Custom Furniture Manufacturing',
    }).eq('id', COMPANY);
    if (error) throw error;
  });

  // 2. Clear & re-seed departments
  await step('Delete old departments', async () => {
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
  let deptIds = {};
  for (const dept of deptRows) {
    await step(`Insert dept: ${dept.name}`, async () => {
      const { data, error } = await supabase.from('departments').insert(dept).select('id, name').single();
      if (error) throw error;
      deptIds[data.name] = data.id;
    });
  }
  console.log('Department IDs:', deptIds);

  // 3. Clear & re-seed machines
  await step('Delete old machines', async () => {
    const { error } = await supabase.from('machines').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  const machines = [
    { company_id: COMPANY, name: 'CNC Wood Router', code: 'MC-CNC-01', type: 'Wood Router', status: 'operational', utilization: 88.5 },
    { company_id: COMPANY, name: 'Panel Cutting Saw', code: 'MC-SAW-01', type: 'Panel Saw', status: 'operational', utilization: 92.0 },
    { company_id: COMPANY, name: 'Edge Banding Machine', code: 'MC-EDGE-01', type: 'Edge Bander', status: 'operational', utilization: 75.4 },
    { company_id: COMPANY, name: 'Spray Paint Booth', code: 'MC-SPRY-01', type: 'Finishing Booth', status: 'operational', utilization: 81.0 },
    { company_id: COMPANY, name: 'Sanding Machine', code: 'MC-SND-01', type: 'Sander', status: 'operational', utilization: 79.2 },
    { company_id: COMPANY, name: 'Upholstery Stitching Machine', code: 'MC-STCH-01', type: 'Stitching Machine', status: 'operational', utilization: 84.0 },
  ];
  await step('Insert 6 machines', async () => {
    const { error } = await supabase.from('machines').insert(machines);
    if (error) throw error;
  });

  // 4. Clear & re-seed products
  await step('Delete old products', async () => {
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
  let productIds = {};
  for (const prod of productRows) {
    await step(`Insert product: ${prod.sku}`, async () => {
      const { data, error } = await supabase.from('products').insert(prod).select('id, sku').single();
      if (error) throw error;
      productIds[prod.sku] = data.id;
    });
  }
  console.log('Product IDs:', productIds);

  // 5. Clear & re-seed materials
  await step('Delete old materials', async () => {
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
  let materialIds = {};
  for (const mat of materialRows) {
    await step(`Insert material: ${mat.name}`, async () => {
      const { data, error } = await supabase.from('materials').insert(mat).select('id, name').single();
      if (error) throw error;
      materialIds[mat.name] = data.id;
    });
  }
  console.log('Material IDs:', materialIds);

  // 6. Clear & re-seed customers
  await step('Delete old customers', async () => {
    const { error } = await supabase.from('customers').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  const customerRows = [
    { company_id: COMPANY, name: 'Urban Living Furniture Retail', business_name: 'Urban Living Furniture Retail', email: 'procurement@urbanliving.com', contact_email: 'procurement@urbanliving.com', phone: '+91 98765 43210', contact_phone: '+91 98765 43210', segment: 'Bulk Furniture Retail', status: 'active', is_active: true },
    { company_id: COMPANY, name: 'Home Decor Interiors Pvt Ltd', business_name: 'Home Decor Interiors Pvt Ltd', email: 'orders@homedecorinteriors.com', contact_email: 'orders@homedecorinteriors.com', phone: '+91 98765 43211', contact_phone: '+91 98765 43211', segment: 'Interior Design Firm', status: 'active', is_active: true },
    { company_id: COMPANY, name: 'Ananya Sharma (Individual Customer)', business_name: 'Ananya Sharma', email: 'ananya.sharma@gmail.com', contact_email: 'ananya.sharma@gmail.com', phone: '+91 98765 43212', contact_phone: '+91 98765 43212', segment: 'Individual Customer', status: 'active', is_active: true },
  ];
  let customerIds = {};
  for (const cust of customerRows) {
    await step(`Insert customer: ${cust.name}`, async () => {
      const { data, error } = await supabase.from('customers').insert(cust).select('id, name').single();
      if (error) throw error;
      customerIds[cust.name] = data.id;
    });
  }

  // 7. Clear & re-seed suppliers
  await step('Delete old suppliers', async () => {
    const { error } = await supabase.from('suppliers').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  let supplierId;
  await step('Insert supplier: Kerala Teak Suppliers Pvt Ltd', async () => {
    const { data, error } = await supabase.from('suppliers').insert({
      company_id: COMPANY,
      name: 'Kerala Teak Suppliers Pvt Ltd',
      category: 'Hardwood & Timber',
      contact_email: 'sales@keralateak.com',
      contact_phone: '+91 484 2345678',
      rating: 4.9,
      status: 'active',
    }).select('id').single();
    if (error) throw error;
    supplierId = data.id;
  });

  // 8. Get warehouse
  const { data: warehouses } = await supabase.from('warehouses').select('*').eq('company_id', COMPANY).limit(5);
  console.log('Warehouses found:', warehouses?.map(w => `${w.id}: ${w.name}`));
  
  let wh_raw = warehouses?.[0]?.id;
  let wh_fg = warehouses?.[0]?.id;
  // Try to find specific warehouses
  for (const wh of (warehouses || [])) {
    const n = (wh.name || '').toLowerCase();
    if (n.includes('raw') || n.includes('material')) wh_raw = wh.id;
    if (n.includes('finish') || n.includes('fg')) wh_fg = wh.id;
  }

  if (!wh_raw) {
    await step('Create default warehouse', async () => {
      const { data, error } = await supabase.from('warehouses').insert({
        company_id: COMPANY,
        name: 'Main Furniture Warehouse',
        code: 'WH-FRN-MAIN',
        is_active: true,
      }).select('id').single();
      if (error) throw error;
      wh_raw = data.id;
      wh_fg = data.id;
    });
  }

  // 9. Clear & re-seed inventory
  await step('Delete old inventory', async () => {
    const { error } = await supabase.from('inventory').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  // Teak Wood: LOW STOCK on purpose (5 units; order of 20 dining tables needs 40 cu ft → triggers procurement)
  const inventoryRows = [
    { company_id: COMPANY, warehouse_id: wh_raw, material_id: materialIds['Teak Wood'], quantity: 5 },
    { company_id: COMPANY, warehouse_id: wh_raw, material_id: materialIds['Plywood Sheet'], quantity: 200 },
    { company_id: COMPANY, warehouse_id: wh_raw, material_id: materialIds['Upholstery Fabric'], quantity: 350 },
    { company_id: COMPANY, warehouse_id: wh_raw, material_id: materialIds['High-Density Foam'], quantity: 800 },
    { company_id: COMPANY, warehouse_id: wh_raw, material_id: materialIds['Hinges'], quantity: 1500 },
    { company_id: COMPANY, warehouse_id: wh_raw, material_id: materialIds['Wood Screws'], quantity: 100 },
    { company_id: COMPANY, warehouse_id: wh_raw, material_id: materialIds['Polish/Varnish'], quantity: 150 },
    { company_id: COMPANY, warehouse_id: wh_raw, material_id: materialIds['Drawer Slides'], quantity: 300 },
    { company_id: COMPANY, warehouse_id: wh_raw, material_id: materialIds['Fevicol/Wood Adhesive'], quantity: 120 },
    { company_id: COMPANY, warehouse_id: wh_fg, product_id: productIds['FRN-OC-002'], quantity: 12 },
    { company_id: COMPANY, warehouse_id: wh_fg, product_id: productIds['FRN-SF-003'], quantity: 6 },
  ];

  for (const inv of inventoryRows) {
    // Remove null material_id or product_id
    const row = {};
    for (const [k, v] of Object.entries(inv)) {
      if (v !== undefined && v !== null) row[k] = v;
    }
    await step(`Inventory: ${JSON.stringify(row).slice(0, 80)}`, async () => {
      const { error } = await supabase.from('inventory').insert(row);
      if (error) throw error;
    });
  }

  console.log('\n=== VERIFICATION ===');
  const { data: compCheck } = await supabase.from('companies').select('name, industry').eq('id', COMPANY).single();
  console.log('Company:', compCheck);
  const { data: depts } = await supabase.from('departments').select('name, code').eq('company_id', COMPANY);
  console.log('Departments:', depts?.map(d => d.name));
  const { data: prods } = await supabase.from('products').select('sku, name').eq('company_id', COMPANY);
  console.log('Products:', prods?.map(p => p.sku));
  const { data: mats } = await supabase.from('materials').select('name, unit_cost').eq('company_id', COMPANY);
  console.log('Materials:', mats?.map(m => m.name));
  const { data: custs } = await supabase.from('customers').select('name').eq('company_id', COMPANY);
  console.log('Customers:', custs?.map(c => c.name));
  const { data: sups } = await supabase.from('suppliers').select('name').eq('company_id', COMPANY);
  console.log('Suppliers:', sups?.map(s => s.name));
  const { data: mchns } = await supabase.from('machines').select('name').eq('company_id', COMPANY);
  console.log('Machines:', mchns?.map(m => m.name));
  const { data: inv } = await supabase.from('inventory').select('quantity, material_id, product_id').eq('company_id', COMPANY);
  console.log('Inventory rows:', inv?.length, '| Teak Wood entry:', inv?.find(i => i.material_id === materialIds['Teak Wood']));

  console.log('\n✅ All furniture pivot data applied successfully!');
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
