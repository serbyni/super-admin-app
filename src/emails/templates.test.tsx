import { describe, expect, it } from "vitest";
import { renderEmail } from "./templates";

const links = {
  status: "https://dev.serbi.me/pending",
  signIn: "https://dev.serbi.me/login",
  contact: "https://dev.serbi.me/contact",
};

describe("email templates", () => {
  it("register_new_user: subject, greeting, business, status link", async () => {
    const e = await renderEmail("register_new_user", {
      recipientName: "Amira Ben Salah",
      businessName: "Artisan Brew",
      links,
    });
    expect(e.subject).toBe("We received your Serbi application");
    expect(e.html).toContain("Hi Amira,");
    expect(e.html).toContain("Artisan Brew");
    expect(e.html).toContain(links.status);
    expect(e.text).toContain("Artisan Brew");
  });

  it("admin_approve_user links to sign in", async () => {
    const e = await renderEmail("admin_approve_user", { businessName: "Artisan Brew", links });
    expect(e.subject).toBe("You're approved — welcome to Serbi");
    expect(e.html).toContain(links.signIn);
    expect(e.html).toContain("Hi,");
  });

  it("admin_declined_user shows the reason, HTML-escaped", async () => {
    const e = await renderEmail("admin_declined_user", {
      businessName: "Artisan Brew",
      reason: 'Address not verified <script>alert("x")</script>',
      links,
    });
    expect(e.subject).toBe("Update on your Serbi application");
    expect(e.html).toContain("Address not verified");
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.text).toContain("Address not verified");
  });

  it("falls back to English and a generic business name", async () => {
    const e = await renderEmail("register_new_user", { locale: "fr", businessName: " ", links });
    expect(e.subject).toBe("We received your Serbi application");
    expect(e.html).toContain("your café");
  });
});
