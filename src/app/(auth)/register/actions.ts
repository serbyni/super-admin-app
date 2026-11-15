"use server";

import { redirect } from "next/navigation";
import { TERMS_VERSION } from "@/config/legal";
import { siteUrl } from "@/lib/env";
import {
  businessProfileSchema,
  fieldErrors,
  registerSchema,
  type FieldErrors,
} from "@/lib/auth/register-schema";
import { getActiveBusinessTypes } from "@/lib/business-types/data";
import { locationFromForm } from "@/lib/location/schema";
import { createClient } from "@/lib/supabase/server";

/** Map location validation issues onto the picker's fields. */
function locationErrors(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "location");
    if (key === "city" || key === "street" || key === "postal_code" || key === "country_code") {
      out[key] ??= issue.message;
    } else {
      out.location ??=
        "Choose your business location: search on the map, drop a pin or enter coordinates.";
    }
  }
  return out;
}

async function isActiveBusinessType(slug: string): Promise<boolean> {
  return (await getActiveBusinessTypes()).some((t) => t.slug === slug);
}

export type FormState = { errors?: FieldErrors; values?: Record<string, string> };

const KEEP = [
  "fullName",
  "phone",
  "email",
  "businessName",
  "businessType",
  "location",
  "street",
  "postal_code",
  "city",
];

function keepValues(raw: Record<string, FormDataEntryValue>): Record<string, string> {
  return Object.fromEntries(KEEP.map((k) => [k, typeof raw[k] === "string" ? raw[k] : ""]));
}

const AUTH_ERRORS: Record<string, string> = {
  over_email_send_rate_limit: "Too many emails were sent. Please wait a few minutes and try again.",
  over_request_rate_limit: "Too many attempts. Please wait a few minutes and try again.",
  weak_password: "This password is too weak or has appeared in a data breach. Choose another.",
  email_address_invalid: "This email address cannot be used.",
  signup_disabled: "Sign-ups are temporarily closed.",
};

/** Email sign-up for café owners → verification email → /register/check-email. */
export async function registerOwner(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const parsed = registerSchema.safeParse(raw);
  const location = locationFromForm(formData);
  if (!parsed.success || !location.success) {
    return {
      errors: {
        ...(location.success ? {} : locationErrors(location.error)),
        ...(parsed.success ? {} : fieldErrors(parsed.error)),
      },
      values: keepValues(raw),
    };
  }

  const d = parsed.data;
  if (!(await isActiveBusinessType(d.businessType))) {
    return {
      errors: { businessType: "Choose a business type from the list" },
      values: keepValues(raw),
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      emailRedirectTo: siteUrl("/auth/callback"),
      data: {
        signup_source: "owner",
        full_name: d.fullName,
        phone: d.phone,
        business_name: d.businessName,
        business_type: d.businessType,
        location: location.data,
        locale: "en",
        terms_version: TERMS_VERSION,
      },
    },
  });

  if (error) {
    return {
      errors: {
        form: AUTH_ERRORS[error.code ?? ""] ?? "Could not create the account. Please try again.",
      },
      values: keepValues(raw),
    };
  }
  // Same screen whether or not the email already exists (no account enumeration).
  redirect(`/register/check-email?email=${encodeURIComponent(d.email)}`);
}

export type ResendState = { sent?: boolean; error?: string };

export async function resendConfirmation(
  _prev: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Missing email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: siteUrl("/auth/callback") },
  });
  if (error)
    return {
      error: AUTH_ERRORS[error.code ?? ""] ?? "Could not resend the email. Try again later.",
    };
  return { sent: true };
}

/** Google/Facebook sign-ups: add the business details, then submit for review. */
export async function completeOwnerProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const parsed = businessProfileSchema.safeParse(raw);
  const location = locationFromForm(formData);
  if (!parsed.success || !location.success) {
    return {
      errors: {
        ...(location.success ? {} : locationErrors(location.error)),
        ...(parsed.success ? {} : fieldErrors(parsed.error)),
      },
      values: keepValues(raw),
    };
  }

  const d = parsed.data;
  if (!(await isActiveBusinessType(d.businessType))) {
    return {
      errors: { businessType: "Choose a business type from the list" },
      values: keepValues(raw),
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_owner_profile", {
    p_full_name: d.fullName,
    p_phone: d.phone,
    p_business_name: d.businessName,
    p_business_type: d.businessType,
    p_location: location.data,
    p_locale: "en",
    p_terms_version: TERMS_VERSION,
  });
  if (error) {
    if (error.message.includes("not_authenticated")) redirect("/login");
    if (error.message.includes("profile_already_completed")) redirect("/pending");
    if (error.message.includes("invalid_location")) {
      return {
        errors: { location: "Choose your business location on the map." },
        values: keepValues(raw),
      };
    }
    return {
      errors: { form: "Could not save your details. Please try again." },
      values: keepValues(raw),
    };
  }
  redirect("/pending");
}
