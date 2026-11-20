"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { setCafeExtraLanguagesAction } from "@/app/(admin)/admin/languages/actions";
import type { AdminCafeLanguages } from "@/lib/data/services/languages";
import { languageLabel } from "@/lib/i18n/languages";

/** Admin café page: languages the café offers, and its extra languages (beyond EN/FR/AR). */
export function CafeLanguagesCard({
  slug,
  languages,
}: {
  slug: string;
  languages: AdminCafeLanguages;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [extras, setExtras] = useState(languages.extras);
  const candidates = languages.supported.filter((l) => !languages.base.includes(l));
  const dirty = [...extras].sort().join() !== [...languages.extras].sort().join();
  return (
    <section className="rounded-xl bg-surface-container-lowest p-lg shadow-sm">
      <h2 className="mb-sm flex items-center gap-sm text-headline-md text-on-surface">
        <Icon name="translate" className="text-icon-xl text-primary" /> Languages
      </h2>
      <p className="text-body-sm text-on-surface-variant">
        Offers:{" "}
        <span className="font-semibold text-on-surface">
          {languages.offered
            .map((l) => `${languageLabel(l)}${l === languages.main ? " (main)" : ""}`)
            .join(", ")}
        </span>
      </p>
      <fieldset className="mt-md">
        <legend className="mb-xs text-body-sm font-semibold text-on-surface">
          Extra languages (English, French and Arabic are always available)
        </legend>
        <div className="grid grid-cols-2 gap-xs sm:grid-cols-3">
          {candidates.map((l) => (
            <label key={l} className="flex items-center gap-xs text-body-sm text-on-surface">
              <input
                type="checkbox"
                checked={extras.includes(l)}
                onChange={(e) =>
                  setExtras((x) => (e.target.checked ? [...x, l] : x.filter((v) => v !== l)))
                }
                className="h-4 w-4 accent-primary"
              />
              {languageLabel(l)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-md flex items-center justify-between gap-sm">
        <p className="text-caption text-on-surface-variant">
          Removing an extra also stops the café from offering it.
        </p>
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const r = await setCafeExtraLanguagesAction(slug, extras);
              toast.show({ variant: r.ok ? "success" : "error", title: r.message });
            })
          }
          className="inline-flex shrink-0 items-center gap-xs rounded-xl bg-primary px-md py-sm text-body-sm font-semibold text-on-primary disabled:opacity-60"
        >
          <Icon
            name={pending ? "progress_activity" : "check"}
            className={`text-icon-md ${pending ? "animate-spin" : ""}`}
          />
          Save
        </button>
      </div>
    </section>
  );
}
