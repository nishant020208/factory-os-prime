// seed_step2_customers_inventory.cjs
// Continues from seed_furniture_v4.cjs which seeded company/depts/machines/products/materials/suppliers.
// This script handles: customers + product-based inventory

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
  console.log('=== Step 2: Customers + Inventory ===');

  // 1. Clear all tables that reference customers (in correct FK order)
  const tablesReferencingCustomers = [
    'notifications', 'audit_logs', 'order_status_history',
    'work_orders', 'quality_inspections', 'shipments', 'invoices',
    'purchase_order_items', 'purchase_orders', 'purchase_requisitions',
    'production_planning', 'sales_order_items', 'production_orders',
    'sales_orders', 'customer_orders',
  ];

  for (const tbl of tablesReferencingCustomers) {
    try {
      const { error } = await supabase.from(tbl).delete().eq('company_id', COMPANY);
      if (error && error.message.includes('does not exist')) {
        console.log('SKIP (no table):', tbl);
      } else if (error) {
        console.error('FAIL clear ' + tbl + ': ' + error.message);
      } else {
        console.log('OK clear:', tbl);
      }
    } catch (e) {
      console.log('SKIP (error):', tbl, e.message);
    }
  }

  // 2. Also clear inventory before customers
  await q('Inventory: delete all', async () => {
    const { error } = await supabase.from('inventory').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  // 3. Now delete old customers
  await q('Customers: delete old', async () => {
    const { error } = await supabase.from('customers').delete().eq('company_id', COMPANY);
    if (error) throw error;
  });

  // 4. Insert 3 furniture customers
  let customerIds = [];
  await q('Customers: insert 3', async () => {
    const { data, error } = await supabase.from('customers').insert([
      { company_id: COMPANY, name: 'Urban Living Furniture Retail', business_name: 'Urban Living Furniture Retail', email: 'procurement@urbanliving.com', contact_email: 'procurement@urbanliving.com', phone: '+91 98765 43210', contact_phone: '+91 98765 43210', segment: 'Bulk Furniture Retail', status: 'active', is_active: true },
      { company_id: COMPANY, name: 'Home Decor Interiors Pvt Ltd', business_name: 'Home Decor Interiors Pvt Ltd', email: 'orders@homedecorinteriors.com', contact_email: 'orders@homedecorinteriors.com', phone: '+91 98765 43211', contact_phone: '+91 98765 43211', segment: 'Interior Design Firm', status: 'active', is_active: true },
      { company_id: COMPANY, name: 'Ananya Sharma (Individual Customer)', business_name: 'Ananya Sharma', email: 'ananya.sharma@gmail.com', contact_email: 'ananya.sharma@gmail.com', phone: '+91 98765 43212', contact_phone: '+91 98765 43212', segment: 'Individual Customer', status: 'active', is_active: true },
    ]).select('id, name');
    if (error) throw error;
    customerIds = data;
  });
  console.log('Customers inserted:', customerIds.map(c => c.name));

  // 5. Get products
  const { data: prods } = await supabase.from('products').select('id, sku').eq('company_id', COMPANY).order('sku');
  const productIds = {};
  for (const p of (prods || [])) productIds[p.sku] = p.id;
  console.log('Products found:', Object.keys(productIds));

  // 6. Get warehouse
  const { data: warehouses } = await supabase.from('warehouses').select('id, name').eq('company_id', COMPANY).limit(5);
  let whId = warehouses?.[0]?.id;
  if (!whId) {
    const { data: newWh, error: whErr } = await supabase.from('warehouses').insert({
      company_id: COMPANY, name: 'Main Furniture Warehouse', code: 'WH-FRN-MAIN', is_active: true,
    }).select('id').single();
    if (whErr) throw whErr;
    whId = newWh.id;
  }
  console.log('Warehouse:', whId, '(' + (warehouses?.[0]?.name || 'new') + ')');

  // 7. Insert product inventory
  const productInventory = [
    { sku: 'FRN-DT-001', qty: 2 },   // Low stock
    { sku: 'FRN-OC-002', qty: 12 },
    { sku: 'FRN-SF-003', qty: 6 },
    { sku: 'FRN-WD-004', qty: 3 },
    { sku: 'FRN-BD-005', qty: 2 },
    { sku: 'FRN-ST-006', qty: 8 },
  ];

  for (const item of productInventory) {
    const pid = productIds[item.sku];
    if (!pid) { console.warn('SKIP: no product for', item.sku); continue; }
    await q('Inventory: ' + item.sku + ' qty=' + item.qty, async () => {
      const { error } = await supabase.from('inventory').insert({
        company_id: COMPANY, warehouse_id: whId, product_id: pid, quantity: item.qty,
      });
      if (error) throw error;
    });
  }

  // 8. Also seed 1 demo sales order so the demo has order data
  const custId = customerIds[0]?.id; // Urban Living
  const prodId = productIds['FRN-DT-001'];
  if (custId && prodId) {
    let orderId;
    await q('Demo sales_order: Urban Living 20x Dining Table', async () => {
      const { data, error } = await supabase.from('sales_orders').insert({
        company_id: COMPANY,
        order_number: 'SO-FRN-2026-001',
        customer_id: custId,
        status: 'pending',
        total_amount: 500000, // 20 x Rs.25,000
        notes: 'Urgent order - 20 Dining Tables for new showroom launch',
        created_at: new Date().toISOString(),
      }).select('id').single();
      if (error) throw error;
      orderId = data.id;
    });

    if (orderId) {
      await q('Demo sales_order_item: 20x FRN-DT-001', async () => {
        const { error } = await supabase.from('sales_order_items').insert({
          company_id: COMPANY,
          sales_order_id: orderId,
          product_id: prodId,
          quantity: 20,
          unit_price: 25000,
          total_price: 500000,
        });
        if (error) throw error;
      });
    }
  }

  // FINAL VERIFICATION
  console.log('\n============= FINAL STATUS =============');
  const { data: finalCo } = await supabase.from('companies').select('name, industry').eq('id', COMPANY).single();
  const { data: finalDepts } = await supabase.from('departments').select('name').eq('company_id', COMPANY);
  const { data: finalProds } = await supabase.from('products').select('sku, unit_price').eq('company_id', COMPANY).order('sku');
  const { data: finalMats } = await supabase.from('materials').select('name').eq('company_id', COMPANY);
  const { data: finalCusts } = await supabase.from('customers').select('name').eq('company_id', COMPANY);
  const { data: finalSups } = await supabase.from('suppliers').select('name').eq('company_id', COMPANY);
  const { data: finalMchs } = await supabase.from('machines').select('name').eq('company_id', COMPANY);
  const { data: finalInv } = await supabase.from('inventory').select('product_id, quantity').eq('company_id', COMPANY);
  const { data: finalOrds } = await supabase.from('sales_orders').select('order_number, status, total_amount').eq('company_id', COMPANY);

  console.log('Company:     ' + finalCo?.name);
  console.log('Industry:    ' + finalCo?.industry);
  console.log('Departments: ' + finalDepts?.length + ' [' + finalDepts?.map(d => d.name).join(', ') + ']');
  console.log('Products:    ' + finalProds?.length + ':');
  finalProds?.forEach(p => console.log('  ' + p.sku + ' Rs.' + p.unit_price));
  console.log('Materials:   ' + finalMats?.length + ': ' + finalMats?.map(m => m.name).join(', '));
  console.log('Customers:   ' + finalCusts?.length + ': ' + finalCusts?.map(c => c.name).join(' | '));
  console.log('Suppliers:   ' + finalSups?.length + ': ' + finalSups?.map(s => s.name).join(', '));
  console.log('Machines:    ' + finalMchs?.length + ': ' + finalMchs?.map(m => m.name).join(', '));
  console.log('Inventory:   ' + finalInv?.length + ' rows:');
  finalInv?.forEach(i => {
    const sku = finalProds?.find(p => p.sku === Object.keys(productIds).find(k => productIds[k] === i.product_id))?.sku;
    console.log('  ' + (sku || i.product_id) + ' qty=' + i.quantity);
  });
  console.log('Sales Orders: ' + finalOrds?.length + ':');
  finalOrds?.forEach(o => console.log('  ' + o.order_number + ' ' + o.status + ' Rs.' + o.total_amount));
  console.log('==========================================');
  console.log('ALL FURNITURE PIVOT DATA APPLIED SUCCESSFULLY!');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
