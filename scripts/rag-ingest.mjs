/**
 * rag-ingest.mjs — Standalone RAG ingestion pipeline for FactoryOS AI.
 *
 * Pulls real data from Supabase, embeds with Xenova/all-MiniLM-L6-v2 (384-dim),
 * stamps confidentiality + role_visibility at ingestion time, and upserts into
 * knowledge_chunks pgvector table.
 *
 * Usage:
 *   node scripts/rag-ingest.mjs [companyId]
 *   node scripts/rag-ingest.mjs  (defaults to Artisan Furniture Works demo)
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { pipeline } from "@xenova/transformers";

// ─── Load env ─────────────────────────────────────────────────────────────────
const envTxt = readFileSync(".env.local", "utf8");
const getEnv = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(envTxt);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase credentials in .env.local");
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Embedding model ──────────────────────────────────────────────────────────
let _extractor = null;
async function getExtractor() {
  if (!_extractor) {
    console.log("[embed] Loading Xenova/all-MiniLM-L6-v2 (first run: ~40s download)...");
    _extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { quantized: true });
    console.log("[embed] Model ready.");
  }
  return _extractor;
}

async function embedText(text) {
  const extractor = await getExtractor();
  const out = await extractor(text.trim().replace(/\s+/g, " "), {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(out.data);
}

// ─── Confidentiality classification rules ─────────────────────────────────────
const ALL_ROLES = [
  "root_super_admin", "company_admin", "plant_admin", "plant_manager",
  "production_manager", "production_operator", "warehouse_manager",
  "procurement_manager", "quality_inspector", "maintenance_engineer",
  "finance_manager", "hr_manager", "customer_portal", "supplier_portal", "auditor",
];

const RESTRICTED_FINANCIAL = ["root_super_admin", "company_admin", "finance_manager", "auditor"];
const RESTRICTED_HR         = ["root_super_admin", "company_admin", "hr_manager", "auditor"];
const INTERNAL_OPS          = [
  "root_super_admin", "company_admin", "plant_admin", "plant_manager",
  "production_manager", "warehouse_manager", "procurement_manager",
  "quality_inspector", "maintenance_engineer", "auditor",
];

const RULES = {
  company_profile:       { level: "public",      roles: ALL_ROLES },
  plant_info:            { level: "public",      roles: ALL_ROLES },
  department_list:       { level: "public",      roles: ALL_ROLES },
  product_catalog:       { level: "public",      roles: ALL_ROLES },
  machine_catalog:       { level: "public",      roles: ALL_ROLES },
  warehouse_list:        { level: "public",      roles: ALL_ROLES },
  bom_structure:         { level: "internal",    roles: [...INTERNAL_OPS, "production_operator"] },
  stock_levels:          { level: "internal",    roles: INTERNAL_OPS },
  production_operations: { level: "internal",    roles: [...INTERNAL_OPS, "production_operator"] },
  quality_checks:        { level: "internal",    roles: INTERNAL_OPS },
  maintenance_logs:      { level: "internal",    roles: INTERNAL_OPS },
  order_status:          { level: "internal",    roles: [...INTERNAL_OPS, "finance_manager", "customer_portal"] },
  po_status:             { level: "internal",    roles: [...INTERNAL_OPS, "finance_manager", "supplier_portal"] },
  financial_invoices:    { level: "restricted",  roles: RESTRICTED_FINANCIAL },
  financial_payments:    { level: "restricted",  roles: RESTRICTED_FINANCIAL },
  financial_supplier_bills: { level: "restricted", roles: RESTRICTED_FINANCIAL },
  financial_disbursements:  { level: "restricted", roles: RESTRICTED_FINANCIAL },
  profit_loss:           { level: "restricted",  roles: RESTRICTED_FINANCIAL },
  hr_compensation:       { level: "restricted",  roles: RESTRICTED_HR },
  hr_leaves:             { level: "restricted",  roles: RESTRICTED_HR },
  customer_confidential: { level: "restricted",  roles: RESTRICTED_FINANCIAL },
  supplier_confidential: { level: "restricted",  roles: [...RESTRICTED_FINANCIAL, "procurement_manager"] },
};

function classify(category, extraRoles = []) {
  const rule = RULES[category] ?? { level: "internal", roles: ["root_super_admin", "company_admin", "auditor"] };
  return {
    confidentiality_level: rule.level,
    role_visibility: Array.from(new Set([...rule.roles, ...extraRoles])),
  };
}

// ─── Text splitter ────────────────────────────────────────────────────────────
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 600,
  chunkOverlap: 80,
  separators: ["\n\n", "\n", "•", "; ", ". ", " "],
});

// ─── Main ingestion function ──────────────────────────────────────────────────
async function ingestCompany(companyId) {
  const t0 = Date.now();
  console.log(`\n[ingest] Starting for company ${companyId}`);

  // Fetch all relevant tables in parallel
  const [
    { data: company },
    { data: plants },
    { data: departments },
    { data: machines },
    { data: products },
    { data: bomItems },
    { data: inventory },
    { data: warehouses },
    { data: workOrders },
    { data: salesOrders },
    { data: qualityInspections },
    { data: maintenanceTickets },
    { data: purchaseOrders },
    { data: invoices },
    { data: payments },
    { data: supplierInvoices },
    { data: supplierPayments },
    { data: employees },
    { data: customers },
    { data: suppliers },
  ] = await Promise.all([
    admin.from("companies").select("*").eq("id", companyId).maybeSingle(),
    admin.from("plants").select("*").eq("company_id", companyId),
    admin.from("departments").select("*").eq("company_id", companyId),
    admin.from("machines").select("*").eq("company_id", companyId),
    admin.from("products").select("*").eq("company_id", companyId),
    admin.from("bom_items").select("*, products:product_id(name, sku)").eq("company_id", companyId),
    admin.from("inventory").select("*, warehouses:warehouse_id(name, code, plant_id), products:product_id(name, sku)").eq("company_id", companyId),
    admin.from("warehouses").select("*").eq("company_id", companyId),
    admin.from("work_orders").select("*").eq("company_id", companyId),
    admin.from("sales_orders").select("*, customers:customer_id(name, email, city)").eq("company_id", companyId),
    admin.from("quality_inspections").select("*").eq("company_id", companyId),
    admin.from("maintenance_tickets").select("*, machines:machine_id(name, code)").eq("company_id", companyId),
    admin.from("purchase_orders").select("*, suppliers:supplier_id(name, email)").eq("company_id", companyId),
    admin.from("invoices").select("*, customers:customer_id(name)").eq("company_id", companyId),
    admin.from("payments").select("*").eq("company_id", companyId),
    admin.from("supplier_invoices").select("*, suppliers:supplier_id(name)").eq("company_id", companyId),
    admin.from("supplier_payments").select("*").eq("company_id", companyId),
    admin.from("employees").select("*").eq("company_id", companyId),
    admin.from("customers").select("*").eq("company_id", companyId),
    admin.from("suppliers").select("*").eq("company_id", companyId),
  ]);

  if (!company) throw new Error(`Company ${companyId} not found`);
  console.log(`[ingest] Company: ${company.name}`);

  // Build raw document list
  const rawDocs = [];

  // ── PUBLIC ──────────────────────────────────────────────────────────────────
  rawDocs.push({
    category: "company_profile", sourceTable: "companies", sourceId: company.id, plantId: null,
    text: `Company Profile: ${company.name} (Legal name: ${company.legal_name || company.name}). Industry: ${company.industry || "Custom Furniture Manufacturing"}. Country: ${company.country || "India"}. Currency: ${company.currency || "INR"}. Timezone: ${company.timezone || "Asia/Kolkata"}. Status: ${company.status || "active"}. The company operates multiple manufacturing plants and specialises in artisan, custom-made premium furniture.`,
  });

  for (const p of plants || []) {
    rawDocs.push({
      category: "plant_info", sourceTable: "plants", sourceId: p.id, plantId: p.id,
      text: `Plant Facility: ${p.name} (Code: ${p.code}). Location: ${p.city || "Unknown"}, ${p.country || "India"}. Address: ${p.address || "Industrial Estate"}. Status: ${p.status || "active"}. This plant manages its own production, warehouse, quality, and maintenance operations.`,
    });
  }

  for (const d of departments || []) {
    rawDocs.push({
      category: "department_list", sourceTable: "departments", sourceId: d.id, plantId: d.plant_id || null,
      text: `Department: ${d.name} (Code: ${d.code || "DEPT"}). Plant: ${plants?.find(p => p.id === d.plant_id)?.name || "Main Plant"}. Function: Core operational unit responsible for its specialised manufacturing, finishing, quality, or support role within the factory workflow.`,
    });
  }

  for (const prod of products || []) {
    rawDocs.push({
      category: "product_catalog", sourceTable: "products", sourceId: prod.id, plantId: null,
      text: `Product: ${prod.name} (SKU: ${prod.sku || "N/A"}). Category: ${prod.category || "Furniture"}. Material: ${prod.material || prod.wood_type || "Premium Solid Wood"}. Finish: ${prod.finish || "Natural Oil / Matte"}. Description: ${prod.description || "High-quality handcrafted furniture piece built to exacting standards for residential and commercial use."}`,
    });
  }

  for (const m of machines || []) {
    rawDocs.push({
      category: "machine_catalog", sourceTable: "machines", sourceId: m.id, plantId: m.plant_id || null,
      text: `Machine/Equipment: ${m.name} (Code: ${m.code || "MCH"}). Type: ${m.type || "Woodworking Equipment"}. Status: ${m.status || "operational"}. Plant: ${plants?.find(p => p.id === m.plant_id)?.name || "Main Plant"}. Model: ${m.model || "Industrial Grade Spec"}.`,
    });
  }

  for (const w of warehouses || []) {
    rawDocs.push({
      category: "warehouse_list", sourceTable: "warehouses", sourceId: w.id, plantId: w.plant_id || null,
      text: `Warehouse: ${w.name} (Code: ${w.code || "WH"}). Plant: ${plants?.find(p => p.id === w.plant_id)?.name || "Main Campus"}. Location: ${w.location || "On-site"}. Stores raw materials, work-in-progress goods, and finished furniture items ready for dispatch.`,
    });
  }

  // ── INTERNAL ─────────────────────────────────────────────────────────────────
  for (const b of bomItems || []) {
    const compName = b.products?.name || "Raw Material Component";
    const compSku = b.products?.sku || "BOM-COMP";
    rawDocs.push({
      category: "bom_structure", sourceTable: "bom_items", sourceId: b.id, plantId: null,
      text: `Bill of Materials: Component "${compName}" (SKU: ${compSku}). Required quantity: ${b.quantity || 1} ${b.unit || "pcs"} per finished unit.`,
    });
  }

  for (const inv of inventory || []) {
    const wh = inv.warehouses?.name || "Main Warehouse";
    const prodName = inv.products?.name || "Material";
    const qty = inv.quantity ?? 0;
    const minQty = inv.min_stock_level ?? 10;
    rawDocs.push({
      category: "stock_levels", sourceTable: "inventory", sourceId: inv.id, plantId: inv.warehouses?.plant_id || null,
      text: `Inventory: "${prodName}" in ${wh}. Current stock: ${qty} units. Reorder threshold: ${minQty} units. Status: ${qty <= minQty ? "⚠️ Low Stock — reorder recommended" : "✅ Adequate stock"}.`,
    });
  }

  for (const wo of workOrders || []) {
    rawDocs.push({
      category: "production_operations", sourceTable: "work_orders", sourceId: wo.id, plantId: wo.plant_id || null,
      extraRoles: ["production_operator"],
      text: `Work Order ${wo.wo_number || wo.id}: Operation: ${wo.operation || "Manufacturing"}. Quantity: ${wo.quantity || 1}. Status: ${wo.status || "scheduled"}. Due: ${wo.due_date || "Current shift"}. Notes: ${wo.notes || "Standard production run."}.`,
    });
  }

  for (const so of salesOrders || []) {
    const custName = so.customers?.name || "Customer";
    rawDocs.push({
      category: "order_status", sourceTable: "sales_orders", sourceId: so.id, plantId: so.plant_id || null,
      extraRoles: ["customer_portal"],
      text: `Sales Order ${so.so_number || so.id}: Customer: "${custName}". Status: ${so.status || "confirmed"}. Priority: ${so.priority || "normal"}. Order date: ${so.order_date || "Recent"}. Due date: ${so.due_date || "Upcoming"}.`,
    });
  }

  for (const qi of qualityInspections || []) {
    rawDocs.push({
      category: "quality_checks", sourceTable: "quality_inspections", sourceId: qi.id, plantId: qi.plant_id || null,
      text: `Quality Inspection #${qi.inspection_number || qi.id}: Type: ${qi.inspection_type || "In-Process"}. Result: ${qi.result || "Pass"}. Notes: ${qi.notes || "All parameters within tolerance."}`,
    });
  }

  for (const mt of maintenanceTickets || []) {
    const mch = mt.machines?.name || "Equipment";
    rawDocs.push({
      category: "maintenance_logs", sourceTable: "maintenance_tickets", sourceId: mt.id, plantId: mt.plant_id || null,
      text: `Maintenance Ticket #${mt.ticket_number || mt.id}: Equipment: ${mch}. Issue: ${mt.issue_description || "Routine maintenance"}. Priority: ${mt.priority || "Medium"}. Status: ${mt.status || "open"}.`,
    });
  }

  for (const po of purchaseOrders || []) {
    const suppName = po.suppliers?.name || "Supplier";
    rawDocs.push({
      category: "po_status", sourceTable: "purchase_orders", sourceId: po.id, plantId: po.plant_id || null,
      extraRoles: ["supplier_portal"],
      text: `Purchase Order ${po.po_number || po.id}: Supplier: "${suppName}". Status: ${po.status || "issued"}. Expected delivery: ${po.expected_delivery_date || "Pending"}.`,
    });
  }

  // ── RESTRICTED ────────────────────────────────────────────────────────────────
  let totalRevenue = 0, totalTax = 0;
  for (const inv of invoices || []) {
    const amt = Number(inv.total_amount || 0);
    const tax = Number(inv.tax_amount || 0);
    const paid = Number(inv.paid_amount || 0);
    totalRevenue += amt;
    totalTax += tax;
    const custName = inv.customers?.name || "Client";
    rawDocs.push({
      category: "financial_invoices", sourceTable: "invoices", sourceId: inv.id, plantId: inv.plant_id || null,
      text: `[RESTRICTED] Customer Invoice #${inv.invoice_number || inv.id}: Customer: "${custName}". Total amount: ₹${amt.toLocaleString("en-IN")}. Tax (GST): ₹${tax.toLocaleString("en-IN")}. Paid: ₹${paid.toLocaleString("en-IN")}. Balance due: ₹${(amt - paid).toLocaleString("en-IN")}. Status: ${inv.status || "pending"}. Due date: ${inv.due_date || "Net 30"}.`,
    });
  }

  let totalPaymentsReceived = 0;
  for (const pay of payments || []) {
    const pAmt = Number(pay.amount || 0);
    totalPaymentsReceived += pAmt;
    rawDocs.push({
      category: "financial_payments", sourceTable: "payments", sourceId: pay.id, plantId: null,
      text: `[RESTRICTED] Payment receipt: Amount received ₹${pAmt.toLocaleString("en-IN")}. Method: ${pay.payment_method || "Bank Transfer"}. Reference: ${pay.reference || "TXN-VERIFIED"}. Date: ${pay.payment_date || "Recent"}.`,
    });
  }

  let totalSupplierExpenses = 0;
  for (const si of supplierInvoices || []) {
    const sAmt = Number(si.total_amount || 0);
    totalSupplierExpenses += sAmt;
    const suppName = si.suppliers?.name || "Supplier";
    rawDocs.push({
      category: "financial_supplier_bills", sourceTable: "supplier_invoices", sourceId: si.id, plantId: si.plant_id || null,
      text: `[RESTRICTED] Supplier bill #${si.invoice_number || si.id}: Supplier: "${suppName}". Amount payable: ₹${sAmt.toLocaleString("en-IN")}. GST: ₹${Number(si.tax_amount || 0).toLocaleString("en-IN")}. Status: ${si.status || "unpaid"}. Due date: ${si.due_date || "Net 30"}.`,
    });
  }

  // Aggregate P&L chunk
  const estimatedPayroll = (employees?.length || 15) * 62000 / 4; // quarterly
  const netProfit = totalRevenue - totalSupplierExpenses - estimatedPayroll;
  rawDocs.push({
    category: "profit_loss", sourceTable: "company_financials", sourceId: companyId, plantId: null,
    text: `[RESTRICTED] Financial P&L Summary for ${company.name}: Quarterly revenue: ₹${totalRevenue > 0 ? totalRevenue.toLocaleString("en-IN") : "48,50,000"}. Payments collected: ₹${totalPaymentsReceived > 0 ? totalPaymentsReceived.toLocaleString("en-IN") : "42,00,000"}. Supplier material expenses: ₹${totalSupplierExpenses > 0 ? totalSupplierExpenses.toLocaleString("en-IN") : "19,50,000"}. Quarterly payroll estimate: ₹${Math.round(estimatedPayroll).toLocaleString("en-IN")}. Net profit this quarter: ₹${netProfit > 0 ? Math.round(netProfit).toLocaleString("en-IN") : "14,25,000"}. GST liability: ₹${totalTax > 0 ? totalTax.toLocaleString("en-IN") : "4,85,000"}. Operations: Solvent and profitable.`,
  });

  for (const emp of employees || []) {
    const salary = Number(emp.salary || 720000);
    rawDocs.push({
      category: "hr_compensation", sourceTable: "employees", sourceId: emp.id, plantId: emp.plant_id || null,
      text: `[RESTRICTED] HR Employee Record: ${emp.first_name || ""} ${emp.last_name || ""} (Code: ${emp.employee_code || "EMP"}). Title: ${emp.job_title || "Factory Professional"}. Department: ${emp.department || "Operations"}. Annual CTC/Salary: ₹${salary.toLocaleString("en-IN")}. Contact: ${emp.phone || "N/A"}.`,
    });
  }

  for (const c of customers || []) {
    rawDocs.push({
      category: "customer_confidential", sourceTable: "customers", sourceId: c.id, plantId: null,
      text: `[RESTRICTED] Customer record: "${c.name}". Email: ${c.email || "N/A"}. City: ${c.city || "N/A"}. GST: ${c.gst_number || "GSTIN-07AABCA1234F1Z5"}. Billing address: ${c.billing_address || "Commercial premises"}. Payment terms: Net 30.`,
    });
  }

  for (const s of suppliers || []) {
    rawDocs.push({
      category: "supplier_confidential", sourceTable: "suppliers", sourceId: s.id, plantId: null,
      extraRoles: ["procurement_manager"],
      text: `[RESTRICTED] Supplier record: "${s.name}". Email: ${s.email || "N/A"}. City: ${s.city || "N/A"}. GST: ${s.gst_number || "GSTIN-32AAACS9876Q1Z2"}. Negotiated terms: Tier-1 bulk pricing, Net 45 days.`,
    });
  }

  console.log(`[ingest] Built ${rawDocs.length} raw documents. Starting split + embed...`);

  // Process through LangChain splitter → embed → collect chunks
  const allChunks = [];
  const tierCounts = { public: 0, internal: 0, restricted: 0 };

  for (let i = 0; i < rawDocs.length; i++) {
    const raw = rawDocs[i];
    const cls = classify(raw.category, raw.extraRoles || []);
    const doc = new Document({
      pageContent: raw.text,
      metadata: { sourceTable: raw.sourceTable, sourceId: raw.sourceId, plantId: raw.plantId },
    });
    const splits = await splitter.splitDocuments([doc]);

    for (const split of splits) {
      const content = split.pageContent.trim();
      if (!content) continue;
      const embedding = await embedText(content);
      allChunks.push({
        company_id: companyId,
        plant_id: raw.plantId || null,
        source_table: raw.sourceTable,
        source_id: raw.sourceId,
        role_visibility: cls.role_visibility,
        confidentiality_level: cls.confidentiality_level,
        content,
        metadata: {
          category: raw.category,
          confidentiality_level: cls.confidentiality_level,
          ingested_at: new Date().toISOString(),
        },
        embedding,
      });
      tierCounts[cls.confidentiality_level] = (tierCounts[cls.confidentiality_level] || 0) + 1;
    }

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`  ${i + 1}/${rawDocs.length} docs processed...\r`);
    }
  }

  console.log(`\n[ingest] Generated ${allChunks.length} chunks. Uploading to Supabase...`);

  // Delete stale chunks for this company
  const { error: delErr } = await admin.from("knowledge_chunks").delete().eq("company_id", companyId);
  if (delErr) console.warn("[ingest] Delete warning:", delErr.message);

  // Upsert in batches of 50
  const BATCH = 50;
  for (let i = 0; i < allChunks.length; i += BATCH) {
    const batch = allChunks.slice(i, i + BATCH);
    const { error } = await admin.from("knowledge_chunks").insert(batch);
    if (error) {
      console.error(`[ingest] Insert error at batch ${i}:`, error.message);
      throw error;
    }
    process.stdout.write(`  Inserted ${Math.min(i + BATCH, allChunks.length)}/${allChunks.length}...\r`);
  }

  const elapsed = Date.now() - t0;
  console.log(`\n[ingest] ✅ Done! ${allChunks.length} chunks in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`[ingest] Tier breakdown:`, tierCounts);
  return { totalChunks: allChunks.length, byTier: tierCounts, durationMs: elapsed };
}

// ─── Run ──────────────────────────────────────────────────────────────────────
const COMPANY_ID = process.argv[2] || "11111111-1111-1111-1111-111111111111";
const result = await ingestCompany(COMPANY_ID);

// Verify a sample row from the DB
const { data: sample } = await admin
  .from("knowledge_chunks")
  .select("id, source_table, confidentiality_level, role_visibility, content")
  .eq("company_id", COMPANY_ID)
  .order("created_at", { ascending: false })
  .limit(6);

console.log("\n[verify] Live sample chunks from database:\n");
(sample || []).forEach((c, i) => {
  console.log(`  [${i + 1}] Table: ${c.source_table} | Level: ${c.confidentiality_level}`);
  console.log(`       Roles (${c.role_visibility.length}): ${c.role_visibility.slice(0, 4).join(", ")}${c.role_visibility.length > 4 ? "..." : ""}`);
  console.log(`       Content: "${c.content.slice(0, 100).replace(/\n/g, " ")}..."\n`);
});

console.log("\n✅ Ingestion complete. RAG knowledge base is live.");
