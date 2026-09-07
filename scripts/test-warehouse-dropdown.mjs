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

const accounts = [
  'procurement@abcmfg.demo',
  'admin@abcmfg.demo',
  'warehouse@abcmfg.demo',
  'quality@abcmfg.demo',
  'supplier@abcmfg.demo'
];

async function main() {
  console.log('=== Testing Warehouse Visibility Per Role ===');
  for (const email of accounts) {
    const client = createClient(supabaseUrl, anonKey);
    const { data: auth, error: authErr } = await client.auth.signInWithPassword({
      email,
      password: 'Factory@2026',
    });
    if (authErr) {
      console.log(`❌ Auth failed for ${email}:`, authErr.message);
      continue;
    }
    const { data: whs, error: whErr } = await client
      .from('warehouses')
      .select('id, name, code, plant_id, company_id, status')
      .eq('company_id', '11111111-1111-1111-1111-111111111111');
    console.log(`👤 ${email} -> Warehouses count: ${whs?.length ?? 0}`, whErr ? `Error: ${whErr.message}` : '');
    if (whs && whs.length > 0) {
      console.log(`   Warehouses: ${whs.map(w => `${w.name} (${w.code})`).join(', ')}`);
    }
  }
}

main().catch(console.error);
