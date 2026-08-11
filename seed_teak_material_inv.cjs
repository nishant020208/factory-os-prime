// seed_teak_material_inv.cjs
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
  // Get Teak Wood material ID
  const { data: mats } = await supabase.from('materials').select('id, name').eq('company_id', COMPANY);
  const teak = mats?.find(m => m.name === 'Teak Wood');
  
  // Get Dining Table product ID
  const { data: prods } = await supabase.from('products').select('id, sku').eq('company_id', COMPANY);
  const dt = prods?.find(p => p.sku === 'FRN-DT-001');

  // Get Warehouse ID
  const { data: whs } = await supabase.from('warehouses').select('id').eq('company_id', COMPANY).limit(1);
  const whId = whs?.[0]?.id;

  if (!teak || !dt || !whId) {
    console.error('Missing Teak, Dining Table, or Warehouse');
    process.exit(1);
  }

  console.log('Inserting low-stock Teak Wood inventory (material_id =', teak.id, ', product_id =', dt.id, ')');

  // Insert row into inventory using product_id = dt.id and material_id = teak.id with quantity = 5 (LOW)
  const { data, error } = await supabase.from('inventory').insert({
    company_id: COMPANY,
    warehouse_id: whId,
    product_id: dt.id,
    material_id: teak.id,
    quantity: 5, // LOW STOCK
  }).select('*');

  if (error) {
    console.error('Error inserting Teak inventory:', error.message);
  } else {
    console.log('SUCCESS: Inserted Teak Wood inventory row:', data);
  }
}

main().catch(console.error);
