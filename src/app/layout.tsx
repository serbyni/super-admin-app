import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { EnglishIntl } from "@/components/ui/english-intl";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "Serbi", template: "%s · Serbi" },
  description: "Serbi — QR menus and ordering for cafés.",
  // Icons come from src/app/icon.png + apple-icon.png (Next.js file conventions).
  openGraph: { images: ["/brand/serbi-logo.jpg"] },
  // Home Screen app on iPhone (needed there for push notifications).
  appleWebApp: { capable: true, title: "Serbi", statusBarStyle: "default" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full`}>
      <head>
        {/* Icon font (Material Symbols). next/font does not support icon fonts. */}
        {/* display=block avoids showing icon names as text while the font loads. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className="flex min-h-full flex-col">
        {/* English by default (admin console); owner layouts nest their own language (OwnerIntl). */}
        <EnglishIntl>
          <ToastProvider>{children}</ToastProvider>
        </EnglishIntl>
      </body>
    </html>
  );
}
