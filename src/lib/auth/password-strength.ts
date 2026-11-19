export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "empty" | "weak" | "fair" | "good" | "strong";
};

export const PASSWORD_MIN_LENGTH = 10;

/** 1 point each: length ≥ min, upper case, digit, symbol. */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "empty" };
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ["weak", "weak", "fair", "good", "strong"] as const;
  return { score: score as PasswordStrength["score"], label: labels[score] };
}
