import { useTranslations } from "next-intl";
import { passwordStrength } from "@/lib/auth/password-strength";

const BAR: Record<number, string> = {
  1: "bg-error",
  2: "bg-primary-container",
  3: "bg-secondary",
  4: "bg-primary",
};
const LABEL: Record<string, { className: string }> = {
  empty: { className: "text-secondary" },
  weak: { className: "text-error" },
  fair: { className: "text-primary-container" },
  good: { className: "text-secondary" },
  strong: { className: "text-primary" },
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  const t = useTranslations("register");
  const { score, label } = passwordStrength(password);
  const l = LABEL[label];
  return (
    <div
      className="flex flex-col gap-xs rounded-lg bg-surface-container-low p-sm"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-caption tracking-wider text-on-surface-variant uppercase">
          {t("strength")}
        </span>
        <span className={`font-label-sm text-caption ${l.className}`}>
          {t(`strengthLabels.${label}`)}
        </span>
      </div>
      <div className="grid h-1.5 w-full grid-cols-4 gap-xs">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-full rounded-full transition-colors duration-300 ${i <= score ? BAR[score] : "bg-surface-container-highest"}`}
          />
        ))}
      </div>
      <p className="font-label-sm text-caption font-normal text-outline">{t("strengthHint")}</p>
    </div>
  );
}
