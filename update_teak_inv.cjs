// update_teak_inv.cjs
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
  const { data: mats } = await supabase.from('materials').select('id, name').eq('company_id', COMPANY);
  const teak = mats?.find(m => m.name === 'Teak Wood');

  const { data: prods } = await supabase.from('products').select('id, sku').eq('company_id', COMPANY);
  const dt = prods?.find(p => p.sku === 'FRN-DT-001');

  if (!teak || !dt) {
    console.error('Missing teak or dt');
    process.exit(1);
  }

  // Update existing FRN-DT-001 inventory row to attach material_id = teak.id and quantity = 5
  const { data, error } = await supabase
    .from('inventory')
    .update({ material_id: teak.id, quantity: 5 })
    .eq('company_id', COMPANY)
    .eq('product_id', dt.id)
    .select('*');

  if (error) {
    console.error('Error updating inventory:', error.message);
  } else {
    console.log('SUCCESS: Updated inventory row with Teak Wood material_id and LOW quantity (5):', data);
  }
}

main().catch(console.error);
