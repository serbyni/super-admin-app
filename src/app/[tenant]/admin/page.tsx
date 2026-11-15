import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Tenant admin" };

async function TenantSlug({ params }: { params: PageProps<"/[tenant]/admin">["params"] }) {
  const { tenant } = await params;
  return <code className="font-mono">{tenant}</code>;
}

export default function Page({ params }: PageProps<"/[tenant]/admin">) {
  return (
    <PlaceholderPage
      title="Tenant admin"
      route="/[tenant]/admin"
      description="Platform-side management of one café (status, plan, owner). No café business data (GDPR)."
    >
      <p>
        Tenant:{" "}
        <Suspense fallback={<span className="text-zinc-400">…</span>}>
          <TenantSlug params={params} />
        </Suspense>
      </p>
    </PlaceholderPage>
  );
}
