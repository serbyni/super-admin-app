import { Icon } from "@/components/ui/icon";

export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-sm rounded-lg bg-error-container p-sm text-on-error-container"
    >
      <Icon name="error" className="mt-0.5 shrink-0 text-icon-lg" />
      <p className="text-body-sm">{message}</p>
    </div>
  );
}
