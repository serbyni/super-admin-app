import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Privacy Policy"
      route="/privacy"
      description="How Serbi processes personal data (GDPR)."
    />
  );
}
