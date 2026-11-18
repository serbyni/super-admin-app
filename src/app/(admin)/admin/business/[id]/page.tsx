import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { BusinessTypeForm } from "../business-type-form";
import { listBusinessTypesForAdmin } from "../data";

export const metadata: Metadata = { title: "Edit business type" };

async function Editor({ params }: { params: PageProps<"/admin/business/[id]">["params"] }) {
  const { id } = await params;
  const type = (await listBusinessTypesForAdmin()).find((t) => t.id === id);
  if (!type) notFound();
  return (
    <>
      <p className="mb-md text-body-sm text-on-surface-variant">
        Used by <strong className="text-on-surface">{type.owners_count}</strong> café owner
        {type.owners_count === 1 ? "" : "s"}. Changing the code updates their records too.
      </p>
      <BusinessTypeForm type={type} />
    </>
  );
}

export default function EditBusinessTypePage({ params }: PageProps<"/admin/business/[id]">) {
  return (
    <AdminShell active="/admin/business">
      <PageHeader title="Edit business type" />
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Editor params={params} />
      </Suspense>
    </AdminShell>
  );
}
