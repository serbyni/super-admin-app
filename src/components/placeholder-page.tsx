import type { ReactNode } from "react";

type PlaceholderPageProps = {
  title: string;
  route: string;
  description?: string;
  children?: ReactNode;
};

/** Temporary page shell used while the real screens are being built. */
export function PlaceholderPage({ title, route, description, children }: PlaceholderPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-16">
      <p className="font-mono text-sm text-zinc-500">{route}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="text-zinc-600 dark:text-zinc-400">{description}</p> : null}
      {children}
    </main>
  );
}
