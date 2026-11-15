import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Forgot password"
      route="/forgot-password"
      description="Request a password reset email."
    />
  );
}
