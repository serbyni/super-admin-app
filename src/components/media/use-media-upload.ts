"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMsg } from "@/i18n/use-msg";
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
  const t = useTranslations("media");
  const m = useMsg();
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
          title: t("reused", { count: reused }),
        });
    } catch (e) {
      toast.show({
        variant: "error",
        title: e instanceof MediaError ? m(e.message) : t("failed"),
      });
    } finally {
      setBusy(false);
    }
    return out;
  };

  return { busy, upload };
}
