"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "./icon";

/*
 * App-wide toasts: <ToastProvider> (root layout) + useToast().
 *   const toast = useToast();
 *   toast.show({ variant: "error", title: "…", actions: [{ label: "Register", href: "/register" }] });
 * Auto-dismiss after `duration` ms (paused while hovered/focused; null = stays), close button,
 * optional action buttons (link or callback). Errors are announced assertively.
 */

export type ToastVariant = "info" | "success" | "warning" | "error";

export type ToastAction = { label: string; href?: string; onClick?: () => void };

export type ToastOptions = {
  variant?: ToastVariant;
  title: string;
  description?: ReactNode;
  icon?: string;
  actions?: ToastAction[];
  /** Milliseconds before auto-dismiss; null keeps it until closed. Default 6000 (errors 9000). */
  duration?: number | null;
  /** Same id replaces an existing toast (e.g. avoid duplicates). */
  id?: string;
};

type Toast = Required<Pick<ToastOptions, "variant" | "title">> &
  Omit<ToastOptions, "variant" | "title"> & { id: string };

type ToastApi = { show: (t: ToastOptions) => string; dismiss: (id: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 3;

const STYLE: Record<ToastVariant, { icon: string; badge: string; bar: string }> = {
  info: { icon: "info", badge: "bg-secondary-container text-primary", bar: "bg-primary" },
  success: { icon: "check_circle", badge: "bg-success-container text-success", bar: "bg-success" },
  warning: { icon: "warning", badge: "bg-secondary-container text-cta", bar: "bg-cta" },
  error: { icon: "error", badge: "bg-error-container text-error", bar: "bg-error" },
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((o: ToastOptions) => {
    const id = o.id ?? `t${++seq.current}`;
    const toast: Toast = { ...o, id, variant: o.variant ?? "info", title: o.title };
    setToasts((all) => [toast, ...all.filter((t) => t.id !== id)].slice(0, MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-sm p-md sm:items-end">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const s = STYLE[toast.variant];
  const duration =
    toast.duration === undefined ? (toast.variant === "error" ? 9000 : 6000) : toast.duration;
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration ?? 0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (duration === null || paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [duration, paused, onDismiss]);

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto relative flex w-full max-w-card-sm items-start gap-sm overflow-hidden rounded-xl bg-surface-container-lowest p-md shadow-card-warm"
    >
      <span className={`absolute inset-y-0 start-0 w-1 ${s.bar}`} aria-hidden="true" />
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s.badge}`}
      >
        <Icon name={toast.icon ?? s.icon} className="text-icon-lg" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-on-surface">{toast.title}</p>
        {toast.description ? (
          <div className="text-body-sm text-on-surface-variant">{toast.description}</div>
        ) : null}
        {toast.actions?.length ? (
          <div className="mt-sm flex flex-wrap gap-xs">
            {toast.actions.map((a, i) => {
              const cls = `inline-flex items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold transition-colors ${
                i === 0
                  ? "bg-primary text-on-primary hover:bg-primary-container"
                  : "text-primary hover:bg-secondary-container"
              }`;
              return a.href ? (
                <Link key={a.label} href={a.href} onClick={onDismiss} className={cls}>
                  {a.label}
                </Link>
              ) : (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => {
                    a.onClick?.();
                    onDismiss();
                  }}
                  className={cls}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
      >
        <Icon name="close" className="text-icon-md" />
      </button>
    </div>
  );
}
