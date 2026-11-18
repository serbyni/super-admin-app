import { redirectIfSignedIn } from "@/lib/auth/guards";

/** Put inside <Suspense> on guest-only pages: signed-in users are sent to their home page. */
export async function RedirectIfSignedIn() {
  await redirectIfSignedIn();
  return null;
}
