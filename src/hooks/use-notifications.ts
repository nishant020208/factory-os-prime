/**
 * use-notifications.ts — Real-time notification hook.
 *
 * Subscribes to Supabase real-time for the current role's notifications.
 * Returns: unreadCount, notifications[], markAsRead, markAllAsRead, loading
 *
 * ⚠️ COMPLETELY CRASH-PROOF: Every error is caught. Even if the notifications
 *    table doesn't exist (migration not applied), the hook gracefully degrades
 *    to empty state without breaking the app shell.
 *
 * The toast "View" button uses a global navigate handler set by the AppShell
 * component via setNavigateHandler(), which uses TanStack Router's imperative
 * navigate API — avoiding full page reloads from window.location.href.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { primaryRole } from "@/lib/route-access";
import { toast } from "sonner";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  type AppNotification,
} from "@/lib/notifications";

/**
 * Global navigate handler for the toast "View" button.
 * Set by AppShell (which has access to useRouter()) via setNavigateHandler().
 * This avoids window.location.href full-page-reloads.
 */
let _navigateHandler: ((to: string) => void) | null = null;

export function setNavigateHandler(handler: (to: string) => void) {
  _navigateHandler = handler;
}

export function navigateTo(to: string) {
  if (_navigateHandler) {
    _navigateHandler(to);
  } else {
    window.location.href = to;
  }
}

const EMPTY: AppNotification[] = [];

export function useNotifications() {
  const { companyId, user, roles } = useAuth();
  const role = primaryRole(roles);
  const [notifications, setNotifications] = useState<AppNotification[]>(EMPTY);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      // Root Super Admin has no company_id (root-targeted notifications are
      // company-agnostic, to_role = 'root_super_admin'). Everyone else needs
      // a company to exist before we can scope the query.
      if (!companyId && role !== "root_super_admin") {
        if (mountedRef.current) setLoading(false);
        return;
      }
      const [data, count] = await Promise.all([
        fetchNotifications(companyId, role, user?.id ?? null),
        getUnreadNotificationCount(companyId, role, user?.id ?? null),
      ]);
      if (mountedRef.current) {
        setNotifications(data);
        setUnreadCount(count);
        setLoading(false);
      }
    } catch {
      // Graceful degradation — if the table doesn't exist or queries fail,
      // silently return empty state rather than crashing the app shell
      if (mountedRef.current) {
        setNotifications(EMPTY);
        setUnreadCount(0);
        setLoading(false);
      }
    }
  }, [companyId, role, user?.id]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Real-time subscription (wrapped in try-catch to survive missing tables)
  useEffect(() => {
    if (!companyId && role !== "root_super_admin") return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      // Root subscribes to root-targeted rows (company_id = null); company
      // roles subscribe to their own company's rows.
      const isRoot = role === "root_super_admin";
      const filter = isRoot
        ? "to_role=eq.root_super_admin"
        : `company_id=eq.${companyId}`;
      channel = supabase
        .channel("notifications-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter,
          },
          (payload: any) => {
            try {
              const notif = payload.new as AppNotification;
              if (!notif) return;
              const matchesRole = notif.to_role === role;
              const matchesUser = notif.to_user === user?.id;
              if (matchesRole || matchesUser) {
                setNotifications((prev) => [notif, ...prev]);
                if (!notif.is_read) {
                  setUnreadCount((c) => c + 1);
                }
                // Fire real-time toast for high-severity notifications
                if (!notif.is_read && (notif.severity === "error" || notif.severity === "warning")) {
                  const toastFn = notif.severity === "error" ? toast.error : toast.warning;
                  toastFn(notif.title, {
                    description: notif.body,
                    duration: 8000,
                    action: {
                      label: "View",
                      onClick: () => {
                        // Navigate using global handler (set by AppShell via TanStack Router)
                        navigateTo('/notifications');
                      },
                    },
                  });
                }
              }
            } catch {
              // Silently ignore real-time callback errors
            }
          },
        )
        .subscribe();
    } catch {
      // Real-time subscription failed (e.g., table doesn't exist)
      // No need to log — the data load will work once the table exists
    }

    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [companyId, role, user?.id]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Silently fail — the UI will still show the notification
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!companyId && role !== "root_super_admin") return;
    try {
      await markAllNotificationsRead(companyId, role, user?.id ?? null);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, [companyId, role, user?.id]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: load,
  };
}
