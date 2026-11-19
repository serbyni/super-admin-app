"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { mediaUrl } from "@/lib/website/media";
import type { WebsiteImage } from "@/lib/website/schema";
import { UploadError, uploadWebsiteImage } from "./upload";

function useUpload(cafeId: string) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const upload = async (files: File[]): Promise<WebsiteImage[]> => {
    setBusy(true);
    const out: WebsiteImage[] = [];
    try {
      for (const f of files) out.push(await uploadWebsiteImage(cafeId, f));
    } catch (e) {
      toast.show({
        variant: "error",
        title: e instanceof UploadError ? e.message : "Upload failed. Please try again.",
      });
    } finally {
      setBusy(false);
    }
    return out;
  };
  return { busy, upload };
}

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
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
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

function Thumb({ image, onRemove }: { image: WebsiteImage; onRemove: () => void }) {
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
  value: WebsiteImage | null;
  onChange: (v: WebsiteImage | null) => void;
  error?: string;
}) {
  const { busy, upload } = useUpload(cafeId);
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
  value: WebsiteImage[];
  max: number;
  onChange: (v: WebsiteImage[]) => void;
  error?: string;
}) {
  const { busy, upload } = useUpload(cafeId);
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
            const imgs = await upload(files.slice(0, left));
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
