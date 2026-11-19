"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { browserApi } from "@/lib/data/browser-api";
import { MediaError } from "@/lib/media/image";

/** A stored photo as features keep it: bucket path + description. */
export type MediaImage = { path: string; alt: string };

/**
 * Uploads photos for a café through the shared media service (resize, fingerprint, reuse).
 * Returns each photo once even if the same file was picked twice; tells the owner when a photo
 * was already stored and got reused instead of uploaded again.
 */
export function useMediaUpload(cafeId: string) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const upload = async (files: File[]): Promise<MediaImage[]> => {
    setBusy(true);
    const out: MediaImage[] = [];
    let reused = 0;
    try {
      for (const f of files) {
        const { path, alt, reused: wasStored } = await browserApi().media.uploadImage(cafeId, f);
        if (wasStored) reused++;
        if (!out.some((o) => o.path === path)) out.push({ path, alt });
      }
      if (reused)
        toast.show({
          variant: "info",
          title:
            reused === 1
              ? "This photo was already uploaded — reused it"
              : `${reused} photos were already uploaded — reused them`,
        });
    } catch (e) {
      toast.show({
        variant: "error",
        title: e instanceof MediaError ? e.message : "Upload failed. Please try again.",
      });
    } finally {
      setBusy(false);
    }
    return out;
  };

  return { busy, upload };
}
