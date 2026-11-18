"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { serverApi } from "@/lib/data/server-api";

export type LoginState = { error?: string; email?: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Enter your email and password.", email };

  const api = serverApi();
  const result = await api.auth.signInWithPassword(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    if (result.code === "email_not_confirmed") {
      redirect(`/register/check-email?email=${encodeURIComponent(parsed.data.email)}`);
    }
    return {
      error:
        result.code === "invalid_credentials"
          ? "Incorrect email or password."
          : "Could not sign in. Please try again in a moment.",
      email,
    };
  }
  redirect(await api.auth.homePath(parsed.data.next));
}
