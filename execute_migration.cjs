// execute_migration.js — applies the furniture pivot SQL to Supabase
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

const sql = fs.readFileSync('supabase/migrations/20260811000000_furniture_vertical_pivot.sql', 'utf8');

async function run() {
  console.log('Applying furniture pivot migration...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    // Supabase doesn't expose a generic exec_sql; use the REST API directly
    console.log('RPC not available, trying direct REST...');
    // Call the Supabase management API or use pg_net
    // Instead, we'll break SQL into individual statements and use supabase.from
    console.error('Error:', error.message);
  } else {
    console.log('Migration applied OK:', data);
  }
}

run().catch(console.error);
