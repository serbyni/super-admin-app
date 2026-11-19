"use client";

import { BRAND_PRESETS } from "@/config/cafe-defaults";

/** Preset brand colours + a custom colour input. `value` is "#rrggbb". */
export function BrandColourPicker({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (seed: string) => void;
  /** Form field name: when set, the colour is also submitted with the form. */
  name?: string;
}) {
  const seed = value;
  const setSeed = onChange;
  return (
    <>
      {name ? <input type="hidden" name={name} value={seed} /> : null}
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
            <span className="block text-body-sm font-semibold text-on-surface">Custom colour</span>
            <span className="block font-mono text-caption text-on-surface-variant">{seed}</span>
          </span>
        </label>
      </div>
    </>
  );
}
