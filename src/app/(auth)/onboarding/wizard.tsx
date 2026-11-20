"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useMsg } from "@/i18n/use-msg";
import { FormAlert } from "@/components/auth/form-alert";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { countryLabel, type CafeFieldOptions } from "@/config/cafe-options";
import { BrandColourPicker } from "@/components/cafe/brand-colour-picker";
import { MenuPreview } from "@/components/cafe/menu-preview";
import { CafeContactFields, CafeDetailsFields } from "@/components/cafe/cafe-fields";
import {
  CAFE_LOCALES,
  CURRENCY_BY_COUNTRY,
  DEFAULT_BRAND_SEED,
  FALLBACK_CURRENCY,
  TIMEZONE_BY_COUNTRY,
} from "@/config/cafe-defaults";
import { cafeHost, localSlugProblem, normalizeSlug, SLUG_MESSAGES } from "@/lib/cafes/slug";
import type { OnboardingState, SlugCheck } from "@/lib/data/services/onboarding";
import {
  REVIEW_STEP,
  WIZARD_STEPS,
  type WizardDraft,
  type WizardStep,
} from "@/lib/onboarding/schema";
import { socialHandle } from "@/lib/cafes/contact";
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
  /** Select options built on the server (identical labels on server + client). */
  options: CafeFieldOptions;
};

export function OnboardingWizard({
  initial,
  rootDomain,
  termsVersion,
  dpaVersion,
  options,
}: Props) {
  const m = useMsg();
  const t = useTranslations("onboarding");
  const toast = useToast();
  const [step, setStep] = useState<WizardStep>(
    Math.min(Math.max(initial.step, 1), REVIEW_STEP) as WizardStep,
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
      phone: p.phone,
      email: p.email,
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

  function submitStep(s: 1 | 2 | 3 | 4 | 5, input: Record<string, unknown>) {
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
          title: r.errors.slug ? t("addressGone") : t("createFailed"),
          description: m(r.errors.slug ?? r.errors.form ?? "") || t("checkStep"),
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
            options={options}
            draft={draft}
            errors={errors}
            pending={pending}
            onSubmit={(v) => submitStep(1, v)}
          />
        ) : step === 2 ? (
          <ContactStep
            draft={draft}
            errors={errors}
            pending={pending}
            onBack={() => back(1)}
            onSubmit={(v) => submitStep(2, v)}
          />
        ) : step === 3 ? (
          <AddressStep
            draft={draft}
            errors={errors}
            pending={pending}
            rootDomain={rootDomain}
            onBack={() => back(2)}
            onSubmit={(v) => submitStep(3, v)}
          />
        ) : step === 4 ? (
          <LookStep
            draft={draft}
            rootDomain={rootDomain}
            pending={pending}
            onBack={() => back(3)}
            onSubmit={(v) => submitStep(4, v)}
          />
        ) : step === 5 ? (
          <AgreementStep
            draft={draft}
            errors={errors}
            pending={pending}
            termsVersion={termsVersion}
            dpaVersion={dpaVersion}
            onBack={() => back(4)}
            onSubmit={(v) => submitStep(5, v)}
          />
        ) : (
          <ReviewStep
            options={options}
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
  const t = useTranslations("onboarding");
  return (
    <ol className="flex items-center gap-xs" aria-label={t("progress")}>
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
                {t(`steps.${s.key}`)}
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
  nextLabel,
  nextIcon = "arrow_forward",
  disabled = false,
}: {
  pending: boolean;
  onBack?: () => void;
  nextLabel?: string;
  nextIcon?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("onboarding");
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
          {t("back")}
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
        {nextLabel ?? t("next_")}
        {pending ? null : <Icon name={nextIcon} className="text-icon-lg" flipRtl />}
      </button>
    </div>
  );
}

const formValues = (e: FormEvent<HTMLFormElement>) =>
  Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

/* ── 1 · Café details ─────────────────────────────────────────────────────── */

function DetailsStep({
  options,
  draft,
  errors,
  pending,
  onSubmit,
}: {
  options: CafeFieldOptions;
  draft: WizardDraft;
  errors: Record<string, string>;
  pending: boolean;
  onSubmit: (v: Record<string, string>) => void;
}) {
  const t = useTranslations("onboarding");
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formValues(e));
      }}
    >
      <StepHeader title={t("detailsTitle")} description={t("detailsBody")} />
      <FormAlert message={errors.form} />
      <CafeDetailsFields values={draft} errors={errors} options={options} />
      <Actions pending={pending} />
    </form>
  );
}

/* ── 2 · Contact ──────────────────────────────────────────────────────────── */

function ContactStep({
  draft,
  errors,
  pending,
  onBack,
  onSubmit,
}: {
  draft: WizardDraft;
  errors: Record<string, string>;
  pending: boolean;
  onBack: () => void;
  onSubmit: (v: Record<string, string>) => void;
}) {
  const t = useTranslations("onboarding");
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formValues(e));
      }}
    >
      <StepHeader title={t("contactTitle")} description={t("contactBody")} />
      <FormAlert message={errors.form} />
      <CafeContactFields values={draft} errors={errors} />
      <Actions pending={pending} onBack={onBack} />
    </form>
  );
}

/* ── 3 · Café address (slug) ─────────────────────────────────────────────── */

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
  const m = useMsg();
  const t = useTranslations("onboarding");
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
      <StepHeader title={t("addressTitle")} description={t("addressBody")} />
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
              placeholder={t("slugPlaceholder")}
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
              <Icon name="progress_activity" className="animate-spin text-icon-md" />{" "}
              {t("checking")}
            </span>
          ) : problem ? (
            <span className="flex items-center gap-xs text-error">
              <Icon name="error" className="text-icon-md" /> {m(problem)}
            </span>
          ) : available ? (
            <span className="flex items-center gap-xs text-success">
              <Icon name="check_circle" filled className="text-icon-md" />{" "}
              {t("available", { host: cafeHost(normalized, rootDomain) })}
            </span>
          ) : null}
        </p>
        {value && normalized !== value.trim() ? (
          <p className="text-caption text-on-surface-variant">
            {t.rich("savedAs", {
              slug: normalized || "—",
              b: (c) => <strong className="text-on-surface">{c}</strong>,
            })}
          </p>
        ) : null}
        {suggestions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-xs">
            <span className="text-body-sm text-on-surface-variant">{t("try")}</span>
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
          {t("holdNote")}
        </p>
      </div>
      <Actions pending={pending} onBack={onBack} disabled={!available} />
    </form>
  );
}

/* ── 4 · Look (brand colour + live preview) ───────────────────────────────── */

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
  const t = useTranslations("onboarding");
  const [seed, setSeed] = useState(draft.seed ?? DEFAULT_BRAND_SEED);
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ seed });
      }}
    >
      <StepHeader title={t("lookTitle")} description={t("lookBody")} />
      <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
        <BrandColourPicker value={seed} onChange={setSeed} />
        <MenuPreview
          name={draft.name ?? t("yourCafe")}
          host={cafeHost(draft.slug ?? "", rootDomain)}
          seed={seed}
          currency={draft.currency ?? FALLBACK_CURRENCY}
        />
      </div>
      <Actions pending={pending} onBack={onBack} />
    </form>
  );
}

/* ── 5 · Agreement ────────────────────────────────────────────────────────── */

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
  const t = useTranslations("onboarding");
  const m = useMsg();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({ terms: f.get("terms") === "on", dpa: f.get("dpa") === "on" });
      }}
    >
      <StepHeader title={t("agreementsTitle")} description={t("agreementsBody")} />
      <div className="flex flex-col gap-sm">
        {[
          {
            name: "terms",
            href: "/terms",
            label: t("termsName"),
            version: termsVersion,
            error: errors.terms,
          },
          {
            name: "dpa",
            href: "/dpa",
            label: t("dpaName"),
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
                  {t.rich("accept", {
                    name: a.label,
                    link: (c) => (
                      <Link href={a.href} target="_blank" className="text-primary underline">
                        {c}
                      </Link>
                    ),
                  })}
                </span>
                <span className="block text-caption text-on-surface-variant">
                  {t("version", { version: a.version })}
                </span>
              </span>
            </label>
            {a.error ? <p className="mt-1 ps-3 text-body-xs text-error">{m(a.error)}</p> : null}
          </div>
        ))}
      </div>
      <Actions pending={pending} onBack={onBack} />
    </form>
  );
}

/* ── 6 · Review & create ──────────────────────────────────────────────────── */

function ReviewStep({
  options,
  draft,
  errors,
  pending,
  rootDomain,
  onEdit,
  onCreate,
}: {
  options: CafeFieldOptions;
  draft: WizardDraft;
  errors: Record<string, string>;
  pending: boolean;
  rootDomain: string;
  onEdit: (s: WizardStep) => void;
  onCreate: () => void;
}) {
  const t = useTranslations("onboarding");
  const rows: { step: WizardStep; label: string; value: string }[] = [
    { step: 1, label: t("rows.name"), value: draft.name ?? "—" },
    {
      step: 1,
      label: t("rows.location"),
      value:
        [draft.address, draft.city, draft.country_code && countryLabel(options, draft.country_code)]
          .filter(Boolean)
          .join(", ") || "—",
    },
    {
      step: 1,
      label: t("rows.settings"),
      value: `${draft.currency ?? "—"} · ${draft.timezone ?? "—"} · ${CAFE_LOCALES.find((l) => l.value === draft.locale)?.label ?? "—"}`,
    },
    {
      step: 2,
      label: t("rows.contact"),
      value: [draft.phone, draft.email].filter(Boolean).join(" · ") || "—",
    },
    {
      step: 2,
      label: t("rows.social"),
      value:
        [
          draft.facebook && `Facebook ${socialHandle(draft.facebook)}`,
          draft.instagram && `Instagram ${socialHandle(draft.instagram)}`,
        ]
          .filter(Boolean)
          .join(" · ") || t("none"),
    },
    {
      step: 3,
      label: t("rows.address"),
      value: draft.slug ? cafeHost(draft.slug, rootDomain) : "—",
    },
    { step: 4, label: t("rows.colour"), value: draft.seed ?? "—" },
    {
      step: 5,
      label: t("rows.agreements"),
      value: draft.terms && draft.dpa ? t("accepted") : t("notAccepted"),
    },
  ];
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onCreate();
      }}
    >
      <StepHeader title={t("reviewTitle")} description={t("reviewBody")} />
      <FormAlert message={errors.form} />
      <dl className="divide-y divide-surface-container-high rounded-lg border border-surface-container-high">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-md px-md py-sm">
            <dt className="w-2/5 shrink-0 text-body-sm text-on-surface-variant">{r.label}</dt>
            <dd className="flex min-w-0 flex-1 items-center gap-xs text-body-sm font-semibold text-on-surface">
              {r.step === 4 && draft.seed ? (
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
              {t("edit")}
            </button>
          </div>
        ))}
      </dl>
      <Actions
        pending={pending}
        onBack={() => onEdit(5)}
        nextLabel={t("create")}
        nextIcon="rocket_launch"
      />
    </form>
  );
}
