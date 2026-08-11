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

async function main() {
  console.log('Connecting to:', envVars.SUPABASE_URL);
  const { data: companies, error: compErr } = await supabase.from('companies').select('*');
  console.log('Companies:', companies, 'Err:', compErr);

  const { data: products, error: prodErr } = await supabase.from('products').select('*');
  console.log('Products count:', products?.length, 'Err:', prodErr);
  if (products?.length) console.log('Sample product:', products[0]);

  const { data: materials, error: matErr } = await supabase.from('materials').select('*');
  console.log('Materials count:', materials?.length, 'Err:', matErr);
  if (materials?.length) console.log('Sample material:', materials[0]);

  const { data: departments, error: depErr } = await supabase.from('departments').select('*');
  console.log('Departments count:', departments?.length, 'Err:', depErr);
  if (departments?.length) console.log('Sample department:', departments[0]);

  const { data: machines, error: machErr } = await supabase.from('machines').select('*');
  console.log('Machines count:', machines?.length, 'Err:', machErr);
  if (machines?.length) console.log('Sample machine:', machines[0]);
  
  const { data: customers, error: custErr } = await supabase.from('customers').select('*');
  console.log('Customers count:', customers?.length, 'Err:', custErr);
  if (customers?.length) console.log('Sample customer:', customers[0]);

  const { data: suppliers, error: supErr } = await supabase.from('suppliers').select('*');
  console.log('Suppliers count:', suppliers?.length, 'Err:', supErr);
  if (suppliers?.length) console.log('Sample supplier:', suppliers[0]);

  const { data: inventory, error: invErr } = await supabase.from('inventory').select('*');
  console.log('Inventory count:', inventory?.length, 'Err:', invErr);
  if (inventory?.length) console.log('Sample inventory:', inventory[0]);
}

main().catch(console.error);
