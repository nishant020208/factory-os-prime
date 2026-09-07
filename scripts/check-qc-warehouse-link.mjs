import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = {};
for (const src of ['.env.local', '.env']) {
  try {
    for (const line of fs.readFileSync(src, 'utf8').replace(/\r/g, '').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    }
  } catch {}
}

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log('=== Checking Profiles & Whitelist ===');
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name, company_id, plant_id')
    .in('email', ['quality@abcmfg.demo', 'warehouse@abcmfg.demo']);
  console.log('Profiles:', profiles);

  const { data: whitelist } = await admin
    .from('whitelist')
    .select('*')
    .in('email', ['quality@abcmfg.demo', 'warehouse@abcmfg.demo']);
  console.log('Whitelist:', whitelist);

  const { data: userRoles } = await admin
    .from('user_roles')
    .select('*')
    .in('user_id', (profiles ?? []).map(p => p.id));
  console.log('User roles:', userRoles);

  console.log('\n=== Checking Plants & Warehouses ===');
  const { data: plants } = await admin.from('plants').select('id, name, company_id');
  console.log('Plants:', plants);

  const { data: warehouses } = await admin
    .from('warehouses')
    .select('id, name, code, plant_id, company_id, status');
  console.log('Warehouses:', warehouses);

  console.log('\n=== Checking Stock Transfers ===');
  const { data: transfers } = await admin
    .from('stock_transfers')
    .select('id, from_warehouse_id, to_warehouse_id, quantity, status, notes, created_at')
    .limit(5);
  console.log('Recent Transfers:', transfers);

  console.log('\n=== Checking Incoming Material Inspections ===');
  const { data: incoming } = await admin
    .from('incoming_material_inspections')
    .select('id, purchase_order_id, warehouse_id, plant_id, status, result, quantity')
    .limit(5);
  console.log('Recent Incoming Inspections:', incoming);
}

main().catch(console.error);
