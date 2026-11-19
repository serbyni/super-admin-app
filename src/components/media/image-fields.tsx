"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/media/image";
import { mediaUrl } from "@/lib/media/config";
import { useMediaUpload, type MediaImage } from "./use-media-upload";

/* Photo fields shared by every feature (website, menu, branding). Uploads go through the media
   service: resized on the device, stored once per café, reused when uploaded again. */

function Picker({
  label,
  multiple,
  disabled,
  onFiles,
  busy,
}: {
  label: string;
  multiple?: boolean;
  disabled?: boolean;
  busy: boolean;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-xs rounded-lg border border-outline-variant px-md py-sm text-body-sm font-semibold text-primary hover:bg-secondary-container disabled:opacity-60"
      >
        <Icon
          name={busy ? "progress_activity" : "add_photo_alternate"}
          className={`text-icon-lg ${busy ? "animate-spin" : ""}`}
        />
        {busy ? "Uploading…" : label}
      </button>
    </>
  );
}

function Thumb({ image, onRemove }: { image: MediaImage; onRemove: () => void }) {
  return (
    <div className="group relative aspect-video overflow-hidden rounded-lg bg-surface-container">
      {/* eslint-disable-next-line @next/next/no-img-element -- user photo from Supabase Storage */}
      <img src={mediaUrl(image.path)} alt={image.alt} className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute end-xs top-xs flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-lowest text-error shadow-sm"
      >
        <Icon name="delete" className="text-icon-md" />
      </button>
    </div>
  );
}

/** One photo (hero cover, story picture) with a description for screen readers. */
export function ImageField({
  cafeId,
  label,
  value,
  onChange,
  error,
}: {
  cafeId: string;
  label: string;
  value: MediaImage | null;
  onChange: (v: MediaImage | null) => void;
  error?: string;
}) {
  const { busy, upload } = useMediaUpload(cafeId);
  return (
    <div className="flex flex-col gap-sm">
      <p className="text-body-sm font-semibold text-on-surface">{label}</p>
      {value ? (
        <>
          <div className="max-w-card-sm">
            <Thumb image={value} onRemove={() => onChange(null)} />
          </div>
          <AltInput value={value.alt} onChange={(alt) => onChange({ ...value, alt })} />
        </>
      ) : null}
      <div>
        <Picker
          label={value ? "Replace photo" : "Upload photo"}
          busy={busy}
          onFiles={async (files) => {
            const [img] = await upload(files.slice(0, 1));
            if (img) onChange(img);
          }}
        />
      </div>
      {error ? <p className="text-body-xs text-error">{error}</p> : null}
    </div>
  );
}

/** Up to `max` photos. */
export function GalleryField({
  cafeId,
  value,
  max,
  onChange,
  error,
}: {
  cafeId: string;
  value: MediaImage[];
  max: number;
  onChange: (v: MediaImage[]) => void;
  error?: string;
}) {
  const { busy, upload } = useMediaUpload(cafeId);
  const left = max - value.length;
  return (
    <div className="flex flex-col gap-sm">
      {value.length ? (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          {value.map((img, i) => (
            <Thumb
              key={img.path}
              image={img}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-sm">
        <Picker
          label="Add photos"
          multiple
          busy={busy}
          disabled={left <= 0}
          onFiles={async (files) => {
            const imgs = (await upload(files.slice(0, left))).filter(
              (img) => !value.some((v) => v.path === img.path),
            );
            if (imgs.length) onChange([...value, ...imgs]);
          }}
        />
        <span className="text-caption text-on-surface-variant">
          {value.length} / {max} photos
        </span>
      </div>
      {error ? <p className="text-body-xs text-error">{error}</p> : null}
    </div>
  );
}

function AltInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-xs text-caption text-on-surface-variant">
      Photo description (for screen readers)
      <input
        value={value}
        maxLength={150}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-outline-variant bg-transparent px-sm py-xs text-body-sm text-on-surface focus:border-primary focus:outline-none"
      />
    </label>
  );
}
