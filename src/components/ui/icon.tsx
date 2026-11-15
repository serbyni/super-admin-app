import type { CSSProperties } from "react";

type IconProps = {
  /** Material Symbols name, e.g. "mail", "lock", "arrow_forward". */
  name: string;
  className?: string;
  filled?: boolean;
  /** Mirror in right-to-left layouts (use for directional icons like arrows). */
  flipRtl?: boolean;
};

export function Icon({ name, className = "", filled = false, flipRtl = false }: IconProps) {
  const style: CSSProperties | undefined = filled
    ? { fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24' }
    : undefined;
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${flipRtl ? "rtl:-scale-x-100" : ""} ${className}`}
      style={style}
    >
      {name}
    </span>
  );
}
