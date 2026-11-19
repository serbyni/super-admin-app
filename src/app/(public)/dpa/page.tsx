import type { Metadata } from "next";
import { DPA_VERSION } from "@/config/legal";

export const metadata: Metadata = { title: "Data Processing Agreement" };

/** Placeholder until the legal text is final (DPA_VERSION ends with "-draft"). */
export default function DpaPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-md px-gutter py-xl">
      <p className="w-fit rounded-full bg-secondary-container px-md py-xs text-caption font-semibold text-on-secondary-container uppercase">
        Draft · version {DPA_VERSION}
      </p>
      <h1 className="text-display-lg text-primary">Data Processing Agreement</h1>
      <p className="text-on-surface-variant">
        Your café is the <strong className="text-on-surface">controller</strong> of its business
        data (menu, orders, customers, staff). Serbi is the{" "}
        <strong className="text-on-surface">processor</strong>: we store and process that data only
        to run the service for your café, on your instructions.
      </p>
      <ul className="list-disc space-y-xs ps-lg text-on-surface-variant">
        <li>Data is hosted in the European Union (Supabase, eu-west-1).</li>
        <li>
          The Serbi platform team cannot browse your café&apos;s business data; support access needs
          your time-limited permission.
        </li>
        <li>
          Sub-processors (hosting, email delivery, maps) are listed here before they are used.
        </li>
        <li>You can export or delete your café&apos;s data when you leave.</li>
      </ul>
      <p className="rounded-lg bg-surface-container-low p-md text-body-sm text-on-surface-variant">
        This is a summary placeholder. The full agreement will replace this page; when it changes,
        café owners are asked to accept the new version.
      </p>
    </main>
  );
}
