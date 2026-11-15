"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isOwnerStatus, pathForStatus } from "@/lib/auth/owner-status";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; email?: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
  next: z.string().optional(),
});

/** Only allow same-site relative paths as post-login destinations. */
function safeNext(next: string | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Enter your email and password.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    if (error.code === "email_not_confirmed") {
      redirect(`/register/check-email?email=${encodeURIComponent(parsed.data.email)}`);
    }
    return {
      error:
        error.code === "invalid_credentials"
          ? "Incorrect email or password."
          : "Could not sign in. Please try again in a moment.",
      email,
    };
  }

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (isAdmin === true) redirect(safeNext(parsed.data.next) ?? "/admin");

  const { data: status } = await supabase.rpc("get_my_owner_status");
  redirect(pathForStatus(isOwnerStatus(status) ? status : null));
}
