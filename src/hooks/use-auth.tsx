import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  profile: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    phone: string | null;
    job_title: string | null;
  } | null;
}

const EMPTY_AUTH: AuthState = {
  session: null,
  user: null,
  loading: true,
  roles: [],
  companyId: null,
  isMainAdmin: false,
  profile: null,
};

async function fetchAuthState(): Promise<AuthState> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session ?? null;

  if (!session?.user) {
    return { ...EMPTY_AUTH, loading: false };
  }

  try {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role,company_id").eq("user_id", session.user.id),
      supabase
        .from("profiles")
        .select("full_name,email,avatar_url,company_id,is_main_admin,phone,job_title")
        .eq("id", session.user.id)
        .maybeSingle(),
    ]);

    const rolesData = rolesRes.data ?? [];
    const profile = profileRes.data;

    return {
      session,
      user: session.user,
      loading: false,
      roles: rolesData.map((r) => r.role as AppRole),
      companyId:
        profile?.company_id ??
        (rolesData as Array<{ company_id?: string }>)?.[0]?.company_id ??
        null,
      isMainAdmin: profile?.is_main_admin === true,
      profile: profile
        ? {
            full_name: profile.full_name,
            email: profile.email,
            avatar_url: profile.avatar_url,
            phone: profile.phone,
            job_title: profile.job_title,
          }
        : {
            full_name: null,
            email: session.user.email ?? "",
            avatar_url: null,
            phone: null,
            job_title: null,
          },
    };
  } catch {
    // Graceful degradation
    return {
      session,
      user: session.user,
      loading: false,
      roles: [],
      companyId: null,
      isMainAdmin: false,
      profile: {
        full_name: null,
        email: session.user.email ?? "",
        avatar_url: null,
        phone: null,
        job_title: null,
      },
    };
  }
}

export function useAuth(): AuthState {
  const queryClient = useQueryClient();
  const [sessionKey, setSessionKey] = useState(0);

  // Listen for auth state changes and invalidate the cache
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED" ||
        event === "INITIAL_SESSION"
      ) {
        // Invalidate to trigger a fresh fetch with the new session
        queryClient.invalidateQueries({ queryKey: ["auth-state"] });
        setSessionKey((k) => k + 1);
      }
    });
    return () => {
      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ["auth-state", sessionKey],
    queryFn: fetchAuthState,
    // Cache auth data for 10 minutes — no re-fetch on every tab switch
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    // Never retry auth failures in a loop
    retry: 0,
    // Start immediately, even on first render
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data) {
    return EMPTY_AUTH;
  }

  return data;
}
