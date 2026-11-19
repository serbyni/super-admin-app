import Link from "next/link";
import { FieldError } from "./fields";

export function TermsCheckbox({ error }: { error?: string }) {
  return (
    <div>
      <label className="mt-xs flex cursor-pointer items-start gap-sm">
        <input
          type="checkbox"
          name="terms"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "terms-error" : undefined}
          className="mt-1 h-4 w-4 cursor-pointer rounded accent-primary"
        />
        <span className="text-body-xs leading-relaxed text-on-surface-variant select-none">
          I agree to the{" "}
          <Link href="/terms" className="font-semibold text-primary hover:underline">
            Terms of Service
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <FieldError id="terms" message={error} />
    </div>
  );
}
