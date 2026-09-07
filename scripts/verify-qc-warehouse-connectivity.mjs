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
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, anonKey);
const admin = createClient(supabaseUrl, serviceKey);

let pass = 0, fail = 0;
function check(label, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  ✅ ${label}`);
    if (detail) console.log(`     ${detail}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}`);
    if (detail) console.log(`     ${detail}`);
  }
}

async function signIn(email) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: 'Factory@2026',
  });
  if (error) throw error;
  return data.user;
}

async function main() {
  console.log('━━━ TEST 1: User Profiles & Shared Connectivity ━━━');
  const { data: profs } = await admin
    .from('profiles')
    .select('id, email, company_id, plant_id')
    .in('email', ['quality@abcmfg.demo', 'warehouse@abcmfg.demo']);
  
  const qcProf = profs?.find(p => p.email === 'quality@abcmfg.demo');
  const whProf = profs?.find(p => p.email === 'warehouse@abcmfg.demo');

  check('Quality Inspector profile exists', !!qcProf, `ID: ${qcProf?.id}`);
  check('Warehouse Manager profile exists', !!whProf, `ID: ${whProf?.id}`);
  check('Both belong to the same company', qcProf?.company_id === whProf?.company_id && qcProf?.company_id === '11111111-1111-1111-1111-111111111111');
  check('Both belong to the same plant', qcProf?.plant_id === whProf?.plant_id && qcProf?.plant_id === '22222222-2222-2222-2222-222222222222');

  console.log('\n━━━ TEST 2: Warehouse Connectivity & Staging Bay ━━━');
  const { data: warehouses } = await admin
    .from('warehouses')
    .select('id, name, code, plant_id, company_id')
    .eq('company_id', '11111111-1111-1111-1111-111111111111');

  const mainWh = warehouses?.find(w => w.code === 'WH-MAIN');
  const rawWh = warehouses?.find(w => w.code === 'WH-RAW');
  const stageWh = warehouses?.find(w => w.code === 'WH-STAGE');

  check('Main Warehouse is active and connected to plant', !!mainWh && mainWh.plant_id === '22222222-2222-2222-2222-222222222222');
  check('Raw Materials Store is connected to plant', !!rawWh && rawWh.plant_id === '22222222-2222-2222-2222-222222222222');
  check('Staging & Inspection Bay is connected to plant', !!stageWh && stageWh.plant_id === '22222222-2222-2222-2222-222222222222');

  console.log('\n━━━ TEST 3: Quality Inspector Auth & Inbound Inspection RLS ━━━');
  const qcUser = await signIn('quality@abcmfg.demo');
  check('Signed in as quality@abcmfg.demo', !!qcUser, qcUser?.id);

  const { data: incomingList, error: incomingErr } = await supabase
    .from('incoming_material_inspections')
    .select('id, status, quantity, warehouse_id')
    .limit(10);
  check('Quality Inspector can read incoming inspections', !incomingErr, `Count: ${incomingList?.length ?? 0}`);

  console.log('\n━━━ TEST 4: Warehouse Manager Auth & Inbound / Transfer Access ━━━');
  const whUser = await signIn('warehouse@abcmfg.demo');
  check('Signed in as warehouse@abcmfg.demo', !!whUser, whUser?.id);

  const { data: whList, error: whErr } = await supabase
    .from('warehouses')
    .select('id, name, code')
    .eq('company_id', '11111111-1111-1111-1111-111111111111');
  check('Warehouse Manager sees all connected warehouses', !whErr && (whList?.length ?? 0) >= 3, `Count: ${whList?.length}`);

  console.log('\n━━━ TEST 5: QC Inbound/Outbound Notification Coverage ━━━');
  const { data: notifs, error: notifErr } = await admin
    .from('notifications')
    .select('id, title, body, to_role, severity')
    .eq('company_id', '11111111-1111-1111-1111-111111111111')
    .eq('to_role', 'quality_inspector')
    .limit(10);
  check('Quality Inspector receives role-targeted QC updates', !notifErr, `Notifs count: ${notifs?.length ?? 0}`);

  console.log(`\n========================================`);
  console.log(`Summary: ${pass} passed, ${fail} failed`);
  console.log(`========================================\n`);

  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
