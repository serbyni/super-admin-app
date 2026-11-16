import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { BrandMark } from "@/components/ui/brand-mark";
import { Icon } from "@/components/ui/icon";
import { serverApi } from "@/lib/data/server-api";

const NAV = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/users", icon: "group", label: "Users", badge: "pending" },
  { href: "/admin/notifications", icon: "notifications", label: "Notifications", badge: "unread" },
  { href: "/admin/business", icon: "category", label: "Business types" },
] as const;

/** Count bubble next to a menu item (streams in; hidden when zero or on error). */
async function NavBadge({ kind }: { kind: "pending" | "unread" }) {
  const api = serverApi();
  const count = await (
    kind === "pending" ? api.users.stats().then((s) => s.pending) : api.notifications.unreadCount()
  ).catch(() => 0);
  if (!count) return null;
  return (
    <span
      aria-label={`${count} ${kind === "pending" ? "pending" : "unread"}`}
      className="ms-auto rounded-full bg-cta px-xs text-caption font-bold text-on-cta"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Desktop-first admin frame: fixed 240px sidebar + content (Stitch "Admin Dashboard"). */
export function AdminShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-surface-container-high bg-surface-container-lowest p-md md:flex">
        <Link href="/admin" className="mb-xl flex items-center gap-sm px-sm">
          <BrandMark className="h-9 w-9" priority />
          <span className="text-headline-md tracking-tight text-primary">Serbi</span>
          <span className="ms-auto rounded bg-tertiary-fixed px-xs font-label-sm text-caption text-on-tertiary-fixed uppercase">
            Admin
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-xs">
          {NAV.map((item) => {
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-sm rounded-lg px-sm py-sm text-body-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-primary-container text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                }`}
              >
                <Icon name={item.icon} className="text-icon-lg" />
                {item.label}
                {"badge" in item ? (
                  <Suspense fallback={null}>
                    <NavBadge kind={item.badge} />
                  </Suspense>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-sm rounded-lg px-sm py-sm text-body-sm font-semibold text-error transition-colors hover:bg-error-container"
          >
            <Icon name="logout" className="text-icon-lg" flipRtl />
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 px-gutter py-lg lg:px-container-margin-desktop">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-lg flex flex-col gap-sm sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-display-lg text-primary">{title}</h1>
        {description ? <p className="mt-xs text-on-surface-variant">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
