/**
 * Writes the Supabase Auth email templates (styled like our emails) to supabase/templates/.
 *   npm run email:supabase
 * Then paste each HTML into Supabase → Authentication → Emails → Templates
 * ("Confirm signup", "Reset password", "Change email address").
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  renderSupabaseChangeEmail,
  renderSupabaseConfirmSignup,
  renderSupabaseResetPassword,
} from "../src/emails/auth-templates";

void (async () => {
  const out = join(import.meta.dirname, "..", "supabase", "templates");
  const templates = [
    ["confirm-signup", await renderSupabaseConfirmSignup()],
    ["reset-password", await renderSupabaseResetPassword()],
    ["change-email", await renderSupabaseChangeEmail()],
  ] as const;
  for (const [name, t] of templates) {
    writeFileSync(join(out, `${name}.html`), t.html + "\n");
    writeFileSync(join(out, `${name}.subject.txt`), t.subject + "\n");
    console.log(`email:supabase: supabase/templates/${name}.html (subject: ${t.subject})`);
  }
})();
