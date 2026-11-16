import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    events = { send };
  },
}));
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_key_000000";
process.env.NEXT_PUBLIC_SITE_URL = "https://dev.serbi.me";

const { EmailDispatcher, escapeHtml } = await import("./email-dispatcher");

const delivery = (id: string, template: string, extra: Record<string, unknown> = {}) => ({
  delivery_id: id,
  template,
  attempts: 1,
  recipient_email: `${id}@example.com`,
  recipient_name: "Amira Ben Salah",
  business_name: "Artisan Brew & Co",
  business_address: "47 Avenue Habib Bourguiba, 1000 Tunis",
  locale: "en",
  reason: template === "admin_declined_user" ? "Could not verify <the> address." : null,
  submitted_at: "2026-11-16T19:14:00Z",
  decided_at: "2026-11-17T08:30:00Z",
  ...extra,
});

function fakeDb(claimed: ReturnType<typeof delivery>[]) {
  const rpc = vi.fn(async (fn: string) =>
    fn === "email_claim_deliveries" ? { data: claimed, error: null } : { data: null, error: null },
  );
  return { db: { rpc } as never, rpc };
}

const config = { RESEND_API_KEY: "re_test" };
const SITE = "https://dev.serbi.me/";

beforeEach(() => send.mockReset());

describe("EmailDispatcher (Resend events)", () => {
  it("sends one event per delivery with the template's variables, escaped, and an idempotency key", async () => {
    send
      .mockResolvedValueOnce({
        data: { object: "event", event: "admin_approve_user" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { name: "rate_limit_exceeded", message: "slow down" },
      });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, rpc } = fakeDb([
      delivery("d1", "admin_approve_user"),
      delivery("d2", "admin_declined_user"),
    ]);

    const result = await new EmailDispatcher(db, config, SITE).run();

    expect(result).toEqual({ sent: 1, failed: 1 });
    expect(send).toHaveBeenNthCalledWith(
      1,
      {
        event: "admin_approve_user",
        email: "d1@example.com",
        payload: {
          site_url: "https://dev.serbi.me",
          owner_name: "Amira",
          owner_email: "d1@example.com",
          business_name: "Artisan Brew &amp; Co",
          business_address: "47 Avenue Habib Bourguiba, 1000 Tunis",
          decided_at: "17 Nov 2026, 09:30",
        },
      },
      { headers: { "Idempotency-Key": "delivery-d1" } },
    );
    // Declined: reason included and escaped; approve-only fields not sent.
    const declined = send.mock.calls[1][0].payload;
    expect(declined.reason).toBe("Could not verify &lt;the&gt; address.");
    expect(declined).not.toHaveProperty("owner_email");

    expect(rpc).toHaveBeenCalledWith("email_complete_delivery", {
      p_delivery_id: "d1",
      p_provider_message_id: "event:admin_approve_user",
      p_error: undefined,
    });
    expect(rpc).toHaveBeenCalledWith("email_complete_delivery", {
      p_delivery_id: "d2",
      p_provider_message_id: undefined,
      p_error: "rate_limit_exceeded: slow down",
    });
  });

  it("omits empty values so Resend uses the template fallback", async () => {
    send.mockResolvedValueOnce({
      data: { object: "event", event: "register_new_user" },
      error: null,
    });
    const { db } = fakeDb([
      delivery("d5", "register_new_user", { recipient_name: null, business_address: null }),
    ]);
    await new EmailDispatcher(db, config, SITE).run();
    const payload = send.mock.calls[0][0].payload;
    expect(payload).not.toHaveProperty("owner_name");
    expect(payload).not.toHaveProperty("business_address");
    expect(payload.submitted_at).toBe("16 Nov 2026, 20:14");
  });

  it("records an error for an unknown template and survives a thrown send", async () => {
    send.mockRejectedValueOnce(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, rpc } = fakeDb([delivery("d3", "nope"), delivery("d4", "register_new_user")]);

    const result = await new EmailDispatcher(db, config, SITE).run();

    expect(result).toEqual({ sent: 0, failed: 2 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "email_complete_delivery",
      expect.objectContaining({ p_delivery_id: "d3", p_error: "unknown template nope" }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "email_complete_delivery",
      expect.objectContaining({ p_delivery_id: "d4", p_error: "network down" }),
    );
  });

  it("escapeHtml escapes markup characters", () => {
    expect(escapeHtml(`<a href="x">Tom's & Co</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom&#39;s &amp; Co&lt;/a&gt;",
    );
  });

  it("reports missing settings instead of sending", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    expect(EmailDispatcher.fromEnv()).toEqual({
      missing: ["SUPABASE_SECRET_KEY", "RESEND_API_KEY"],
    });
  });
});
