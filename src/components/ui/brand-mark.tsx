import Image from "next/image";

/** Serbi app mark (QR-cup on leather tile). Size via className, e.g. "h-9 w-9". */
export function BrandMark({
  className = "h-9 w-9",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/serbi-mark.png"
      alt="Serbi"
      width={256}
      height={256}
      priority={priority}
      className={`shrink-0 drop-shadow-sm ${className}`}
    />
  );
}
