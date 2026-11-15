import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "About us" };

export default function Page() {
  return <PlaceholderPage title="About us" route="/about" description="About Serbi." />;
}
