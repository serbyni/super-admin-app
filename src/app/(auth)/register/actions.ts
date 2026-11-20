"use server";

import { redirect } from "next/navigation";
import {
  businessProfileSchema,
  fieldErrors,
  registerSchema,
  type FieldErrors,
} from "@/lib/auth/register-schema";
import { isDataError } from "@/lib/data/errors";
import { kickEmailDispatch } from "@/lib/data/kick-email";
import { msg } from "@/i18n/msg";
import { ownerLocale } from "@/i18n/owner-locale";
import { serverApi } from "@/lib/data/server-api";
import { locationFromForm } from "@/lib/location/schema";

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
      out.location ??= msg("locationRequired");
    }
  }
  return out;
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
  over_email_send_rate_limit: msg("signupEmailLimit"),
  over_request_rate_limit: msg("signupRequestLimit"),
  weak_password: msg("passwordWeak"),
  email_address_invalid: msg("signupEmailInvalid"),
  signup_disabled: msg("signupClosed"),
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
  const api = serverApi();
  if (!(await api.businessTypes.isActive(d.businessType))) {
    return {
      errors: { businessType: msg("businessTypeFromList") },
      values: keepValues(raw),
    };
  }
  const result = await api.owners.signUp({
    email: d.email,
    password: d.password,
    fullName: d.fullName,
    phone: d.phone,
    businessName: d.businessName,
    businessType: d.businessType,
    location: location.data,
    locale: await ownerLocale(),
  });
  if (!result.ok) {
    return {
      errors: {
        form: AUTH_ERRORS[result.code] ?? msg("signupFailed"),
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
  if (!email) return { error: msg("missingEmail") };
  const result = await serverApi().owners.resendSignupEmail(email);
  if (!result.ok) {
    return { error: AUTH_ERRORS[result.code] ?? msg("resendFailed") };
  }
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
  const api = serverApi();
  if (!(await api.businessTypes.isActive(d.businessType))) {
    return {
      errors: { businessType: msg("businessTypeFromList") },
      values: keepValues(raw),
    };
  }
  try {
    await api.owners.completeProfile({
      fullName: d.fullName,
      phone: d.phone,
      businessName: d.businessName,
      businessType: d.businessType,
      location: location.data,
      locale: await ownerLocale(),
    });
  } catch (e) {
    if (!isDataError(e)) throw e;
    if (e.code === "not_authenticated") redirect("/login");
    if (e.code === "profile_already_completed") redirect("/pending");
    return {
      errors:
        e.code === "invalid_location"
          ? { location: msg("locationOnMap") }
          : { form: msg("detailsSaveFailed") },
      values: keepValues(raw),
    };
  }
  kickEmailDispatch(); // register_new_user
  redirect("/pending");
}
