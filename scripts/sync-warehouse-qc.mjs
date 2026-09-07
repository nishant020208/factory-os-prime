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

const COMPANY_ID = '11111111-1111-1111-1111-111111111111';
const PLANT_ID = '22222222-2222-2222-2222-222222222222';

async function main() {
  console.log('🔄 1. Synchronizing Warehouses for company:', COMPANY_ID);
  
  // Set all warehouses of company 11111111-1111-1111-1111-111111111111 to PLANT_ID if null or default
  const { data: whs, error: whErr } = await admin
    .from('warehouses')
    .update({ plant_id: PLANT_ID })
    .eq('company_id', COMPANY_ID)
    .is('plant_id', null)
    .select();
  console.log('Updated null-plant warehouses to Main Plant:', whs, whErr);

  // Ensure Staging & Inspection Bay exists
  const { data: stageWh, error: stageErr } = await admin
    .from('warehouses')
    .upsert({
      id: 'c5e88719-74d3-4903-8278-f7169d2d0001',
      company_id: COMPANY_ID,
      plant_id: PLANT_ID,
      name: 'Staging & Inspection Bay',
      code: 'WH-STAGE',
      status: 'active'
    })
    .select();
  console.log('Staging & Inspection Bay upserted:', stageWh, stageErr);

  console.log('🔄 2. Synchronizing Profiles & Whitelist for quality@abcmfg.demo & warehouse@abcmfg.demo');
  const { data: profs, error: profErr } = await admin
    .from('profiles')
    .update({ company_id: COMPANY_ID, plant_id: PLANT_ID })
    .in('email', ['quality@abcmfg.demo', 'warehouse@abcmfg.demo'])
    .select();
  console.log('Updated profiles:', profs, profErr);

  const { data: wl, error: wlErr } = await admin
    .from('whitelist')
    .update({ company_id: COMPANY_ID, plant_id: PLANT_ID })
    .in('email', ['quality@abcmfg.demo', 'warehouse@abcmfg.demo'])
    .select();
  console.log('Updated whitelist:', wl, wlErr);

  // Ensure user_roles has correct plant_id and company_id
  for (const p of profs || []) {
    const { data: ur, error: urErr } = await admin
      .from('user_roles')
      .update({ company_id: COMPANY_ID, plant_id: PLANT_ID })
      .eq('user_id', p.id)
      .select();
    console.log(`Updated user_roles for ${p.email}:`, ur, urErr);
  }

  console.log('✅ Synchronization complete!');
}

main().catch(console.error);
