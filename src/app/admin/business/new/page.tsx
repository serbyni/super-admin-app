import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/admin";
import { BusinessTypeForm } from "../business-type-form";

export const metadata: Metadata = { title: "New business type" };

async function Guarded() {
  await requireAdmin();
  return <BusinessTypeForm />;
}

export default function NewBusinessTypePage() {
  return (
    <AdminShell active="/admin/business">
      <PageHeader title="New business type" />
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Guarded />
      </Suspense>
    </AdminShell>
  );
}
