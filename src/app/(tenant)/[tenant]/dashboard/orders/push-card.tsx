"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useMsg } from "@/i18n/use-msg";
import { pushState, subscribePush, unsubscribePush, type PushState } from "@/lib/push/client";
import { deletePushAction, savePushAction } from "./actions";

/** "Notifications on this device": new orders as push notifications (with the device's sound). */
export function PushCard({ slug, vapidKey }: { slug: string; vapidKey: string }) {
  const t = useTranslations("orders.push");
  const m = useMsg();
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    let alive = true;
    void pushState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  if (state === null) return null;

  const enable = () =>
    start(async () => {
      try {
        const keys = await subscribePush(vapidKey);
        if (!keys) {
          setState(Notification.permission === "denied" ? "blocked" : "off");
          toast.show({ variant: "error", title: t("denied") });
          return;
        }
        const r = await savePushAction(slug, keys);
        toast.show({ variant: r.ok ? "success" : "error", title: m(r.message ?? "") });
        if (r.ok) setState("on");
      } catch {
        setState("unsupported");
      }
    });
  const disable = () =>
    start(async () => {
      const endpoint = await unsubscribePush();
      if (endpoint) await deletePushAction(slug, endpoint);
      setState("off");
      toast.show({ variant: "success", title: m("§pushOff") });
    });

  const info =
    state === "blocked"
      ? t("blocked")
      : state === "unsupported"
        ? t("unsupported")
        : state === "install"
          ? t("install")
          : t("body");
  return (
    <section className="flex flex-col gap-sm rounded-xl bg-surface-container-lowest p-md shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-sm">
        <Icon
          name={state === "on" ? "notifications_active" : "notifications"}
          className={`text-icon-xl ${state === "on" ? "text-primary" : "text-on-surface-variant"}`}
        />
        <div>
          <p className="font-semibold text-on-surface">
            {t("title")}
            {state === "on" ? (
              <span className="ms-xs rounded-full bg-success-container px-sm text-caption text-success">
                {t("on")}
              </span>
            ) : null}
          </p>
          <p className="text-caption text-on-surface-variant">{info}</p>
        </div>
      </div>
      {state === "off" || state === "on" ? (
        <button
          type="button"
          disabled={pending}
          onClick={state === "on" ? disable : enable}
          className={`inline-flex w-fit shrink-0 items-center gap-xs rounded-xl px-md py-sm text-body-sm font-semibold disabled:opacity-60 ${
            state === "on"
              ? "border border-outline-variant text-on-surface-variant"
              : "bg-primary text-on-primary"
          }`}
        >
          {pending ? <Icon name="progress_activity" className="animate-spin text-icon-md" /> : null}
          {state === "on" ? t("disable") : t("enable")}
        </button>
      ) : null}
    </section>
  );
}
