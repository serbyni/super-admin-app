import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { Icon } from "@/components/ui/icon";

const NAV = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/business", icon: "category", label: "Business types" },
] as const;

/** Desktop-first admin frame: fixed 240px sidebar + content (Stitch "Admin Dashboard"). */
export function AdminShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-surface-container-high bg-surface-container-lowest p-md md:flex">
        <Link href="/admin" className="mb-xl flex items-center gap-sm px-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
            <Icon name="coffee" className="text-icon-lg" />
          </span>
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
