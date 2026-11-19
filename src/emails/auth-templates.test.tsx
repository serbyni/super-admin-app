import { describe, expect, it } from "vitest";
import { renderSupabaseConfirmSignup, renderSupabaseResetPassword } from "./auth-templates";

describe("Supabase confirm-signup template", () => {
  it("links to our /auth/callback with token_hash and uses Supabase variables", async () => {
    const t = await renderSupabaseConfirmSignup();
    expect(t.subject).toBe("Confirm your email for Serbi");
    expect(t.html).toContain('href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=email"');
    expect(t.html).toContain("{{ .SiteURL }}/brand/serbi-email-mark.png");
    expect(t.html).toContain("{{ .Email }}");
    expect(t.html).toContain("Almost there, {{ .Data.full_name }}!");
    expect(t.html).toContain("registering {{ .Data.business_name }} on Serbi");
    // No unresolved React placeholders / comments
    expect(t.html).not.toMatch(/\{\{\{/);
    expect(t.html).not.toContain("<!--$-->");
  });
});

describe("Supabase reset-password template", () => {
  it("links to /auth/reset with token_hash + type=recovery", async () => {
    const t = await renderSupabaseResetPassword();
    expect(t.subject).toBe("Reset your Serbi password");
    expect(t.html).toContain(
      'href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery"',
    );
    expect(t.html).toContain("{{ .SiteURL }}/brand/serbi-email-mark.png");
    expect(t.html).not.toContain("<!--$-->");
  });
});
