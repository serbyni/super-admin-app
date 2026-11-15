import Link from "next/link";
import { PlaceholderPage } from "@/components/placeholder-page";

const routes = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
  { href: "/forgot-password", label: "Forgot password" },
  { href: "/reset-password/success", label: "Password updated (success)" },
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact" },
  { href: "/admin", label: "Super admin" },
  { href: "/demo-cafe/admin", label: "Tenant admin (example: demo-cafe)" },
] as const;

export default function Home() {
  return (
    <PlaceholderPage title="Serbi" route="/" description="Platform home. Route map (temporary).">
      <ul className="list-disc ps-6">
        {routes.map((r) => (
          <li key={r.href}>
            <Link className="underline" href={r.href}>
              {r.label}
            </Link>
          </li>
        ))}
      </ul>
    </PlaceholderPage>
  );
}
