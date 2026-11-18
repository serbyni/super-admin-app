import { Suspense, type ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/guards";

/**
 * (admin) — super admins only. Signed out → /login?next=…; any other signed-in user → their own
 * home. The proxy redirects signed-out visitors first; this checks the role on the server.
 * (Admin pages and RPCs re-check too: a layout alone is not a security boundary.)
 */
async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}

export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
