import { supabase } from "@/integrations/supabase/client";

/**
 * Record an access event (login success/failure, signup, logout) into the
 * access_logs table via the SECURITY DEFINER RPC. The RPC resolves the
 * user's company + role from their email, so it works both when the user
 * is signed in (success) and when they are still anonymous (failure).
 *
 * Fire-and-forget: never throws, never blocks the auth flow.
 */
export async function recordAccessLog(
  email: string,
  action: "login" | "login_failed" | "logout" | "signup",
  status: "success" | "failed" = "success",
): Promise<void> {
  try {
    const { error } = await supabase.rpc("record_access_log", {
      p_email: email,
      p_action: action,
      p_status: status,
    });
    if (error) {
      // The RPC is best-effort — never fail the auth flow because of it.
      console.warn(`[access-log] ${action} recording failed:`, error.message);
    }
  } catch {
    /* never throws */
  }
}
