import { serverApi } from "@/lib/data/server-api";
import { LiveNotifications } from "./live-notifications";

/** Server wrapper (put inside <Suspense>): starts live notifications for the signed-in user. */
export async function LiveNotificationsForUser() {
  const user = await serverApi().auth.currentUser();
  return user ? <LiveNotifications userId={user.id} /> : null;
}
