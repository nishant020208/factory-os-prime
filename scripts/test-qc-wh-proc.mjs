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

const admin = createClient(supabaseUrl, serviceKey);

async function test() {
  console.log('--- 1. Testing Quality Inspector Query ---');
  const qcClient = createClient(supabaseUrl, anonKey);
  const { data: authQc, error: authQcErr } = await qcClient.auth.signInWithPassword({
    email: 'quality@abcmfg.demo',
    password: 'Factory@2026',
  });
  if (authQcErr) console.error('QC auth error:', authQcErr);

  const { data: qcData, error: qcErr } = await qcClient
    .from('incoming_material_inspections')
    .select('*, materials(id, name, unit), warehouses(id, name, code, plant_id), purchase_orders(id, po_number, suppliers(name))')
    .eq('company_id', '11111111-1111-1111-1111-111111111111')
    .order('created_at', { ascending: false });
  console.log('QC Query Result count:', qcData?.length, 'Error:', qcErr);
  if (qcData) {
    console.log('QC inspections data:', JSON.stringify(qcData.slice(0, 3), null, 2));
  }

  console.log('\n--- 2. Testing Warehouse Manager Insert into incoming_material_inspections ---');
  const whClient = createClient(supabaseUrl, anonKey);
  const { data: authWh, error: authWhErr } = await whClient.auth.signInWithPassword({
    email: 'warehouse@abcmfg.demo',
    password: 'Factory@2026',
  });
  if (authWhErr) console.error('WH auth error:', authWhErr);

  const { data: whs } = await admin.from('warehouses').select('*').limit(1);
  const { data: mats } = await admin.from('materials').select('*').limit(1);
  const { data: pos } = await admin.from('purchase_orders').select('*').limit(1);

  const sampleWhId = whs?.[0]?.id;
  const sampleMatId = mats?.[0]?.id;
  const samplePoId = pos?.[0]?.id;

  console.log({ sampleWhId, sampleMatId, samplePoId });

  const insertRes = await whClient.from('incoming_material_inspections').insert({
    company_id: '11111111-1111-1111-1111-111111111111',
    purchase_order_id: samplePoId,
    material_id: sampleMatId,
    warehouse_id: sampleWhId,
    quantity: 10,
    status: 'pending',
  }).select();

  console.log('WH Manager direct insert result:', insertRes.data, 'Error:', insertRes.error);

  if (insertRes.data?.[0]?.id) {
    // clean up test record
    await admin.from('incoming_material_inspections').delete().eq('id', insertRes.data[0].id);
  }

  console.log('\n--- 3. Testing Procurement Manager Warehouse query ---');
  const procClient = createClient(supabaseUrl, anonKey);
  await procClient.auth.signInWithPassword({
    email: 'procurement@abcmfg.demo',
    password: 'Factory@2026',
  });
  const { data: procWhs, error: procWhErr } = await procClient
    .from('warehouses')
    .select('id, name, code')
    .eq('company_id', '11111111-1111-1111-1111-111111111111')
    .order('name');
  console.log('Procurement warehouses count:', procWhs?.length, 'Error:', procWhErr);
}

test().catch(console.error);
