import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_key_000000";
process.env.NEXT_PUBLIC_SITE_URL = "https://dev.serbi.me";

const { EmailDispatcher } = await import("./email-dispatcher");

const delivery = (id: string, template: string) => ({
  delivery_id: id,
  template,
  attempts: 1,
  recipient_email: `${id}@example.com`,
  recipient_name: "Amira Ben Salah",
  business_name: "Artisan Brew",
  locale: "en",
  reason: template === "admin_declined_user" ? "Could not verify the address." : null,
});

function fakeDb(claimed: ReturnType<typeof delivery>[]) {
  const rpc = vi.fn(async (fn: string) =>
    fn === "email_claim_deliveries" ? { data: claimed, error: null } : { data: null, error: null },
  );
  return { db: { rpc } as never, rpc };
}

const config = { RESEND_API_KEY: "re_test", EMAIL_FROM: "Serbi <noreply@dev.serbi.me>" };

beforeEach(() => send.mockReset());

describe("EmailDispatcher", () => {
  it("sends each claimed delivery once, with its id as idempotency key, and records the result", async () => {
    send.mockResolvedValueOnce({ data: { id: "msg_1" }, error: null }).mockResolvedValueOnce({
      data: null,
      error: { name: "rate_limit_exceeded", message: "slow down" },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, rpc } = fakeDb([
      delivery("d1", "admin_approve_user"),
      delivery("d2", "admin_declined_user"),
    ]);

    const result = await new EmailDispatcher(db, config).run();

    expect(result).toEqual({ sent: 1, failed: 1 });
    expect(send).toHaveBeenCalledTimes(2);
    const [payload, options] = send.mock.calls[0];
    expect(payload).toMatchObject({
      from: "Serbi <noreply@dev.serbi.me>",
      to: "d1@example.com",
      subject: "You're approved — welcome to Serbi",
      tags: [{ name: "template", value: "admin_approve_user" }],
    });
    expect(payload.html).toContain("https://dev.serbi.me/login");
    expect(options).toEqual({ idempotencyKey: "delivery-d1" });
    expect(send.mock.calls[1][0].html).toContain("Could not verify the address.");

    expect(rpc).toHaveBeenCalledWith("email_complete_delivery", {
      p_delivery_id: "d1",
      p_provider_message_id: "msg_1",
      p_error: undefined,
    });
    expect(rpc).toHaveBeenCalledWith("email_complete_delivery", {
      p_delivery_id: "d2",
      p_provider_message_id: undefined,
      p_error: "rate_limit_exceeded: slow down",
    });
  });

  it("records an error (no send) for an unknown template, and survives a thrown send", async () => {
    send.mockRejectedValueOnce(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, rpc } = fakeDb([delivery("d3", "nope"), delivery("d4", "register_new_user")]);

    const result = await new EmailDispatcher(db, config).run();

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

  it("reports missing settings instead of sending", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    const r = EmailDispatcher.fromEnv();
    expect(r).toEqual({ missing: ["SUPABASE_SECRET_KEY", "RESEND_API_KEY", "EMAIL_FROM"] });
  });
});
