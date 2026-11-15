import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Login" };

export default function Page() {
  return (
    <PlaceholderPage title="Login" route="/login" description="Café owner and platform login." />
  );
}
