import { Suspense } from "react";
import { OwnerIntl } from "@/i18n/owner-intl";

/**
 * Sign-in, registration, password and onboarding pages: in the owner's language (account
 * choice when signed in, else the language picked here, else the browser's), RTL in Arabic.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <OwnerIntl>{children}</OwnerIntl>
    </Suspense>
  );
}
