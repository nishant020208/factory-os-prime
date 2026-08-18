import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env from both .env.local and .env
const env = {};
for (const src of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(src, 'utf8').replace(/\r/g, '').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    }
  } catch {}
}

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !anonKey || !serviceKey) { console.error('Missing env vars'); process.exit(1); }

const supabase = createClient(supabaseUrl, anonKey);
const admin = createClient(supabaseUrl, serviceKey);

let pass = 0, fail = 0;
function check(label, ok, detail = '') {
  if (ok) { pass++; console.log('  ✅ ' + label); if (detail) console.log('     ' + detail); }
  else { fail++; console.log('  ❌ ' + label); if (detail) console.log('     ' + detail); }
}

// Use Artisan Furniture Works where the Quality Inspector is seeded
const companyId = '11111111-1111-1111-1111-111111111111';
console.log('\n🏢 Company: Artisan Furniture Works (' + companyId + ')');

// Quality Inspector account
const qiId = 'f0441dcf-7426-4f4b-b6aa-80598f2c48ef';
const qiEmail = 'quality@abcmfg.demo';
console.log('👤 Quality Inspector: ' + qiId);
console.log('📧 Email: ' + qiEmail);

// Sign in as Quality Inspector
const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
  email: qiEmail,
  password: 'Factory@2026'
});
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
console.log('🔑 Signed in as Quality Inspector\n');

// ─── TEST 1: PASS inspection with real parameters ───
console.log('━━━ TEST 1: PASS Inspection ━━━');
const passInspectionNumber = 'QI-PASS-' + Date.now();
const { data: insp1, error: insp1Err } = await supabase.from('quality_inspections').insert({
  company_id: companyId,
  inspection_number: passInspectionNumber,
  inspection_type: 'final',
  inspector_id: qiId,
  result: 'pending',
  quantity_checked: 1,
  overall_notes: 'Test pass inspection — all parameters within spec',
}).select('id').single();

check('Inspection created (PASS)', !!insp1, insp1?.id);
if (insp1Err) console.log('   Error: ' + insp1Err.message);

if (insp1) {
  // Insert parameters — all passing
  const passParams = [
    { company_id: companyId, inspection_id: insp1.id, category: 'wood_material', parameter_name: 'Wood Moisture Content', measured_value: '9.4', unit: '%', acceptable_range: '8–12%', result: 'pass', notes: 'Within spec' },
    { company_id: companyId, inspection_id: insp1.id, category: 'wood_material', parameter_name: 'Wood Hardness', measured_value: 'Hard', acceptable_range: 'Soft/Medium/Hard', result: 'pass' },
    { company_id: companyId, inspection_id: insp1.id, category: 'wood_material', parameter_name: 'Grain Consistency', measured_value: 'Consistent', acceptable_range: 'Consistent/Minor Variation/Inconsistent', result: 'pass' },
    { company_id: companyId, inspection_id: insp1.id, category: 'wood_material', parameter_name: 'Knots & Defects Count', measured_value: '1', unit: 'count', acceptable_range: '0–2 per surface', result: 'pass' },
    { company_id: companyId, inspection_id: insp1.id, category: 'wood_material', parameter_name: 'Warping/Bowing', measured_value: '0.8', unit: 'mm', acceptable_range: '<2mm per 1000mm', result: 'pass' },
    { company_id: companyId, inspection_id: insp1.id, category: 'wood_material', parameter_name: 'Insect/Pest Damage', measured_value: 'Pass', acceptable_range: 'Absent required', result: 'pass' },
    { company_id: companyId, inspection_id: insp1.id, category: 'structural', parameter_name: 'Joint Type Verification', measured_value: 'Mortise-Tenon', acceptable_range: 'Match design spec', result: 'pass' },
    { company_id: companyId, inspection_id: insp1.id, category: 'structural', parameter_name: 'Joint Tightness', measured_value: 'Pass', acceptable_range: 'No visible movement', result: 'pass' },
    { company_id: companyId, inspection_id: insp1.id, category: 'surface_finish', parameter_name: 'Polish/Lacquer Evenness', measured_value: 'Even', acceptable_range: 'Even/Minor Unevenness/Uneven', result: 'pass' },
    { company_id: companyId, inspection_id: insp1.id, category: 'surface_finish', parameter_name: 'Color Match', measured_value: 'Match', acceptable_range: 'Match/Minor Variance/Mismatch', result: 'pass' },
    { company_id: companyId, inspection_id: insp1.id, category: 'safety', parameter_name: 'Edge/Corner Safety', measured_value: 'Pass', acceptable_range: 'No sharp edges', result: 'pass' },
    { company_id: companyId, inspection_id: insp1.id, category: 'safety', parameter_name: 'Stability Test', measured_value: 'Pass', acceptable_range: 'No tip under normal use', result: 'pass' },
  ];

  const { error: paramErr1 } = await supabase.from('quality_inspection_parameters').insert(passParams);
  check('Parameters inserted (12 params)', !paramErr1, paramErr1?.message);

  // Verify the trigger computed the overall result
  await new Promise(r => setTimeout(r, 500));
  const { data: insp1Check } = await admin.from('quality_inspections').select('result').eq('id', insp1.id).single();
  check('Overall result auto-computed to PASS', insp1Check?.result === 'pass', 'result: ' + insp1Check?.result);

  // Verify parameters are queryable
  const { data: params1 } = await supabase.from('quality_inspection_parameters').select('*').eq('inspection_id', insp1.id);
  check('Parameters queryable (12 rows)', params1?.length === 12, 'count: ' + params1?.length);
}

// ─── TEST 2: FAIL inspection with specific failed parameter ───
console.log('\n━━━ TEST 2: FAIL Inspection ━━━');
const failInspectionNumber = 'QI-FAIL-' + Date.now();
const { data: insp2, error: insp2Err } = await supabase.from('quality_inspections').insert({
  company_id: companyId,
  inspection_number: failInspectionNumber,
  inspection_type: 'final',
  inspector_id: qiId,
  result: 'pending',
  quantity_checked: 1,
  overall_notes: 'Test fail — moisture content exceeds threshold',
}).select('id').single();

check('Inspection created (FAIL)', !!insp2, insp2?.id);
if (insp2Err) console.log('   Error: ' + insp2Err.message);

if (insp2) {
  // Insert parameters — one mandatory FAIL (moisture content at 14.2%)
  const failParams = [
    { company_id: companyId, inspection_id: insp2.id, category: 'wood_material', parameter_name: 'Wood Moisture Content', measured_value: '14.2', unit: '%', acceptable_range: '8–12%', result: 'fail', notes: 'EXCEEDS 12% threshold — warping risk' },
    { company_id: companyId, inspection_id: insp2.id, category: 'wood_material', parameter_name: 'Wood Hardness', measured_value: 'Hard', acceptable_range: 'Soft/Medium/Hard', result: 'pass' },
    { company_id: companyId, inspection_id: insp2.id, category: 'structural', parameter_name: 'Joint Tightness', measured_value: 'Pass', acceptable_range: 'No visible movement', result: 'pass' },
    { company_id: companyId, inspection_id: insp2.id, category: 'surface_finish', parameter_name: 'Polish/Lacquer Evenness', measured_value: 'Even', acceptable_range: 'Even/Minor Unevenness/Uneven', result: 'pass' },
    { company_id: companyId, inspection_id: insp2.id, category: 'safety', parameter_name: 'Edge/Corner Safety', measured_value: 'Pass', acceptable_range: 'No sharp edges', result: 'pass' },
  ];

  const { error: paramErr2 } = await supabase.from('quality_inspection_parameters').insert(failParams);
  check('Parameters inserted (5 params, 1 fail)', !paramErr2, paramErr2?.message);

  // Verify the trigger computed FAIL (moisture content is in wood_material = mandatory category)
  await new Promise(r => setTimeout(r, 500));
  const { data: insp2Check } = await admin.from('quality_inspections').select('result').eq('id', insp2.id).single();
  check('Overall result auto-computed to FAIL (mandatory category)', insp2Check?.result === 'fail', 'result: ' + insp2Check?.result);
}

// ─── TEST 3: Verify downstream data ───
console.log('\n━━━ TEST 3: Downstream Verification ━━━');

// Check quality_inspections table
const { data: allInsps } = await admin.from('quality_inspections').select('id, inspection_number, result').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5);
check('Quality inspections in DB', allInsps?.length >= 2, 'latest: ' + (allInsps?.map(i => i.inspection_number + '=' + i.result).join(', ') || 'none'));

// Check quality_inspection_parameters table
const { data: allParams } = await admin.from('quality_inspection_parameters').select('id, inspection_id, parameter_name, result').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20);
check('Quality inspection parameters in DB', allParams?.length >= 17, 'count: ' + allParams?.length);

// Check failed parameters specifically
const failedParamsCheck = allParams?.filter(p => p.result === 'fail') || [];
check('Failed parameters tracked', failedParamsCheck.length >= 1, 'failures: ' + failedParamsCheck.map(p => p.parameter_name).join(', '));

// ─── TEST 4: Audit trail ───
console.log('\n━━━ TEST 4: Audit Trail ━━━');
const { data: auditRows } = await admin.from('audit_logs')
  .select('id, action, entity, entity_id, user_id, created_at')
  .eq('user_id', qiId)
  .order('created_at', { ascending: false })
  .limit(5);

check('Audit log entries exist for Quality Inspector', auditRows?.length > 0, 'latest: ' + (auditRows?.[0]?.action || 'none') + ' on ' + (auditRows?.[0]?.entity || 'none'));

// ─── TEST 5: Schema verification ───
console.log('\n━━━ TEST 5: Schema Verification ━━━');
const { data: tableCheck } = await admin.from('quality_inspection_parameters').select('id').limit(1);
check('quality_inspection_parameters table exists and is queryable', !!tableCheck);

const { data: sampleParam } = await admin.from('quality_inspection_parameters')
  .select('id, company_id, inspection_id, category, parameter_name, measured_value, unit, acceptable_range, result, notes, photo_url, created_at, updated_at')
  .limit(1)
  .single();
check('All expected columns present', !!sampleParam, sampleParam ? 'columns: ' + Object.keys(sampleParam).join(', ') : 'no data');

// ─── RESULTS ───
console.log('\n' + '═'.repeat(50));
console.log('RESULTS: ' + pass + ' passed, ' + fail + ' failed out of ' + (pass + fail) + ' checks');
console.log('═'.repeat(50));

// Cleanup test data
console.log('\n🧹 Cleaning up test data...');
if (insp1) {
  await admin.from('quality_inspection_parameters').delete().eq('inspection_id', insp1.id);
  await admin.from('quality_inspections').delete().eq('id', insp1.id);
}
if (insp2) {
  await admin.from('quality_inspection_parameters').delete().eq('inspection_id', insp2.id);
  await admin.from('quality_inspections').delete().eq('id', insp2.id);
}
console.log('✅ Cleanup complete');

process.exit(fail > 0 ? 1 : 0);
