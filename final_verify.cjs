// final_verify.cjs
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

async function verify() {
  const { data: co } = await supabase.from('companies').select('name, industry').eq('id', COMPANY).single();
  const { data: depts } = await supabase.from('departments').select('name').eq('company_id', COMPANY);
  const { data: prods } = await supabase.from('products').select('sku, name, unit_price').eq('company_id', COMPANY);
  const { data: mats } = await supabase.from('materials').select('name, unit_cost').eq('company_id', COMPANY);
  const { data: custs } = await supabase.from('customers').select('name').eq('company_id', COMPANY);
  const { data: sups } = await supabase.from('suppliers').select('name').eq('company_id', COMPANY);
  const { data: mchs } = await supabase.from('machines').select('name').eq('company_id', COMPANY);
  const { data: inv } = await supabase.from('inventory').select('quantity').eq('company_id', COMPANY);
  const { data: ords } = await supabase.from('sales_orders').select('so_number, total_amount, status').eq('company_id', COMPANY);

  console.log('--- VERIFICATION SUMMARY ---');
  console.log('Company:', co);
  console.log('Departments:', depts?.map(d => d.name));
  console.log('Products Count:', prods?.length);
  console.log('Materials Count:', mats?.length);
  console.log('Customers:', custs?.map(c => c.name));
  console.log('Suppliers:', sups?.map(s => s.name));
  console.log('Machines Count:', mchs?.length);
  console.log('Inventory Rows:', inv?.length);
  console.log('Sales Orders:', ords);
}

verify().catch(console.error);
