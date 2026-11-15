import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return <PlaceholderPage title="Contact" route="/contact" description="Contact the Serbi team." />;
}
