import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Café" };

async function Cafe({ params }: { params: PageProps<"/admin/cafes/[slug]">["params"] }) {
  await requireAdmin();
  const { slug } = await params;
  return (
    <>
      <PageHeader
        title={slug}
        description="Platform-side management of one café: status, plan and owner. No café business data (GDPR)."
      />
      <p className="rounded-xl bg-surface-container-lowest p-lg text-on-surface-variant">
        Coming soon.
      </p>
    </>
  );
}

export default function AdminCafePage({ params }: PageProps<"/admin/cafes/[slug]">) {
  return (
    <AdminShell active="/admin">
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Cafe params={params} />
      </Suspense>
    </AdminShell>
  );
}
