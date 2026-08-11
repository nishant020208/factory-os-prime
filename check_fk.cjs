// check_fk.cjs - check what blocks product deletion
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

async function main() {
  const { data: items, error: e1 } = await supabase.from('sales_order_items').select('id, product_id').limit(10);
  console.log('sales_order_items count:', items?.length, 'error:', e1?.message);
  
  const { data: po, error: e2 } = await supabase.from('production_orders').select('id').limit(5);
  console.log('production_orders count:', po?.length, 'error:', e2?.message);
  
  const { data: bom, error: e3 } = await supabase.from('bom_items').select('id, product_id').limit(5);
  console.log('bom_items count:', bom?.length, 'error:', e3?.message);
  
  const { data: inv, error: e4 } = await supabase.from('inventory').select('id, product_id').eq('company_id', COMPANY).limit(20);
  console.log('inventory (products) count:', inv?.filter(i => i.product_id).length, 'error:', e4?.message);
}

main().catch(console.error);
