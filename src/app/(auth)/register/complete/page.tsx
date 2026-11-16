import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Icon } from "@/components/ui/icon";
import { pathForStatus } from "@/lib/auth/owner-status";
import { getOwnerSession } from "@/lib/auth/session";
import { listActiveBusinessTypes } from "@/lib/data/business-types";
import { mapsClientConfig } from "@/lib/maps/server";
import { CompleteProfileForm } from "./complete-form";

export const metadata: Metadata = { title: "Complete your profile" };

async function Form() {
  const { user, status } = await getOwnerSession();
  if (!user) redirect("/login");
  if (status !== "profile_incomplete") redirect(pathForStatus(status));
  const meta = user.user_metadata ?? {};
  const name =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : "";
  return (
    <>
      <p className="text-on-surface-variant">
        Signed in as <strong className="text-on-surface">{user.email}</strong>. Tell us about your
        business so the Serbi team can review your application.
      </p>
      <CompleteProfileForm
        defaults={{ fullName: name }}
        businessTypes={await listActiveBusinessTypes()}
        maps={mapsClientConfig()}
      />
    </>
  );
}

export default function CompleteProfilePage() {
  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-2xl rounded-xl bg-surface-container-lowest p-lg shadow-md sm:p-xl">
        <span className="mb-sm inline-flex items-center gap-xs rounded-full bg-secondary-fixed px-sm py-xs font-label-sm text-label-sm tracking-wider text-on-secondary-fixed uppercase">
          <Icon name="storefront" className="text-icon-xs" />
          One last step
        </span>
        <h1 className="mb-md text-headline-md tracking-tight text-on-surface">
          Complete your profile
        </h1>
        <div className="flex flex-col gap-md">
          <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
            <Form />
          </Suspense>
        </div>
      </div>
    </AuthShell>
  );
}
