/**
 * Writes the Supabase Auth email templates (styled like our emails) to supabase/templates/.
 *   npm run email:supabase
 * Then paste the HTML into Supabase → Authentication → Emails → Templates → "Confirm signup".
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderSupabaseConfirmSignup } from "../src/emails/auth-templates";

void (async () => {
  const out = join(import.meta.dirname, "..", "supabase", "templates");
  const confirm = await renderSupabaseConfirmSignup();
  writeFileSync(join(out, "confirm-signup.html"), confirm.html + "\n");
  writeFileSync(join(out, "confirm-signup.subject.txt"), confirm.subject + "\n");
  console.log(
    `email:supabase: supabase/templates/confirm-signup.html (subject: ${confirm.subject})`,
  );
})();
