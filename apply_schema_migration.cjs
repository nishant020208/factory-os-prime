// apply_schema_migration.cjs
// Uses Supabase's /rest/v1/rpc endpoint via direct HTTPS to run DDL SQL.
// Falls back to executing statements one by one via the Supabase management API approach.

const https = require('https');
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

const SUPABASE_URL = envVars.SUPABASE_URL;
const SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = envVars.VITE_SUPABASE_PROJECT_ID;

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Execute raw SQL via Supabase's postgres REST endpoint
async function runSQL(sql) {
  const urlObj = new URL(SUPABASE_URL);
  const body = JSON.stringify({ query: sql });
  const result = await httpsRequest({
    hostname: urlObj.hostname,
    path: '/rest/v1/rpc/exec_sql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'apikey': SERVICE_KEY,
      'Content-Length': Buffer.byteLength(body),
    }
  }, body);
  return result;
}

// Try Supabase management API (requires service_role to have exec_sql function)
// If that fails, we'll apply the migration differently
async function main() {
  console.log('Attempting to drop NOT NULL on inventory.product_id...');
  console.log('Project:', PROJECT_REF);
  console.log('Supabase URL:', SUPABASE_URL);

  const statements = [
    'ALTER TABLE public.inventory ALTER COLUMN product_id DROP NOT NULL',
    'ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_product_or_material',
    `ALTER TABLE public.inventory ADD CONSTRAINT inventory_product_or_material CHECK (product_id IS NOT NULL OR material_id IS NOT NULL)`,
  ];

  for (const sql of statements) {
    console.log('Running:', sql);
    const result = await runSQL(sql);
    console.log('Status:', result.status, 'Body:', JSON.stringify(result.body).slice(0, 200));
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
