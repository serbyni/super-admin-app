import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Super admin" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Super admin"
      route="/admin"
      description="Platform console: café applications, directory, plans, aggregated statistics."
    />
  );
}
