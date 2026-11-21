"use client";

import { useState, type ReactNode } from "react";

/** Two tabs over prerendered panels (best sellers by quantity / by revenue). */
export function RankTabs({ tabs }: { tabs: { id: string; label: string; panel: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0].id);
  return (
    <div className="flex flex-col gap-md">
      <div role="tablist" className="flex gap-xs rounded-full bg-surface-container p-0.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              const next = tabs.find((x) => x.id !== active)!.id;
              setActive(next);
              document.getElementById(`tab-${next}`)?.focus();
            }}
            tabIndex={active === t.id ? 0 : -1}
            className={`flex-1 rounded-full px-md py-xs text-body-sm font-semibold ${
              active === t.id
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${t.id}`}
          hidden={active !== t.id}
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
