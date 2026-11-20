import { describe, expect, it } from "vitest";
import { toAppNotification } from "@/lib/data/services/notification-types";
import { describeNotification } from "./describe";

const n = (type: string, data: object) =>
  describeNotification(
    toAppNotification({ id: "1", type, data, created_at: "2026-11-20T10:00:00Z" }),
  );

describe("language notifications", () => {
  it("tells admins about a request, with the note", () => {
    const d = n("language_requested", { cafe_name: "Lune Bleue", locale: "it", note: "Tourists" });
    expect(d.body).toBe("Lune Bleue asks for Italian (Italiano) — “Tourists”");
    expect(d.href).toBe("/admin/languages");
  });

  it("tells the owner the decision and links to Settings → Languages", () => {
    const ok = n("language_request_decided", { cafe_slug: "lune", locale: "it", approved: true });
    expect(ok.title).toBe("Italian (Italiano) added");
    expect(ok.href).toBe("/lune/dashboard/settings?tab=languages");
    const no = n("language_request_decided", {
      cafe_slug: "lune",
      locale: "de",
      approved: false,
      note: "Not yet",
    });
    expect(no.title).toBe("German (Deutsch) request declined");
    expect(no.body).toContain("Not yet");
  });
});
