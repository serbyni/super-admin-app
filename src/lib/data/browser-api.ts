import type { Provider } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET } from "@/lib/website/schema";
import { toAppNotification, type AppNotification } from "./services/notification-types";
import type { Db } from "./types";

/** Data calls available in Client Components (browser session). */
export class BrowserApi {
  constructor(private readonly db: Db) {}

  /** Start Google/Facebook sign-in (redirects away on success). False when it could not start. */
  async startOAuthSignIn(provider: Provider): Promise<boolean> {
    const { error } = await this.db.auth.signInWithOAuth({
      provider,
      options: { redirectTo: siteUrl("/auth/callback") },
    });
    return !error;
  }

  /**
   * Upload a file to the café media bucket (public read). Storage policies only allow the café's
   * owner to write in <cafe_id>/. False when the upload failed.
   */
  async uploadCafeMedia(path: string, file: Blob): Promise<boolean> {
    const { error } = await this.db.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    return !error;
  }

  /**
   * Live notifications of the signed-in user: private Realtime Broadcast channel
   * `notifications:<userId>` (the database only lets that user subscribe). A trigger on
   * platform.notifications publishes each new row. Returns an unsubscribe function.
   */
  subscribeToNotifications(
    userId: string,
    onNotification: (n: AppNotification) => void,
  ): () => void {
    const channel = this.db.channel(`notifications:${userId}`, { config: { private: true } });
    let cancelled = false;
    void (async () => {
      // Private channels authorise with the user's access token.
      await this.db.realtime.setAuth();
      if (cancelled) return;
      channel
        .on("broadcast", { event: "notification" }, ({ payload }) => {
          const p = payload as { id: string; type: string; data: unknown; created_at: string };
          if (p?.id) onNotification(toAppNotification(p));
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      void this.db.removeChannel(channel);
    };
  }
}

/** Browser API (the browser client is a singleton inside @supabase/ssr, so this is cheap). */
export function browserApi(): BrowserApi {
  return new BrowserApi(createClient());
}
