"use client";

import { argbFromHex, hexFromArgb, themeFromSourceColor } from "@material/material-color-utilities";
import { getCountries } from "libphonenumber-js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { SelectField, TextField } from "@/components/auth/fields";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import {
  BRAND_PRESETS,
  CAFE_LOCALES,
  CURRENCIES,
  CURRENCY_BY_COUNTRY,
  DEFAULT_BRAND_SEED,
  FALLBACK_CURRENCY,
  FALLBACK_TIMEZONE,
  TIMEZONE_BY_COUNTRY,
} from "@/config/cafe-defaults";
import { cafeHost, localSlugProblem, normalizeSlug, SLUG_MESSAGES } from "@/lib/cafes/slug";
import type { OnboardingState, SlugCheck } from "@/lib/data/services/onboarding";
import { WIZARD_STEPS, type WizardDraft, type WizardStep } from "@/lib/onboarding/schema";
import {
  checkSlugAction,
  createCafeAction,
  goToStepAction,
  saveStepAction,
  type StepResult,
} from "./actions";

type Props = {
  initial: OnboardingState;
  rootDomain: string;
  termsVersion: string;
  dpaVersion: string;
};

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRY_OPTIONS = getCountries()
  .map((c) => ({ value: c, label: COUNTRY_NAMES.of(c) ?? c }))
  .sort((a, b) => a.label.localeCompare(b.label));
const TIMEZONE_OPTIONS = Intl.supportedValuesOf("timeZone").map((tz) => ({
  value: tz,
  label: tz.replaceAll("_", " "),
}));
const CURRENCY_NAMES = new Intl.DisplayNames(["en"], { type: "currency" });
const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({
  value: c,
  label: `${c} — ${CURRENCY_NAMES.of(c) ?? c}`,
}));

export function OnboardingWizard({ initial, rootDomain, termsVersion, dpaVersion }: Props) {
  const toast = useToast();
  const [step, setStep] = useState<WizardStep>(
    Math.min(Math.max(initial.step, 1), 5) as WizardStep,
  );
  // Draft = saved draft over registration prefill.
  const [draft, setDraft] = useState<WizardDraft>(() => {
    const p = initial.prefill;
    const cc = initial.draft.country_code ?? p.country_code;
    return {
      name: p.name,
      country_code: cc,
      city: p.city,
      address: p.address,
      currency: cc ? CURRENCY_BY_COUNTRY[cc] : undefined,
      timezone: cc ? TIMEZONE_BY_COUNTRY[cc] : undefined,
      locale: (p.locale as WizardDraft["locale"]) ?? "en",
      slug: initial.reservation?.slug,
      seed: DEFAULT_BRAND_SEED,
      ...initial.draft,
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const top = useRef<HTMLDivElement>(null);

  function show(next: WizardStep) {
    setStep(next);
    setErrors({});
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitStep(s: 1 | 2 | 3 | 4, input: Record<string, unknown>) {
    startTransition(async () => {
      const r: StepResult = await saveStepAction(s, input);
      if (!r.ok) {
        setErrors(r.errors);
        return;
      }
      setDraft((d) => ({ ...d, ...r.draft }));
      show((s + 1) as WizardStep);
    });
  }

  function back(to: WizardStep) {
    show(to);
    void goToStepAction(to);
  }

  function create() {
    startTransition(async () => {
      const r = await createCafeAction(); // redirects on success
      if (r && !r.ok) {
        setErrors(r.errors);
        if (r.step) show(r.step as WizardStep);
        toast.show({
          variant: "error",
          title: r.errors.slug
            ? "This café address is no longer available"
            : "Your café could not be created",
          description: r.errors.slug ?? r.errors.form ?? "Check the highlighted step.",
        });
      }
    });
  }

  return (
    <div ref={top} className="mx-auto flex w-full max-w-3xl scroll-mt-xl flex-col gap-lg">
      <Stepper current={step} onGo={(s) => s < step && back(s)} />
      <section className="rounded-xl bg-surface-container-lowest p-lg shadow-card-warm sm:p-xl">
        {step === 1 ? (
          <DetailsStep
            draft={draft}
            errors={errors}
            pending={pending}
            onSubmit={(v) => submitStep(1, v)}
          />
        ) : step === 2 ? (
          <AddressStep
            draft={draft}
            errors={errors}
            pending={pending}
            rootDomain={rootDomain}
            onBack={() => back(1)}
            onSubmit={(v) => submitStep(2, v)}
          />
        ) : step === 3 ? (
          <LookStep
            draft={draft}
            rootDomain={rootDomain}
            pending={pending}
            onBack={() => back(2)}
            onSubmit={(v) => submitStep(3, v)}
          />
        ) : step === 4 ? (
          <AgreementStep
            draft={draft}
            errors={errors}
            pending={pending}
            termsVersion={termsVersion}
            dpaVersion={dpaVersion}
            onBack={() => back(3)}
            onSubmit={(v) => submitStep(4, v)}
          />
        ) : (
          <ReviewStep
            draft={draft}
            errors={errors}
            pending={pending}
            rootDomain={rootDomain}
            onEdit={back}
            onCreate={create}
          />
        )}
      </section>
    </div>
  );
}

/* ── Stepper ──────────────────────────────────────────────────────────────── */

function Stepper({ current, onGo }: { current: WizardStep; onGo: (s: WizardStep) => void }) {
  return (
    <ol className="flex items-center gap-xs" aria-label="Onboarding progress">
      {WIZARD_STEPS.map((s, i) => {
        const done = s.step < current;
        const active = s.step === current;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-xs">
            <button
              type="button"
              disabled={!done}
              onClick={() => onGo(s.step)}
              aria-current={active ? "step" : undefined}
              className="flex min-w-0 items-center gap-xs text-start disabled:cursor-default"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-body-sm font-bold ${
                  active
                    ? "bg-primary text-on-primary"
                    : done
                      ? "bg-success text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {done ? <Icon name="check" className="text-icon-md" /> : s.step}
              </span>
              <span
                className={`hidden truncate text-body-sm font-semibold md:block ${
                  active ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                {s.label}
              </span>
            </button>
            {i < WIZARD_STEPS.length - 1 ? (
              <span
                className={`h-0.5 flex-1 rounded-full ${done ? "bg-success" : "bg-surface-container-high"}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-lg">
      <h1 className="text-headline-md text-primary">{title}</h1>
      <p className="mt-xs text-on-surface-variant">{description}</p>
    </div>
  );
}

function Actions({
  pending,
  onBack,
  nextLabel = "Next",
  nextIcon = "arrow_forward",
  disabled = false,
}: {
  pending: boolean;
  onBack?: () => void;
  nextLabel?: string;
  nextIcon?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-lg flex flex-col-reverse gap-sm sm:flex-row sm:justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="inline-flex items-center justify-center gap-xs rounded-xl px-lg py-sm font-semibold text-on-surface-variant hover:bg-surface-container"
        >
          <Icon name="arrow_back" className="text-icon-lg" flipRtl />
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="submit"
        disabled={pending || disabled}
        className="inline-flex items-center justify-center gap-xs rounded-xl bg-primary px-xl py-sm font-semibold text-on-primary shadow-button-warm transition-all hover:bg-primary-container disabled:opacity-60"
      >
        {pending ? <Icon name="progress_activity" className="animate-spin text-icon-lg" /> : null}
        {nextLabel}
        {pending ? null : <Icon name={nextIcon} className="text-icon-lg" flipRtl />}
      </button>
    </div>
  );
}

const formValues = (e: FormEvent<HTMLFormElement>) =>
  Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

/* ── 1 · Café details ─────────────────────────────────────────────────────── */

function DetailsStep({
  draft,
  errors,
  pending,
  onSubmit,
}: {
  draft: WizardDraft;
  errors: Record<string, string>;
  pending: boolean;
  onSubmit: (v: Record<string, string>) => void;
}) {
  const [country, setCountry] = useState(draft.country_code ?? "");
  // Country change → suggest its currency + time zone (re-mounts those selects).
  const currency = country === draft.country_code ? draft.currency : CURRENCY_BY_COUNTRY[country];
  const timezone = country === draft.country_code ? draft.timezone : TIMEZONE_BY_COUNTRY[country];
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formValues(e));
      }}
    >
      <StepHeader
        title="Your café"
        description="These details appear on your menu. We filled them in from your registration — check and adjust."
      />
      <FormAlert message={errors.form} />
      <div className="flex flex-col gap-md">
        <TextField
          id="name"
          label="Café name"
          icon="storefront"
          required
          defaultValue={draft.name}
          error={errors.name}
        />
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <SelectField
            id="country_code"
            label="Country"
            icon="public"
            placeholder="Select country"
            options={COUNTRY_OPTIONS}
            required
            defaultValue={draft.country_code}
            onChange={(e) => setCountry(e.target.value)}
            error={errors.country_code}
          />
          <TextField
            id="city"
            label="City"
            icon="location_city"
            required
            defaultValue={draft.city}
            error={errors.city}
          />
        </div>
        <TextField
          id="address"
          label="Address"
          icon="signpost"
          defaultValue={draft.address}
          error={errors.address}
        />
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <SelectField
            key={`cur-${country}`}
            id="currency"
            label="Currency"
            icon="payments"
            placeholder="Select currency"
            options={CURRENCY_OPTIONS}
            required
            defaultValue={currency ?? FALLBACK_CURRENCY}
            error={errors.currency}
          />
          <SelectField
            key={`tz-${country}`}
            id="timezone"
            label="Time zone"
            icon="schedule"
            placeholder="Select time zone"
            options={TIMEZONE_OPTIONS}
            required
            defaultValue={timezone ?? FALLBACK_TIMEZONE}
            error={errors.timezone}
          />
        </div>
        <fieldset>
          <legend className="mb-xs text-body-sm font-semibold text-on-surface">
            Default menu language
          </legend>
          <div className="flex flex-wrap gap-sm">
            {CAFE_LOCALES.map((l) => (
              <label
                key={l.value}
                className="flex cursor-pointer items-center gap-xs rounded-lg border border-outline-variant px-md py-sm has-checked:border-primary has-checked:bg-secondary-container"
              >
                <input
                  type="radio"
                  name="locale"
                  value={l.value}
                  defaultChecked={(draft.locale ?? "en") === l.value}
                  className="accent-primary"
                />
                <span className="text-body-sm font-semibold text-on-surface">{l.label}</span>
              </label>
            ))}
          </div>
          {errors.locale ? <p className="mt-1 text-body-xs text-error">{errors.locale}</p> : null}
        </fieldset>
      </div>
      <Actions pending={pending} />
    </form>
  );
}

/* ── 2 · Café address (slug) ─────────────────────────────────────────────── */

function AddressStep({
  draft,
  errors,
  pending,
  rootDomain,
  onBack,
  onSubmit,
}: {
  draft: WizardDraft;
  errors: Record<string, string>;
  pending: boolean;
  rootDomain: string;
  onBack: () => void;
  onSubmit: (v: Record<string, string>) => void;
}) {
  const [value, setValue] = useState(draft.slug ?? normalizeSlug(draft.name ?? ""));
  // Server answer for one specific address (stale answers are ignored by comparing slugs).
  const [result, setResult] = useState<{ slug: string; check: SlugCheck | null } | null>(null);
  const normalized = normalizeSlug(value);
  const local = localSlugProblem(normalized);
  const needsServer = Boolean(normalized) && !local;
  const check = needsServer && result?.slug === normalized ? result.check : null;
  const checking = needsServer && result?.slug !== normalized;

  useEffect(() => {
    if (!needsServer) return;
    let alive = true;
    const t = setTimeout(async () => {
      const r = await checkSlugAction(normalized).catch(() => null);
      if (alive) setResult({ slug: normalized, check: r });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [normalized, needsServer]);

  const problem =
    errors.slug ??
    (local
      ? SLUG_MESSAGES[local]
      : check && !check.available
        ? SLUG_MESSAGES[check.reason]
        : undefined);
  const available = !local && check?.available === true && check.normalized === normalized;
  const suggestions = check && !check.available ? check.suggestions : [];

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ slug: normalized });
      }}
    >
      <StepHeader
        title="Your café address"
        description="Customers open your menu at this address. Use your café name — short and easy to type."
      />
      <div className="flex flex-col gap-sm">
        <div className="relative">
          <div
            className={`flex items-stretch overflow-hidden rounded-lg border bg-surface-container-lowest focus-within:ring-1 ${
              problem
                ? "border-error focus-within:ring-error"
                : available
                  ? "border-success focus-within:ring-success"
                  : "border-outline-variant focus-within:border-primary focus-within:ring-primary"
            }`}
          >
            <span className="flex items-center ps-md text-on-surface-variant">
              <Icon name="language" className="text-icon-lg" />
            </span>
            <input
              id="slug"
              name="slug"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={problem ? true : undefined}
              aria-describedby="slug-status"
              placeholder="your-cafe"
              className="min-w-0 flex-1 bg-transparent px-sm py-3.5 text-body-md font-semibold text-on-surface placeholder:font-normal placeholder:text-outline focus:outline-none"
            />
            <span className="flex items-center bg-surface-container px-md text-body-sm text-on-surface-variant">
              .{rootDomain}
            </span>
          </div>
        </div>
        <p
          id="slug-status"
          aria-live="polite"
          className="flex min-h-6 items-center gap-xs text-body-sm"
        >
          {checking ? (
            <span className="flex items-center gap-xs text-on-surface-variant">
              <Icon name="progress_activity" className="animate-spin text-icon-md" /> Checking…
            </span>
          ) : problem ? (
            <span className="flex items-center gap-xs text-error">
              <Icon name="error" className="text-icon-md" /> {problem}
            </span>
          ) : available ? (
            <span className="flex items-center gap-xs text-success">
              <Icon name="check_circle" filled className="text-icon-md" />{" "}
              {cafeHost(normalized, rootDomain)} is available
            </span>
          ) : null}
        </p>
        {value && normalized !== value.trim() ? (
          <p className="text-caption text-on-surface-variant">
            Will be saved as <strong className="text-on-surface">{normalized || "—"}</strong>
          </p>
        ) : null}
        {suggestions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-xs">
            <span className="text-body-sm text-on-surface-variant">Try:</span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setValue(s)}
                className="rounded-full bg-secondary-container px-md py-xs text-body-sm font-semibold text-on-secondary-container hover:bg-secondary-fixed-dim"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        <p className="mt-sm flex items-start gap-xs rounded-lg bg-surface-container-low p-sm text-caption text-on-surface-variant">
          <Icon name="info" className="text-icon-sm" />
          We keep this address for you for 30 minutes while you finish. Your printed QR codes never
          change, even if the address changes later.
        </p>
      </div>
      <Actions pending={pending} onBack={onBack} disabled={!available} />
    </form>
  );
}

/* ── 3 · Look (brand colour + live preview) ───────────────────────────────── */

function usePalette(seed: string) {
  return useMemo(() => {
    const scheme = themeFromSourceColor(argbFromHex(seed)).schemes.light;
    return {
      primary: hexFromArgb(scheme.primary),
      onPrimary: hexFromArgb(scheme.onPrimary),
      container: hexFromArgb(scheme.primaryContainer),
      onContainer: hexFromArgb(scheme.onPrimaryContainer),
      surface: hexFromArgb(scheme.surface),
      onSurface: hexFromArgb(scheme.onSurface),
      variant: hexFromArgb(scheme.surfaceVariant),
      onVariant: hexFromArgb(scheme.onSurfaceVariant),
    };
  }, [seed]);
}

function LookStep({
  draft,
  rootDomain,
  pending,
  onBack,
  onSubmit,
}: {
  draft: WizardDraft;
  rootDomain: string;
  pending: boolean;
  onBack: () => void;
  onSubmit: (v: Record<string, string>) => void;
}) {
  const [seed, setSeed] = useState(draft.seed ?? DEFAULT_BRAND_SEED);
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ seed });
      }}
    >
      <StepHeader
        title="Your café's colour"
        description="We build your menu's colours from one brand colour. You can change it later; logo upload comes with your dashboard settings."
      />
      <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
        <div className="flex flex-col gap-md">
          <div className="grid grid-cols-4 gap-sm">
            {BRAND_PRESETS.map((p) => (
              <button
                key={p.seed}
                type="button"
                onClick={() => setSeed(p.seed)}
                aria-pressed={seed === p.seed}
                className={`flex flex-col items-center gap-xs rounded-lg p-xs ${seed === p.seed ? "bg-secondary-container" : "hover:bg-surface-container-low"}`}
              >
                <span
                  className={`h-10 w-10 rounded-full shadow-sm ${seed === p.seed ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{ backgroundColor: p.seed }}
                />
                <span className="text-caption text-on-surface-variant">{p.name}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-sm rounded-lg border border-outline-variant p-sm">
            <input
              type="color"
              value={seed}
              onChange={(e) => setSeed(e.target.value.toLowerCase())}
              className="h-10 w-14 cursor-pointer rounded border-0 bg-transparent"
              aria-label="Custom colour"
            />
            <span>
              <span className="block text-body-sm font-semibold text-on-surface">
                Custom colour
              </span>
              <span className="block font-mono text-caption text-on-surface-variant">{seed}</span>
            </span>
          </label>
        </div>
        <MenuPreview
          name={draft.name ?? "Your café"}
          host={cafeHost(draft.slug ?? "", rootDomain)}
          seed={seed}
          currency={draft.currency ?? FALLBACK_CURRENCY}
        />
      </div>
      <Actions pending={pending} onBack={onBack} />
    </form>
  );
}

function MenuPreview({
  name,
  host,
  seed,
  currency,
}: {
  name: string;
  host: string;
  seed: string;
  currency: string;
}) {
  const c = usePalette(seed);
  const price = new Intl.NumberFormat("en", { style: "currency", currency }).format;
  return (
    <div
      aria-label="Menu preview"
      className="mx-auto w-full max-w-64 overflow-hidden rounded-2xl border-4 border-inverse-surface shadow-card-warm"
      style={{ backgroundColor: c.surface }}
    >
      <div className="px-md pt-md pb-lg" style={{ backgroundColor: c.primary, color: c.onPrimary }}>
        <p className="text-caption opacity-80">{host}</p>
        <p className="text-headline-md font-bold">{name}</p>
      </div>
      <div className="-mt-sm flex gap-xs px-md">
        {["Coffee", "Tea", "Pastries"].map((cat, i) => (
          <span
            key={cat}
            className="rounded-full px-sm py-xs text-caption font-semibold shadow-sm"
            style={
              i === 0
                ? { backgroundColor: c.container, color: c.onContainer }
                : { backgroundColor: c.variant, color: c.onVariant }
            }
          >
            {cat}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-sm p-md">
        {[
          ["Espresso", 4.5],
          ["Cappuccino", 6],
        ].map(([item, p]) => (
          <div
            key={item as string}
            className="flex items-center justify-between rounded-lg p-sm"
            style={{ backgroundColor: c.variant, color: c.onSurface }}
          >
            <span>
              <span className="block text-body-sm font-semibold">{item}</span>
              <span className="block text-caption" style={{ color: c.onVariant }}>
                {price(p as number)}
              </span>
            </span>
            <span
              className="rounded-lg px-sm py-xs text-caption font-bold"
              style={{ backgroundColor: c.primary, color: c.onPrimary }}
            >
              Add
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 4 · Agreement ────────────────────────────────────────────────────────── */

function AgreementStep({
  draft,
  errors,
  pending,
  termsVersion,
  dpaVersion,
  onBack,
  onSubmit,
}: {
  draft: WizardDraft;
  errors: Record<string, string>;
  pending: boolean;
  termsVersion: string;
  dpaVersion: string;
  onBack: () => void;
  onSubmit: (v: Record<string, unknown>) => void;
}) {
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({ terms: f.get("terms") === "on", dpa: f.get("dpa") === "on" });
      }}
    >
      <StepHeader
        title="Agreements"
        description="Your café's data (menu, orders, customers) belongs to your café. Serbi processes it for you under these agreements."
      />
      <div className="flex flex-col gap-sm">
        {[
          {
            name: "terms",
            href: "/terms",
            label: "Terms of Service",
            version: termsVersion,
            error: errors.terms,
          },
          {
            name: "dpa",
            href: "/dpa",
            label: "Data Processing Agreement",
            version: dpaVersion,
            error: errors.dpa,
          },
        ].map((a) => (
          <div key={a.name}>
            <label
              className={`flex cursor-pointer items-start gap-sm rounded-lg border p-md ${a.error ? "border-error" : "border-outline-variant"} has-checked:border-primary has-checked:bg-secondary-container/40`}
            >
              <input
                type="checkbox"
                name={a.name}
                defaultChecked={Boolean(draft[a.name as "terms" | "dpa"])}
                className="mt-1 h-5 w-5 accent-primary"
              />
              <span>
                <span className="block font-semibold text-on-surface">
                  I accept the{" "}
                  <Link href={a.href} target="_blank" className="text-primary underline">
                    {a.label}
                  </Link>
                </span>
                <span className="block text-caption text-on-surface-variant">
                  Version {a.version}
                </span>
              </span>
            </label>
            {a.error ? <p className="mt-1 ps-3 text-body-xs text-error">{a.error}</p> : null}
          </div>
        ))}
      </div>
      <Actions pending={pending} onBack={onBack} />
    </form>
  );
}

/* ── 5 · Review & create ──────────────────────────────────────────────────── */

function ReviewStep({
  draft,
  errors,
  pending,
  rootDomain,
  onEdit,
  onCreate,
}: {
  draft: WizardDraft;
  errors: Record<string, string>;
  pending: boolean;
  rootDomain: string;
  onEdit: (s: WizardStep) => void;
  onCreate: () => void;
}) {
  const rows: { step: WizardStep; label: string; value: string }[] = [
    { step: 1, label: "Café name", value: draft.name ?? "—" },
    {
      step: 1,
      label: "Location",
      value:
        [draft.address, draft.city, draft.country_code && COUNTRY_NAMES.of(draft.country_code)]
          .filter(Boolean)
          .join(", ") || "—",
    },
    {
      step: 1,
      label: "Currency · time zone · language",
      value: `${draft.currency ?? "—"} · ${draft.timezone ?? "—"} · ${CAFE_LOCALES.find((l) => l.value === draft.locale)?.label ?? "—"}`,
    },
    { step: 2, label: "Address", value: draft.slug ? cafeHost(draft.slug, rootDomain) : "—" },
    { step: 3, label: "Brand colour", value: draft.seed ?? "—" },
    { step: 4, label: "Agreements", value: draft.terms && draft.dpa ? "Accepted" : "Not accepted" },
  ];
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onCreate();
      }}
    >
      <StepHeader
        title="Review"
        description="Check everything, then create your café. You can change most of it later in your dashboard."
      />
      <FormAlert message={errors.form} />
      <dl className="divide-y divide-surface-container-high rounded-lg border border-surface-container-high">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-md px-md py-sm">
            <dt className="w-2/5 shrink-0 text-body-sm text-on-surface-variant">{r.label}</dt>
            <dd className="flex min-w-0 flex-1 items-center gap-xs text-body-sm font-semibold text-on-surface">
              {r.step === 3 && draft.seed ? (
                <span
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: draft.seed }}
                />
              ) : null}
              <span className="truncate">{r.value}</span>
            </dd>
            <button
              type="button"
              onClick={() => onEdit(r.step)}
              className="shrink-0 rounded-lg px-sm py-xs text-body-sm font-semibold text-primary hover:bg-secondary-container"
            >
              Edit
            </button>
          </div>
        ))}
      </dl>
      <Actions
        pending={pending}
        onBack={() => onEdit(4)}
        nextLabel="Create my café"
        nextIcon="rocket_launch"
      />
    </form>
  );
}
