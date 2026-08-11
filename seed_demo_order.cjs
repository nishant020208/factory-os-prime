// seed_demo_order.cjs — adds 1 demo furniture sales order
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

async function main() {
  // Get IDs
  const { data: custs } = await supabase.from('customers').select('id, name').eq('company_id', COMPANY);
  const { data: prods } = await supabase.from('products').select('id, sku, unit_price').eq('company_id', COMPANY);
  console.log('Customers:', custs?.map(c => c.name));
  console.log('Products:', prods?.map(p => p.sku));

  const urbanLiving = custs?.find(c => c.name.includes('Urban Living'));
  const homeDecor = custs?.find(c => c.name.includes('Home Decor'));
  const ananya = custs?.find(c => c.name.includes('Ananya'));

  const dtProd = prods?.find(p => p.sku === 'FRN-DT-001');  // Dining Table
  const sfProd = prods?.find(p => p.sku === 'FRN-SF-003');  // 3-Seater Sofa
  const wdProd = prods?.find(p => p.sku === 'FRN-WD-004');  // Wardrobe
  const bdProd = prods?.find(p => p.sku === 'FRN-BD-005');  // Bed Frame

  if (!urbanLiving || !dtProd) {
    console.error('Missing customers or products. Check seeding completed.');
    process.exit(1);
  }

  // Demo Order 1: Urban Living — 20 Dining Tables (LARGE ORDER - triggers low stock/procurement)
  const { data: so1, error: e1 } = await supabase.from('sales_orders').insert({
    company_id: COMPANY,
    so_number: 'SO-FRN-2026-001',
    customer_id: urbanLiving.id,
    status: 'pending',
    priority: 'high',
    total_amount: 20 * dtProd.unit_price,
    order_date: new Date().toISOString(),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    notes: '20 Dining Tables for new showroom launch — Urgent',
  }).select('id').single();
  if (e1) { console.error('SO1 error:', e1.message); } else {
    console.log('OK SO-FRN-2026-001 created:', so1.id);
    // Add line item
    const { error: si1 } = await supabase.from('sales_order_items').insert({
      company_id: COMPANY,
      sales_order_id: so1.id,
      product_id: dtProd.id,
      quantity: 20,
      unit_price: dtProd.unit_price,
      total_price: 20 * dtProd.unit_price,
    });
    if (si1) console.error('  Item error:', si1.message);
    else console.log('  OK item: 20x FRN-DT-001');
  }

  // Demo Order 2: Home Decor — 5 Wardrobes + 5 Bed Frames
  if (homeDecor && wdProd && bdProd) {
    const total2 = (5 * wdProd.unit_price) + (5 * bdProd.unit_price);
    const { data: so2, error: e2 } = await supabase.from('sales_orders').insert({
      company_id: COMPANY,
      so_number: 'SO-FRN-2026-002',
      customer_id: homeDecor.id,
      status: 'approved',
      priority: 'normal',
      total_amount: total2,
      order_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Interior fit-out project — 5 Wardrobes + 5 Bed Frames',
    }).select('id').single();
    if (e2) { console.error('SO2 error:', e2.message); } else {
      console.log('OK SO-FRN-2026-002 created:', so2.id);
      await supabase.from('sales_order_items').insert([
        { company_id: COMPANY, sales_order_id: so2.id, product_id: wdProd.id, quantity: 5, unit_price: wdProd.unit_price, total_price: 5 * wdProd.unit_price },
        { company_id: COMPANY, sales_order_id: so2.id, product_id: bdProd.id, quantity: 5, unit_price: bdProd.unit_price, total_price: 5 * bdProd.unit_price },
      ]);
      console.log('  OK items: 5x WD + 5x BD');
    }
  }

  // Demo Order 3: Individual Customer — 1 Sofa
  if (ananya && sfProd) {
    const { data: so3, error: e3 } = await supabase.from('sales_orders').insert({
      company_id: COMPANY,
      so_number: 'SO-FRN-2026-003',
      customer_id: ananya.id,
      status: 'in_production',
      priority: 'normal',
      total_amount: sfProd.unit_price,
      order_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Custom 3-seater sofa in teal velvet',
    }).select('id').single();
    if (e3) { console.error('SO3 error:', e3.message); } else {
      console.log('OK SO-FRN-2026-003 created:', so3.id);
      await supabase.from('sales_order_items').insert({ company_id: COMPANY, sales_order_id: so3.id, product_id: sfProd.id, quantity: 1, unit_price: sfProd.unit_price, total_price: sfProd.unit_price });
      console.log('  OK item: 1x SF sofa');
    }
  }

  // Final check
  const { data: finalOrds } = await supabase.from('sales_orders').select('so_number, status, total_amount').eq('company_id', COMPANY).order('so_number');
  console.log('\nAll sales orders:', finalOrds?.length);
  finalOrds?.forEach(o => console.log('  ' + o.so_number + ' | ' + o.status + ' | Rs.' + o.total_amount));
  console.log('\nDone!');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
