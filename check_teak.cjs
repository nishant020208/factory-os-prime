// check_teak.cjs
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

async function checkTeak() {
  const { data: mats } = await supabase.from('materials').select('id, name, unit_cost').eq('company_id', COMPANY);
  const teak = mats?.find(m => m.name.toLowerCase().includes('teak'));
  console.log('Teak Material in DB:', teak);
  if (teak) {
    const { data: inv } = await supabase.from('inventory').select('*').eq('company_id', COMPANY).eq('material_id', teak.id);
    console.log('Teak Material Inventory Rows:', inv);
  }
}

checkTeak().catch(console.error);
