import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { LiveNotificationsForUser } from "@/components/notifications/live-notifications-for-user";
import { Icon } from "@/components/ui/icon";

export type ShellNavItem = {
  href: string;
  icon: string;
  label: string;
  /** Streamed count bubble etc. (wrap async content in <Suspense>). */
  badge?: ReactNode;
  /** Not built yet: shown greyed with a "Soon" chip, not clickable. */
  soon?: boolean;
};

export type ShellLabels = { signOut: string; menu: string; soon: string };
const EN_LABELS: ShellLabels = { signOut: "Sign out", menu: "Menu", soon: "Soon" };

type Props = {
  /** Logo + name block at the top of the sidebar (and of the phone bar). */
  brand: ReactNode;
  homeHref: string;
  nav: readonly ShellNavItem[];
  /** href of the current page's item. */
  active: string;
  /** Colours of the active item (default: Serbi primary). Used for a café's own colours. */
  accent?: { background: string; color: string };
  /** Extra content above "Sign out" (e.g. signed-in email, "Powered by Serbi"). */
  footer?: ReactNode;
  /** Texts of the frame (default English: admin console). */
  labels?: ShellLabels;
  children: ReactNode;
};

function NavList({
  nav,
  active,
  accent,
  soon,
}: Pick<Props, "nav" | "active" | "accent"> & { soon: string }) {
  return (
    <nav className="flex flex-col gap-xs">
      {nav.map((item) => {
        if (item.soon) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className="flex cursor-default items-center gap-sm rounded-lg px-sm py-sm text-body-sm font-semibold text-outline"
            >
              <Icon name={item.icon} className="text-icon-lg" />
              {item.label}
              <span className="ms-auto rounded-full bg-surface-container-high px-xs text-caption text-on-surface-variant">
                {soon}
              </span>
            </span>
          );
        }
        const isActive = item.href === active;
        const style: CSSProperties | undefined = isActive && accent ? accent : undefined;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            style={style}
            className={`flex items-center gap-sm rounded-lg px-sm py-sm text-body-sm font-semibold transition-colors ${
              isActive
                ? accent
                  ? ""
                  : "bg-primary-container text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            }`}
          >
            <Icon name={item.icon} className="text-icon-lg" />
            {item.label}
            {item.badge}
          </Link>
        );
      })}
    </nav>
  );
}

function SignOut({ label }: { label: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="flex w-full items-center gap-sm rounded-lg px-sm py-sm text-body-sm font-semibold text-error transition-colors hover:bg-error-container"
      >
        <Icon name="logout" className="text-icon-lg" flipRtl />
        {label}
      </button>
    </form>
  );
}

/**
 * App frame shared by the super-admin area and the café dashboard: fixed 240px sidebar on
 * desktop; on phones a top bar whose menu button opens the same navigation (no JavaScript:
 * native <details>).
 */
export function AppShell({
  brand,
  homeHref,
  nav,
  active,
  accent,
  footer,
  labels = EN_LABELS,
  children,
}: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      {/* Phone: top bar + collapsible menu */}
      <details className="group sticky top-0 z-40 border-b border-surface-container-high bg-surface-container-lowest md:hidden">
        <summary className="no-marker flex cursor-pointer items-center gap-sm px-gutter py-sm">
          <Link href={homeHref} className="flex min-w-0 flex-1 items-center gap-sm">
            {brand}
          </Link>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low">
            <span className="flex group-open:hidden">
              <Icon name="menu" className="text-icon-xl" />
            </span>
            <span className="hidden group-open:flex">
              <Icon name="close" className="text-icon-xl" />
            </span>
            <span className="sr-only">{labels.menu}</span>
          </span>
        </summary>
        <div className="flex flex-col gap-sm px-gutter pb-md">
          <NavList nav={nav} active={active} accent={accent} soon={labels.soon} />
          {footer}
          <SignOut label={labels.signOut} />
        </div>
      </details>

      {/* Desktop: sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-surface-container-high bg-surface-container-lowest p-md md:flex">
        <Link href={homeHref} className="mb-xl flex items-center gap-sm px-sm">
          {brand}
        </Link>
        <div className="flex-1 overflow-y-auto">
          <NavList nav={nav} active={active} accent={accent} soon={labels.soon} />
        </div>
        <div className="flex flex-col gap-sm">
          {footer}
          <SignOut label={labels.signOut} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-gutter py-lg lg:px-container-margin-desktop">
        {children}
      </main>
      <Suspense fallback={null}>
        <LiveNotificationsForUser />
      </Suspense>
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
      <div className="min-w-0">
        <h1 className="text-display-lg text-primary">{title}</h1>
        {description ? <p className="mt-xs text-on-surface-variant">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
