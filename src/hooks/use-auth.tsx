import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roles: AppRole[];
  companyId: string | null;
  isMainAdmin: boolean;
  profile: { full_name: string | null; email: string; avatar_url: string | null } | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    roles: [],
    companyId: null,
    isMainAdmin: false,
    profile: null,
  });

  useEffect(() => {
    let mounted = true;
    async function hydrate(session: Session | null) {
      if (!session?.user) {
        if (mounted)
          setState({
            session: null,
            user: null,
            loading: false,
            roles: [],
            companyId: null,
            isMainAdmin: false,
            profile: null,
          });
        return;
      }
      try {
        const [rolesRes, profileRes] = await Promise.all([
          supabase.from("user_roles").select("role,company_id").eq("user_id", session.user.id),
          supabase
            .from("profiles")
            .select("full_name,email,avatar_url,company_id,is_main_admin")
            .eq("id", session.user.id)
            .maybeSingle(),
        ]);
        if (!mounted) return;
        const rolesData = rolesRes.data ?? [];
        const profile = profileRes.data;
        setState({
          session,
          user: session.user,
          loading: false,
          roles: rolesData.length
            ? (rolesData as Array<{ role: string }>).map((r) => r.role as AppRole)
            : [],
          companyId:
            profile?.company_id ??
            (rolesData as Array<{ company_id?: string }>)?.[0]?.company_id ??
            null,
          isMainAdmin: profile?.is_main_admin === true,
          profile: profile
            ? { full_name: profile.full_name, email: profile.email, avatar_url: profile.avatar_url }
            : { full_name: null, email: session.user.email ?? "", avatar_url: null },
        });
      } catch {
        // Graceful degradation — if queries fail (table missing, RLS issue),
        // still reflect the authenticated user without roles/company data
        if (!mounted) return;
        setState({
          session,
          user: session.user,
          loading: false,
          roles: [],
          companyId: null,
          isMainAdmin: false,
          profile: { full_name: null, email: session.user.email ?? "", avatar_url: null },
        });
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => hydrate(data.session))
      .catch(() => {
        if (mounted) setState((s) => ({ ...s, loading: false }));
      });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED" ||
        event === "INITIAL_SESSION"
      ) {
        hydrate(session);
      }
    });
    return () => {
      mounted = false;
      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, []);

  return state;
}
