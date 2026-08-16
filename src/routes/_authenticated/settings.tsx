import { createFileRoute, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  SaveAll,
  Loader2,
  User,
  Settings as SettingsIcon,
  Shield,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatusBadge } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { safeDate } from "@/lib/utils";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";
import { ROLES, type AppRole } from "@/lib/roles";
import {
  notifyChangeRequest,
  notifyChangeRequestApproved,
  notifyChangeRequestRejected,
  notifyChangeRequestToRoot,
} from "@/lib/notifications";
import { applyApprovedProfileChange, profileFieldLabel } from "@/lib/profile-change";
import { usePreferences, type TimeFormat, type NotificationsPref } from "@/lib/preferences";
import { AvatarUpload } from "@/components/avatar-upload";

const settingsSearch = z.object({ tab: z.string().optional() });

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (s) => settingsSearch.parse(s),
  head: () => ({
    meta: [
      { title: "Profile — FactoryOS AI" },
      { name: "description", content: "Profile, preferences and change requests." },
    ],
  }),
  component: SettingsPage,
});

// ────────────────────────────────────────────────────────────────────────────
// Field model. `key` is what gets stored in profile_change_requests.field_name
// (formatted "table.column"). `target`/`column` drive the apply-on-approve.
// ────────────────────────────────────────────────────────────────────────────
type FieldKind = "text" | "textarea" | "select";

interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  options?: { value: string; label: string }[];
  target: "profiles" | "customers" | "suppliers" | "companies" | "user_roles";
  column: string;
}

// Internal roles only — a user can never request a portal role for themselves.
const ROLE_OPTIONS: { value: string; label: string }[] = ROLES.filter(
  (r) =>
    r.id !== "root_super_admin" &&
    r.id !== "customer_portal" &&
    r.id !== "supplier_portal",
).map((r) => ({ value: r.id, label: r.label }));

// Sensitive fields are approval-gated and must NOT be directly writable by the
// row owner — enforced in the DB by the guard triggers + RLS (see migration
// 20260820000000_profile_portal_complete.sql).
const ROLE_FIELDS: Record<
  string,
  { self: FieldDef[]; gated: FieldDef[] }
> = {
  root_super_admin: {
    self: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.job_title", label: "Job Title", kind: "text", placeholder: "Platform Owner", target: "profiles", column: "job_title" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    // Nothing above Root — all fields self-editable. Every write is still audited.
    gated: [],
  },
  company_admin: {
    self: [
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
      { key: "companies.name", label: "Company Name", kind: "text", target: "companies", column: "name" },
      { key: "companies.legal_name", label: "Legal / Registered Name", kind: "text", target: "companies", column: "legal_name" },
      { key: "companies.gst_number", label: "GST Number", kind: "text", target: "companies", column: "gst_number" },
    ],
  },
  plant_admin: {
    self: [
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
      { key: "user_roles.role", label: "Role / Designation", kind: "select", options: ROLE_OPTIONS, target: "user_roles", column: "role" },
    ],
  },
  plant_manager: {
    self: [
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
      { key: "user_roles.role", label: "Role / Designation", kind: "select", options: ROLE_OPTIONS, target: "user_roles", column: "role" },
    ],
  },
  production_manager: {
    self: [
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
      { key: "user_roles.role", label: "Role / Designation", kind: "select", options: ROLE_OPTIONS, target: "user_roles", column: "role" },
      { key: "profiles.department", label: "Department Assignment", kind: "text", placeholder: "e.g. Furniture Assembly", target: "profiles", column: "department" },
    ],
  },
  warehouse_manager: {
    self: [
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
      { key: "user_roles.role", label: "Role / Designation", kind: "select", options: ROLE_OPTIONS, target: "user_roles", column: "role" },
    ],
  },
  procurement_manager: {
    self: [
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
      { key: "user_roles.role", label: "Role / Designation", kind: "select", options: ROLE_OPTIONS, target: "user_roles", column: "role" },
    ],
  },
  quality_inspector: {
    self: [
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
      { key: "user_roles.role", label: "Role / Designation", kind: "select", options: ROLE_OPTIONS, target: "user_roles", column: "role" },
      { key: "profiles.certifications", label: "Certification Details", kind: "text", placeholder: "e.g. ISO 9001 Lead Auditor", target: "profiles", column: "certifications" },
    ],
  },
  maintenance_engineer: {
    self: [
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
      { key: "user_roles.role", label: "Role / Designation", kind: "select", options: ROLE_OPTIONS, target: "user_roles", column: "role" },
    ],
  },
  finance_manager: {
    self: [
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
      { key: "user_roles.role", label: "Role / Designation", kind: "select", options: ROLE_OPTIONS, target: "user_roles", column: "role" },
    ],
  },
  hr_manager: {
    self: [
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
      { key: "user_roles.role", label: "Role / Designation", kind: "select", options: ROLE_OPTIONS, target: "user_roles", column: "role" },
    ],
  },
  production_operator: {
    self: [
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
      { key: "profiles.department", label: "Department Assignment", kind: "text", placeholder: "e.g. CNC Machining", target: "profiles", column: "department" },
    ],
  },
  auditor: {
    self: [
      { key: "profiles.phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "profiles", column: "phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "profiles.full_name", label: "Full Name", kind: "text", target: "profiles", column: "full_name" },
      { key: "profiles.email", label: "Email", kind: "text", target: "profiles", column: "email" },
    ],
  },
  customer_portal: {
    self: [
      { key: "customers.contact_person", label: "Contact Person", kind: "text", target: "customers", column: "contact_person" },
      { key: "customers.contact_phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "customers", column: "contact_phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "customers.business_name", label: "Company Name", kind: "text", target: "customers", column: "business_name" },
      { key: "customers.email", label: "Email", kind: "text", target: "customers", column: "email" },
      { key: "customers.gst_number", label: "GST Number", kind: "text", target: "customers", column: "gst_number" },
      { key: "customers.billing_address", label: "Billing Address", kind: "textarea", target: "customers", column: "billing_address" },
      { key: "customers.shipping_address", label: "Shipping Address", kind: "textarea", target: "customers", column: "shipping_address" },
    ],
  },
  supplier_portal: {
    self: [
      { key: "suppliers.contact_person", label: "Contact Person", kind: "text", target: "suppliers", column: "contact_person" },
      { key: "suppliers.contact_phone", label: "Phone", kind: "text", placeholder: "+1 555-0123", target: "suppliers", column: "contact_phone" },
      { key: "profiles.avatar_url", label: "Profile Photo URL", kind: "text", placeholder: "https://example.com/avatar.jpg", target: "profiles", column: "avatar_url" },
    ],
    gated: [
      { key: "suppliers.name", label: "Company Name", kind: "text", target: "suppliers", column: "name" },
      { key: "suppliers.contact_email", label: "Email", kind: "text", target: "suppliers", column: "contact_email" },
      { key: "suppliers.gst_number", label: "GST Number", kind: "text", target: "suppliers", column: "gst_number" },
      { key: "suppliers.address", label: "Address", kind: "textarea", target: "suppliers", column: "address" },
      { key: "suppliers.materials_supplied", label: "Materials Supplied", kind: "textarea", placeholder: "e.g. Teak lumber, upholstery foam, brass fittings", target: "suppliers", column: "materials_supplied" },
      { key: "suppliers.bank_details", label: "Bank / Payment Details", kind: "textarea", placeholder: "Account name, bank, account no., IFSC", target: "suppliers", column: "bank_details" },
    ],
  },
};


function SettingsPage() {
  const queryClient = useQueryClient();
  const { profile, user, roles, companyId } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const { prefs, update: updatePrefs } = usePreferences();
  // Allow deep-linking to a tab (e.g. /settings?tab=change-requests from nav)
  const search = useSearch({ from: "/_authenticated/settings" });
  const [tab, setTab] = useState<string>(
    search.tab === "change-requests" ? "change-requests" : "profile",
  );

  const role = (roles[0] ?? "production_operator") as AppRole;
  const isRoot = roles.includes("root_super_admin");
  const isCompanyAdmin = roles.includes("company_admin");
  const isApprover = isRoot || isCompanyAdmin;
  const fields = ROLE_FIELDS[role] ?? ROLE_FIELDS.production_operator;

  const [values, setValues] = useState<Record<string, string>>({});
  // Original DB snapshot — used as the request's old_value, never overwritten
  // by typing (the editable `values` state holds the prospective new value).
  const [baseValues, setBaseValues] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [savingSelf, setSavingSelf] = useState(false);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [rejectionInput, setRejectionInput] = useState<Record<string, string>>({});

  // Load the customer / supplier / company context rows when applicable
  const { data: customerRow } = useQuery({
    queryKey: ["profile-customer", user?.id],
    queryFn: async () => {
      if (!user || role !== "customer_portal") return null;
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user && role === "customer_portal",
  });

  const { data: supplierRow } = useQuery({
    queryKey: ["profile-supplier", user?.id],
    queryFn: async () => {
      if (!user || role !== "supplier_portal") return null;
      const { data } = await supabase
        .from("suppliers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user && role === "supplier_portal",
  });

  const { data: companyRow } = useQuery({
    queryKey: ["profile-company", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
      return data ?? null;
    },
    enabled: !!companyId && isCompanyAdmin,
  });

  // Seed form values whenever the context loads
  useEffect(() => {
    if (!user || !profile) return;
    const next: Record<string, string> = {};
    const set = (key: string, v: unknown) => {
      next[key] = (v as string) ?? "";
    };
    for (const f of [...fields.self, ...fields.gated]) {
      if (f.key.startsWith("profiles.")) {
        const col = f.key.split(".")[1];
        if (col === "phone") set(f.key, profile.phone);
        else if (col === "avatar_url") set(f.key, profile.avatar_url);
        else if (col === "full_name") set(f.key, profile.full_name);
        else if (col === "email") set(f.key, profile.email);
        else if (col === "job_title") set(f.key, profile.job_title);
        else set(f.key, (profile as Record<string, unknown>)[col] ?? "");
      } else if (f.key.startsWith("customers.") && customerRow) {
        set(f.key, (customerRow as Record<string, unknown>)[f.key.split(".")[1]] ?? "");
      } else if (f.key.startsWith("suppliers.") && supplierRow) {
        set(f.key, (supplierRow as Record<string, unknown>)[f.key.split(".")[1]] ?? "");
      } else if (f.key.startsWith("companies.") && companyRow) {
        set(f.key, (companyRow as Record<string, unknown>)[f.key.split(".")[1]] ?? "");
      } else if (f.key === "user_roles.role") {
        set(f.key, role);
      }
    }
    setValues((prev) => ({ ...prev, ...next }));
    setBaseValues((prev) => ({ ...prev, ...next }));
  }, [profile, user, customerRow, supplierRow, companyRow, role, fields]);

  // All change requests visible to this user (own requests, or all approvable ones)
  const { data: changeRequests } = useQuery({
    queryKey: ["change-requests", companyId, user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      // profile_change_requests has no FK to profiles, so we can't embed the
      // requester via a join — fetch request rows, then resolve names separately.
      let q = supabase
        .from("profile_change_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (isRoot) {
        // Root sees every request (approves Company Admin requests).
        q = q.not("requested_by", "is", null);
      } else if (isCompanyAdmin && companyId) {
        q = q.eq("company_id", companyId);
      } else {
        q = q.eq("user_id", user.id);
      }
      const { data } = await q;
      const rows = data ?? [];
      // Resolve requester display names (same-company profiles are readable).
      const ids = [...new Set(rows.map((r: any) => r.user_id))];
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        for (const p of profs ?? []) {
          names[p.id] = p.full_name ?? p.email ?? p.id?.slice(0, 8);
        }
      }
      return rows.map((r: any) => ({ ...r, requester_name: names[r.user_id] }));
    },
    enabled: !!user,
  });

  const pendingByField = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of changeRequests ?? []) {
      if (r.status === "pending" && r.user_id === user?.id && !map[r.field_name]) {
        map[r.field_name] = r;
      }
    }
    return map;
  }, [changeRequests, user?.id]);

  const myRequests = useMemo(
    () => (changeRequests ?? []).filter((r: any) => r.user_id === user?.id),
    [changeRequests, user?.id],
  );

  // Resolve the single Company Admin approver (prefer the main admin).
  async function findCompanyAdmin(): Promise<string | null> {
    if (!companyId) return null;
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "company_admin")
      .eq("company_id", companyId);
    const ids = (admins ?? []).map((a) => a.user_id);
    if (!ids.length) return null;
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, is_main_admin")
      .in("id", ids);
    const ordered = [...(profs ?? [])].sort(
      (a, b) => Number(b.is_main_admin ?? false) - Number(a.is_main_admin ?? false),
    );
    return ordered[0]?.id ?? ids[0];
  }

  // ── Direct save of SELF-EDITABLE fields (instant, no request) ──
  async function saveSelfEditable() {
    if (!user) return;
    setSavingSelf(true);
    try {
      const errors: string[] = [];
      for (const f of fields.self) {
        const val = (values[f.key] ?? "").trim();
        const [table, column] = f.key.split(".");
        if (table === "profiles") {
          const { error } = await supabase
            .from("profiles")
            .update({ [column]: val || null } as never)
            .eq("id", user.id);
          if (error) errors.push(`${f.label}: ${error.message}`);
        } else if (table === "customers" && customerRow) {
          const { error } = await supabase
            .from("customers")
            .update({ [column]: val || null } as never)
            .eq("user_id", user.id);
          if (error) errors.push(`${f.label}: ${error.message}`);
        } else if (table === "suppliers" && supplierRow) {
          const { error } = await supabase
            .from("suppliers")
            .update({ [column]: val || null } as never)
            .eq("user_id", user.id);
          if (error) errors.push(`${f.label}: ${error.message}`);
        }
      }
      if (errors.length) {
        toast.error(errors[0]);
      } else {
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["auth-state"] });
        toast.success("Profile updated — saved instantly, no approval needed");
      }
    } finally {
      setSavingSelf(false);
    }
  }

  // ── Submit a request for an APPROVAL-GATED field ──
  const submitRequest = useMutation({
    mutationFn: async ({ field, value }: { field: FieldDef; value: string }) => {
      if (!user || !companyId) throw new Error("Not authenticated");
      const oldValue = baseValues[field.key] ?? "";
      const { data: inserted, error } = await supabase
        .from("profile_change_requests")
        .insert({
          company_id: companyId,
          user_id: user.id,
          requested_by: user.id,
          field_name: field.key,
          old_value: oldValue,
          new_value: value,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      if (isCompanyAdmin) {
        // Company Admin's own request escalates to Root Super Admin.
        await notifyChangeRequestToRoot(companyId, profile?.full_name ?? user.email ?? "A Company Admin", inserted?.id ?? "");
      } else {
        const approverId = await findCompanyAdmin();
        await notifyChangeRequest(
          companyId,
          profile?.full_name ?? user.email ?? "A user",
          inserted?.id ?? "",
          approverId,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-requests"] });
      toast.success(
        isCompanyAdmin
          ? "Change request submitted — Root Super Admin has been notified"
          : "Change request submitted — your Company Admin has been notified",
      );
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── Approve / Reject (Company Admin or Root) ──
  async function handleChangeRequest(requestId: string, action: "approved" | "rejected") {
    try {
      const req = changeRequests?.find((r: any) => r.id === requestId);
      if (!req) return;

      // Self-approval is blocked at the DB level (pcr_update_approver requires
      // requested_by <> auth.uid()) — reject it explicitly in the UI too, so the
      // user never sees a silent no-op. Their own request already escalated to
      // Root Super Admin at submit time.
      if (req.requested_by === user?.id) {
        toast.error(
          "You cannot approve your own change request — it was escalated to " +
            (isRoot ? "the platform level" : "Root Super Admin"),
        );
        return;
      }

      if (action === "approved") {
        const applyError = await applyApprovedProfileChange(req);
        if (applyError) {
          toast.error(`Could not apply change: ${applyError}`);
          return;
        }
      }

      const { data: updatedRows, error } = await supabase
        .from("profile_change_requests")
        .update({
          status: action,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: action === "rejected" ? (rejectionInput[requestId] ?? "Not approved by Company Admin") : null,
        })
        .eq("id", requestId)
        .select("id");
      if (error) throw error;
      // Row-count check: if the RLS/guard filtered the update to 0 rows the
      // request did NOT change — surface it instead of faking success.
      if (!updatedRows || updatedRows.length === 0) {
        toast.error("This request could not be updated — you may not have permission to review it.");
        return;
      }

      const label = profileFieldLabel(req.field_name);
      if (action === "approved") {
        await notifyChangeRequestApproved(companyId ?? "", req.user_id, label);
      } else {
        await notifyChangeRequestRejected(
          companyId ?? "",
          req.user_id,
          label,
          rejectionInput[requestId] ?? "Not approved by Company Admin",
        );
      }

      queryClient.invalidateQueries({ queryKey: ["change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-customer"] });
      queryClient.invalidateQueries({ queryKey: ["profile-supplier"] });
      queryClient.invalidateQueries({ queryKey: ["profile-company"] });
      queryClient.invalidateQueries({ queryKey: ["auth-state"] });
      toast.success(action === "approved" ? "Change approved and applied" : "Change rejected");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // Header reflects the CURRENT committed values, never the typed draft — a
  // pending request must not look like it is already live.
  const currentName =
    baseValues["profiles.full_name"] ||
    customerRow?.business_name ||
    supplierRow?.name ||
    profile?.full_name ||
    "Your Name";
  const currentEmail =
    baseValues["profiles.email"] ||
    customerRow?.email ||
    supplierRow?.contact_email ||
    profile?.email ||
    "";
  // Own requests are never approvable by their requester — they escalated to
  // the approver above (Root for Company Admin, Company Admin otherwise).
  const approvableRequests = (changeRequests ?? []).filter(
    (r: any) => r.requested_by !== user?.id,
  );
  const pendingApprovals = approvableRequests.filter((r: any) => r.status === "pending");

  const renderField = (f: FieldDef, mode: "self" | "gated") => {
    const pending = pendingByField[f.key];
    const val = values[f.key] ?? "";
    const isPending = !!pending;

    const input = (() => {
      // Profile photo is self-editable and uploaded (drag-drop + click) rather
      // than typed as a URL — Bug 3 fix, works for every role.
      if (f.key === "profiles.avatar_url" && mode === "self" && user) {
        return (
          <AvatarUpload
            userId={user.id}
            currentUrl={profile?.avatar_url ?? null}
            onSaved={(url) => {
              setValues((s) => ({ ...s, [f.key]: url ?? "" }));
              setBaseValues((s) => ({ ...s, [f.key]: url ?? "" }));
              queryClient.invalidateQueries({ queryKey: ["profile"] });
              queryClient.invalidateQueries({ queryKey: ["auth-state"] });
              queryClient.invalidateQueries({ queryKey: ["change-requests"] });
            }}
          />
        );
      }
      if (isPending) {
        return (
          <Input value={pending.new_value ?? val} disabled className="h-10 opacity-60" />
        );
      }
      if (f.kind === "select" && f.options?.length) {
        return (
          <Select value={val} onValueChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      if (f.kind === "textarea") {
        return (
          <textarea
            value={val}
            onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
        );
      }
      return (
        <Input
          value={val}
          onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
          placeholder={f.placeholder}
          className="h-10"
        />
      );
    })();

    return (
      <div key={f.key} className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">{f.label}</Label>
          {isPending && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-500 px-2 py-0.5 text-[10px] font-medium">
              <Clock className="h-3 w-3" />
              Pending approval
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex-1">{input}</div>
          {mode === "gated" && !isPending && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 shrink-0"
              disabled={submittingKey === f.key || !(values[f.key] ?? "").trim()}
              onClick={() => {
                setSubmittingKey(f.key);
                submitRequest.mutate(
                  { field: f, value: (values[f.key] ?? "").trim() },
                  { onSettled: () => setSubmittingKey(null) },
                );
              }}
            >
              {submittingKey === f.key ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              Request
            </Button>
          )}
        </div>
        {mode === "gated" && !isPending && (
          <div className="text-[10px] text-muted-foreground">
            {isCompanyAdmin
              ? "Requires Root Super Admin approval"
              : "Requires Company Admin approval"}
          </div>
        )}
        {isPending && (
          <div className="text-[10px] text-muted-foreground">
            Old: <span className="line-through">{pending.old_value || "—"}</span> → New:{" "}
            <span className="text-amber-500 font-medium">{pending.new_value}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      <ModuleStatusBar moduleName="settings" />
      <PageHeader
        eyebrow="Account"
        title="Profile"
        sub={
          isRoot
            ? "Root Super Admin — everything is self-editable. Every change is written to the audit log."
            : "Edit your profile. Sensitive fields (name, email, role, company details) require approval before they change."
        }
        actions={<ModuleCopilot moduleName="settings" />}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-1.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <SettingsIcon className="h-4 w-4 mr-1.5" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="security">
            <KeyRound className="h-4 w-4 mr-1.5" />
            Password
          </TabsTrigger>
          {isApprover && (
            <TabsTrigger value="change-requests">
              <Shield className="h-4 w-4 mr-1.5" />
              {isRoot ? "Pending Requests (Root)" : "Change Requests"}
              {pendingApprovals.length > 0 && (
                <span className="ml-1.5 h-4 w-4 rounded-full bg-amber-500 text-[10px] font-medium text-white flex items-center justify-center">
                  {pendingApprovals.length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Profile Tab ── */}
        <TabsContent value="profile">
          <Panel title="Personal Information">
            <div className="flex items-center gap-4 mb-6">
              <UserAvatar
                name={currentName}
                email={currentEmail}
                url={profile?.avatar_url ?? null}
                className="h-16 w-16"
                fallbackClassName="bg-primary/15 text-primary text-lg"
              />
              <div className="min-w-0">
                <div className="font-medium truncate">{currentName}</div>
                <div className="text-xs text-muted-foreground truncate">{currentEmail}</div>
                <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                  {role.replace(/_/g, " ")}
                </div>
              </div>
            </div>

            {/* Self-editable fields — save instantly */}
            {fields.self.length > 0 && (
              <div className="mb-6">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  Self-editable — saves instantly
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {fields.self.map((f) => renderField(f, "self"))}
                </div>
                <div className="flex justify-end mt-4">
                  <Button
                    className="bg-[image:var(--gradient-primary)] shadow-glow"
                    onClick={saveSelfEditable}
                    disabled={savingSelf}
                  >
                    {savingSelf ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <SaveAll className="h-4 w-4 mr-1.5" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            )}

            {/* Approval-gated fields — become requests */}
            {fields.gated.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-amber-500" />
                  Requires {isCompanyAdmin ? "Root Super Admin" : "Company Admin"} approval
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {fields.gated.map((f) => renderField(f, "gated"))}
                </div>
                <div className="text-[11px] text-muted-foreground mt-3 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Identity and financial fields are audit-sensitive. Clicking Request
                  submits a change request — your value stays unchanged until an
                  approver reviews it.
                </div>
              </div>
            )}
          </Panel>

          {/* My Requests — requester visibility */}
          {myRequests.length > 0 && (
            <div className="mt-4">
              <Panel title="My Requests">
                <div className="space-y-2">
                  {myRequests.map((req: any) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-card/60 border border-white/5 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-sm">
                          <span className="capitalize">{profileFieldLabel(req.field_name)}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="font-medium">{req.new_value}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {safeDate(req.created_at, true)} ·{" "}
                          {req.status === "pending"
                            ? "Awaiting approval"
                            : req.status === "approved"
                              ? "Approved"
                              : `Rejected${req.rejection_reason ? ` — ${req.rejection_reason}` : ""}`}
                        </div>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </TabsContent>

        {/* ── Preferences Tab ──
             Bug 2 fix: these selects are bound to the persisted per-user
             preferences (profiles.preferences jsonb + localStorage) and applied
             app-wide on change — language re-renders shared UI labels via the
             i18n provider, theme restyles the whole app via the theme provider,
             and the time format flows into every safeDate() timestamp. */}
        <TabsContent value="preferences">
          <Panel title="Preferences">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notifications</Label>
                <Select
                  value={prefs.notifications}
                  onValueChange={(v) => {
                    void updatePrefs({ notifications: v as NotificationsPref });
                    toast.success("Notification preference saved");
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All notifications</SelectItem>
                    <SelectItem value="important">Important only</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Theme</Label>
                <Select
                  value={prefs.theme}
                  onValueChange={(v) => {
                    void updatePrefs({ theme: v as "dark" | "light" | "aesthetic" });
                    toast.success("Theme updated app-wide");
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="aesthetic">Aesthetic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Time Format</Label>
                <Select
                  value={prefs.timeFormat}
                  onValueChange={(v) => {
                    void updatePrefs({ timeFormat: v as TimeFormat });
                    toast.success("Time format applied to all timestamps");
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-hour</SelectItem>
                    <SelectItem value="24h">24-hour</SelectItem>
                    <SelectItem value="auto">Browser default</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("Language")}</Label>
                <Select
                  value={prefs.locale}
                  onValueChange={(v) => {
                    void updatePrefs({ locale: v as Locale });
                    toast.success("Language updated — shared labels re-render app-wide");
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        <span className="mr-2">{l.flag}</span>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-[10px] text-muted-foreground">
                  Affects navigation, menus and shared UI labels for your account.
                </div>
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* ── Security / Password Tab ── */}
        <TabsContent value="security">
          <Panel title="Password & Security">
            <div className="text-sm text-muted-foreground mb-4">
              Change your password yourself — no approval needed.
            </div>
            <div className="flex gap-2 max-w-md">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                className="h-10"
              />
              <Button
                variant="outline"
                className="h-10 shrink-0"
                disabled={password.length < 8}
                onClick={async () => {
                  const { error } = await supabase.auth.updateUser({ password });
                  if (error) {
                    toast.error(error.message);
                  } else {
                    setPassword("");
                    toast.success("Password updated");
                  }
                }}
              >
                Update
              </Button>
            </div>
          </Panel>
        </TabsContent>

        {/* ── Change Requests Tab (Company Admin / Root) ── */}
        <TabsContent value="change-requests">
          <Panel title={isRoot ? "Pending Profile Requests — Root Review" : "Pending Profile Requests"}>
            {approvableRequests.length === 0 && (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {isRoot
                  ? "No pending requests. When a Company Admin requests a profile change, it appears here."
                  : "No pending change requests. When employees request profile changes, they'll appear here."}
              </div>
            )}
            <div className="divide-y divide-white/5">
              {approvableRequests.map((req: any) => (
                <div key={req.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="font-medium">
                        {req.requester_name ?? req.user_id?.slice(0, 8)}
                      </span>
                      <span className="text-xs text-muted-foreground">wants to change</span>
                      <span className="font-medium capitalize">{profileFieldLabel(req.field_name)}</span>
                      {isRoot && (
                        <span className="text-[10px] rounded-full bg-blue-500/15 text-blue-400 px-2 py-0.5">
                          Company Admin request
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Old: <span className="line-through">{req.old_value || "—"}</span>
                      <span className="mx-1">→</span>
                      New: <span className="text-primary font-medium">{req.new_value}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {safeDate(req.created_at, true)}
                      {req.status === "rejected" && req.rejection_reason
                        ? ` · Reason: ${req.rejection_reason}`
                        : ""}
                    </div>
                    {req.status === "pending" && (
                      <div className="mt-2 flex items-center gap-1.5 max-w-md">
                        <Input
                          placeholder="Rejection reason (for Reject)"
                          value={rejectionInput[req.id] ?? ""}
                          onChange={(e) =>
                            setRejectionInput((s) => ({ ...s, [req.id]: e.target.value }))
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {req.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-success"
                          onClick={() => handleChangeRequest(req.id, "approved")}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive"
                          onClick={() => handleChangeRequest(req.id, "rejected")}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    {req.status !== "pending" && <StatusBadge status={req.status} />}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
