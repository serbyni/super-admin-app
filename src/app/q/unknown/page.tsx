import type { Metadata } from "next";
import { BrandMark } from "@/components/ui/brand-mark";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "QR code not recognised",
  robots: { index: false },
};

/** Where an unknown or mistyped QR code lands. */
export default function UnknownQrPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-md bg-background px-gutter text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-primary">
        <Icon name="qr_code_scanner" className="text-icon-2xl" />
      </span>
      <h1 className="text-headline-md text-on-surface">This QR code isn&apos;t recognised</h1>
      <p className="max-w-card-sm text-body-md text-on-surface-variant">
        It may be old or damaged. Please ask the staff for the menu, or scan another code.
      </p>
      <p className="mt-lg flex items-center gap-xs text-caption text-outline">
        <BrandMark className="h-5 w-5" /> Serbi
      </p>
    </main>
  );
}
