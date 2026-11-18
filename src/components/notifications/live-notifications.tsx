"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { browserApi } from "@/lib/data/browser-api";
import type { AppNotification } from "@/lib/data/services/notification-types";
import { describeNotification } from "./describe";

const TOAST_MS = 8000;

/**
 * Subscribes to the signed-in user's live notifications. On each new one: refreshes the current
 * page (badges, lists, status) and shows a toast linking to its target.
 */
export function LiveNotifications({ userId }: { userId: string }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<AppNotification[]>([]);

  useEffect(() => {
    return browserApi().subscribeToNotifications(userId, (n) => {
      setToasts((t) => [n, ...t].slice(0, 3));
      router.refresh();
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), TOAST_MS);
    });
  }, [userId, router]);

  if (toasts.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed end-md bottom-md z-50 flex w-11/12 max-w-card-sm flex-col gap-sm"
    >
      {toasts.map((n) => {
        const d = describeNotification(n);
        return (
          <div
            key={n.id}
            className="flex items-start gap-sm rounded-xl bg-surface-container-lowest p-md shadow-card-warm"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-primary">
              <Icon name={d.icon} className="text-icon-lg" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-on-surface">{d.title}</p>
              <p className="text-body-sm text-on-surface-variant">{d.body}</p>
              <Link
                href={d.href}
                onClick={() => setToasts((t) => t.filter((x) => x.id !== n.id))}
                className="mt-xs inline-flex items-center gap-xs text-body-sm font-semibold text-primary hover:underline"
              >
                Open
                <Icon name="chevron_right" className="text-icon-md" flipRtl />
              </Link>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToasts((t) => t.filter((x) => x.id !== n.id))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
            >
              <Icon name="close" className="text-icon-md" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
