"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationResponse {
  data: Notification[];
  pagination?: { total: number };
}

// #NIGHT-042: Multiple bells / sidebars / module navs that all
// previously fired their own /api/v1/notifications fetch now share
// the same react-query cache (60s staleTime from the provider). The
// queryKey is what enables dedup — same key, same cache entry.
const NOTIFICATIONS_QUERY_KEY = ["notifications", "unread"] as const;

export function NotificationBell() {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery<NotificationResponse>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/v1/notifications?unread=true&limit=10");
      if (!r.ok) return { data: [], pagination: { total: 0 } };
      return r.json();
    },
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.pagination?.total ?? 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/v1/notifications/${id}/read`, { method: "PUT" });
    // Optimistically update the shared cache so every bell instance
    // re-renders with the new state.
    queryClient.setQueryData<NotificationResponse>(
      NOTIFICATIONS_QUERY_KEY,
      (prev) =>
        prev
          ? {
              data: prev.data.filter((n) => n.id !== id),
              pagination: {
                total: Math.max(0, (prev.pagination?.total ?? 0) - 1),
              },
            }
          : prev,
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label={t("title")}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("title")}
            </h3>
            {unreadCount > 0 && (
              <span className="text-xs text-gray-500">
                {t("unread", { count: unreadCount })}
              </span>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">
                {t("empty")}
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  onClick={() => markRead(n.id)}
                >
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  {n.message && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
