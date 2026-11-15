import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Register" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Register"
      route="/register"
      description="Café owner registration (email verification, then approval by Serbi)."
    />
  );
}
