import { describe, expect, it } from "vitest";
import {
  EMAIL_TEMPLATES,
  renderEmail,
  renderResendTemplate,
  TEMPLATE_VARIABLES,
} from "./templates";

const vars = {
  SITE_URL: "https://dev.serbi.me",
  OWNER_NAME: "Amira",
  OWNER_EMAIL: "amira@example.com",
  BUSINESS_NAME: "Artisan Brew",
  BUSINESS_ADDRESS: "47 Avenue Habib Bourguiba, Tunis",
  SUBMITTED_AT: "16 Nov 2026, 20:14",
  DECIDED_AT: "17 Nov 2026, 09:30",
};

describe("email templates (real values)", () => {
  it("register_new_user: subject, greeting, summary, status link", async () => {
    const e = await renderEmail("register_new_user", vars);
    expect(e.subject).toBe("We received your Serbi application");
    expect(e.html).toContain("Hello Amira,");
    expect(e.html).toContain("Artisan Brew");
    expect(e.html).toContain("47 Avenue Habib Bourguiba, Tunis");
    expect(e.html).toContain("https://dev.serbi.me/pending");
    expect(e.text.toLowerCase()).toContain("what happens next");
  });

  it("admin_approve_user links to sign in and shows the account", async () => {
    const e = await renderEmail("admin_approve_user", vars);
    expect(e.subject).toBe("You're approved — welcome to Serbi");
    expect(e.html).toContain("Congratulations Amira!");
    expect(e.html).toContain("https://dev.serbi.me/login");
    expect(e.html).toContain("amira@example.com");
  });

  it("admin_declined_user shows the reason, HTML-escaped", async () => {
    const e = await renderEmail("admin_declined_user", {
      ...vars,
      REASON: 'Address not verified <script>alert("x")</script>',
    });
    expect(e.subject).toBe("Update on your Serbi application");
    expect(e.html).toContain("Address not verified");
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;");
  });

  it("cafe_created: café, address, dashboard link via /auth/home", async () => {
    const e = await renderEmail("cafe_created", {
      ...vars,
      CAFE_NAME: "Lune Bleue",
      CAFE_HOST: "lune-bleue.serbi.me",
      CREATED_AT: "19 Nov 2026, 11:00",
    });
    expect(e.subject).toBe("Your café is ready on Serbi");
    expect(e.html).toContain("Well done Amira!");
    expect(e.html).toContain("lune-bleue.serbi.me");
    expect(e.html).toContain("https://dev.serbi.me/auth/home");
    expect(e.html).toContain("amira@example.com");
    expect(e.text.toLowerCase()).toContain("next steps");
  });

  it("uses defaults for missing values and falls back to English", async () => {
    const e = await renderEmail("register_new_user", { BUSINESS_NAME: " " }, "fr");
    expect(e.subject).toBe("We received your Serbi application");
    expect(e.html).toContain("Hello there,");
    expect(e.html).toContain("your café");
  });
});

describe("Resend templates (placeholders)", () => {
  it.each(EMAIL_TEMPLATES)(
    "%s uses {{{VARS}}} and declares exactly the variables it uses",
    async (t) => {
      const r = await renderResendTemplate(t);
      expect(r.alias).toBe(t);
      const used = [...r.html.matchAll(/\{\{\{([A-Z_]+)\}\}\}/g)].map((m) => m[1]);
      expect(new Set(used)).toEqual(new Set(TEMPLATE_VARIABLES[t]));
      expect(r.variables.map((v) => v.key).sort()).toEqual([...TEMPLATE_VARIABLES[t]].sort());
      expect(r.html).not.toMatch(/\{\{\{[^}]*\}\}\}\}/); // no broken braces
    },
  );
});
