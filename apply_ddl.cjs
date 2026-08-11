// apply_ddl.cjs — uses Supabase's pg-meta / management API to run DDL
// The service_role JWT can call the Database API if we use the correct endpoint

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

const PROJECT_REF = envVars.VITE_SUPABASE_PROJECT_ID;
const SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      hostname,
      path,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(bodyStr),
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('Project:', PROJECT_REF);

  // Try 1: Supabase DB API (pg-meta) at api.supabase.com
  const sql = `ALTER TABLE public.inventory ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_product_or_material;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_product_or_material CHECK (product_id IS NOT NULL OR material_id IS NOT NULL);`;

  const result1 = await httpsPost(
    'api.supabase.com',
    `/v1/projects/${PROJECT_REF}/database/query`,
    {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    { query: sql }
  );
  console.log('Management API attempt:', result1.status, JSON.stringify(result1.body).slice(0, 300));

  // Try 2: Direct pg-meta endpoint on the project
  const result2 = await httpsPost(
    `${PROJECT_REF}.supabase.co`,
    '/pg/query',
    {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
    },
    { query: sql }
  );
  console.log('pg-meta endpoint:', result2.status, JSON.stringify(result2.body).slice(0, 300));

  // Try 3: REST with a custom header
  const result3 = await httpsPost(
    `${PROJECT_REF}.supabase.co`,
    '/rest/v1/',
    {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Prefer': 'params=single-object',
    },
    { query: sql }
  );
  console.log('REST attempt:', result3.status, JSON.stringify(result3.body).slice(0, 300));
}

main().catch(e => { console.error(e.message); process.exit(1); });
