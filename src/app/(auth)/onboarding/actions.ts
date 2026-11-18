"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";
import { DPA_VERSION, TERMS_VERSION } from "@/config/legal";
import { SLUG_MESSAGES, type SlugProblem } from "@/lib/cafes/slug";
import { requireOwnerStage } from "@/lib/auth/guards";
import { isDataError } from "@/lib/data/errors";
import { kickEmailDispatch } from "@/lib/data/kick-email";
import { serverApi } from "@/lib/data/server-api";
import type { SlugCheck } from "@/lib/data/services/onboarding";
import {
  addressSchema,
  agreementSchema,
  createCafeSchema,
  detailsSchema,
  lookSchema,
  type WizardDraft,
} from "@/lib/onboarding/schema";

const ONBOARDING = ["approved", "onboarding"] as const;

export type StepResult =
  { ok: true; draft: WizardDraft } | { ok: false; errors: Record<string, string>; step?: number };

function issues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

/** "slug_taken" (raised by the DB) → the message for that problem. */
function slugErrorMessage(e: unknown): string | null {
  if (!isDataError(e)) return null;
  const m = /slug_(format|reserved|blocked|taken|held)/.exec(
    String((e.cause as Error)?.message ?? ""),
  );
  return m ? SLUG_MESSAGES[m[1] as SlugProblem] : null;
}

/** Live availability check (debounced by the client). */
export async function checkSlugAction(slug: string): Promise<SlugCheck> {
  await requireOwnerStage(ONBOARDING);
  return serverApi().onboarding.checkSlug(String(slug).slice(0, 80));
}

/** Validate + save one step and move to the next one. */
export async function saveStepAction(step: 1 | 2 | 3 | 4, input: unknown): Promise<StepResult> {
  await requireOwnerStage(ONBOARDING);
  const api = serverApi();
  const schema = { 1: detailsSchema, 2: addressSchema, 3: lookSchema, 4: agreementSchema }[step];
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: issues(parsed.error) };
  const data = parsed.data as WizardDraft;

  if (step === 2) {
    // Hold the address for 30 minutes while the owner finishes the wizard.
    try {
      await api.onboarding.reserveSlug(data.slug!);
    } catch (e) {
      const message = slugErrorMessage(e);
      if (!message) throw e;
      return { ok: false, errors: { slug: message } };
    }
  }

  await api.onboarding.save(step + 1, data);
  return { ok: true, draft: data };
}

/** Go back to a step (keeps the draft). */
export async function goToStepAction(step: number): Promise<void> {
  await requireOwnerStage(ONBOARDING);
  await serverApi().onboarding.save(Math.min(Math.max(step, 1), 5), {});
}

/** Review → create the café, then show the Done screen. */
export async function createCafeAction(): Promise<StepResult> {
  await requireOwnerStage(ONBOARDING);
  const api = serverApi();
  const { draft } = await api.onboarding.state();
  const parsed = createCafeSchema.safeParse(draft);
  if (!parsed.success) {
    const errors = issues(parsed.error);
    const firstStep =
      errors.name ||
      errors.country_code ||
      errors.city ||
      errors.currency ||
      errors.timezone ||
      errors.locale
        ? 1
        : errors.slug
          ? 2
          : errors.seed
            ? 3
            : 4;
    return { ok: false, errors, step: firstStep };
  }
  const d = parsed.data;
  try {
    await api.onboarding.provision({
      name: d.name,
      slug: d.slug,
      countryCode: d.country_code,
      city: d.city,
      address: d.address || undefined,
      currency: d.currency,
      timezone: d.timezone,
      locale: d.locale,
      seed: d.seed,
      termsVersion: TERMS_VERSION,
      dpaVersion: DPA_VERSION,
    });
  } catch (e) {
    const message = slugErrorMessage(e);
    if (message) return { ok: false, errors: { slug: message }, step: 2 };
    if (isDataError(e))
      return { ok: false, errors: { form: "Could not create your café. Please try again." } };
    throw e;
  }
  kickEmailDispatch(); // cafe_created → "Your café is ready"
  redirect("/onboarding?done=1");
}
