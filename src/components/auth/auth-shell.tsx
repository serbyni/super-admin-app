import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

// Evaluated once when the module loads (Cache Components forbid new Date() during prerender).
const YEAR = new Date().getFullYear();

/** Page frame shared by all auth screens: glass header, ambient glows, footer. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col justify-between">
      <header className="z-50 w-full bg-surface/70 shadow-header backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-gutter lg:px-container-margin-desktop">
          <Link href="/" className="group flex items-center gap-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-on-primary-container transition-transform group-hover:scale-105">
              <Icon name="coffee" className="text-icon-lg" />
            </span>
            <span className="font-headline-md text-headline-md tracking-tight text-primary">
              Serbi
            </span>
          </Link>
          <nav className="flex items-center gap-lg">
            <Link
              href="/"
              className="flex items-center gap-xs font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase transition-colors hover:text-on-surface"
            >
              <Icon name="arrow_back" className="text-icon-sm" flipRtl />
              <span className="hidden sm:inline">Public site</span>
            </Link>
            <Link
              href="/contact"
              className="flex items-center gap-xs font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase transition-colors hover:text-on-surface"
            >
              <Icon name="help_outline" className="text-icon-sm" />
              <span className="hidden sm:inline">Help</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative flex w-full flex-1 items-center justify-center overflow-hidden px-gutter py-xl">
        <div className="pointer-events-none absolute -top-32 -left-20 -z-10 h-96 w-96 rounded-full bg-secondary-fixed/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -bottom-24 -z-10 h-80 w-80 rounded-full bg-tertiary-fixed/35 blur-3xl" />
        {children}
      </main>

      <footer className="w-full bg-surface-container-low/80 py-md backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-sm px-gutter text-center sm:flex-row sm:text-start lg:px-container-margin-desktop">
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            © {YEAR} Serbi. All rights reserved.
          </p>
          <div className="flex items-center gap-md">
            <Link
              href="/privacy"
              className="font-label-sm text-label-sm text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="font-label-sm text-label-sm text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
