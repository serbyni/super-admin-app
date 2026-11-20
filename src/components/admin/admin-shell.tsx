import { Suspense, type ReactNode } from "react";
import { AppShell, PageHeader, type ShellNavItem } from "@/components/shell/app-shell";
import { BrandMark } from "@/components/ui/brand-mark";
import { serverApi } from "@/lib/data/server-api";

export { PageHeader };

/** Count bubble next to a menu item (streams in; hidden when zero or on error). */
async function NavBadge({ kind }: { kind: "pending" | "unread" | "languages" }) {
  const api = serverApi();
  const count = await (
    kind === "pending"
      ? api.users.stats().then((s) => s.pending)
      : kind === "languages"
        ? api.languages.adminRequests("pending").then((r) => r.length)
        : api.notifications.unreadCount()
  ).catch(() => 0);
  if (!count) return null;
  return (
    <span
      aria-label={`${count} ${kind === "unread" ? "unread" : "pending"}`}
      className="ms-auto rounded-full bg-cta px-xs text-caption font-bold text-on-cta"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

const badge = (kind: "pending" | "unread" | "languages") => (
  <Suspense fallback={null}>
    <NavBadge kind={kind} />
  </Suspense>
);

const NAV: ShellNavItem[] = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/users", icon: "group", label: "Users", badge: badge("pending") },
  { href: "/admin/cafes", icon: "storefront", label: "Cafés" },
  { href: "/admin/languages", icon: "translate", label: "Languages", badge: badge("languages") },
  {
    href: "/admin/notifications",
    icon: "notifications",
    label: "Notifications",
    badge: badge("unread"),
  },
  { href: "/admin/business", icon: "category", label: "Business types" },
  { href: "/admin/settings", icon: "settings", label: "Settings" },
];

/** Super-admin frame (Stitch "Admin Dashboard"): Serbi brand + platform navigation. */
export function AdminShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <AppShell
      homeHref="/admin"
      nav={NAV}
      active={active}
      brand={
        <>
          <BrandMark className="h-9 w-9" priority />
          <span className="text-headline-md tracking-tight text-primary">Serbi</span>
          <span className="ms-auto rounded bg-tertiary-fixed px-xs font-label-sm text-caption text-on-tertiary-fixed uppercase">
            Admin
          </span>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
