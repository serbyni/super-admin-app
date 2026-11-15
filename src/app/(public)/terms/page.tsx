import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Terms of Service"
      route="/terms"
      description="Terms for cafés using Serbi."
    />
  );
}
