"use client";

import { useTranslations } from "next-intl";
import { useState, type InputHTMLAttributes } from "react";
import { Icon } from "@/components/ui/icon";
import { TextField } from "./fields";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  label: string;
  icon?: string;
  error?: string;
};

export function PasswordField({ icon = "lock", ...props }: PasswordFieldProps) {
  const t = useTranslations("fields");
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      icon={icon}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          className="absolute end-3 flex items-center justify-center rounded p-1 text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name={visible ? "visibility_off" : "visibility"} className="text-icon-lg" />
        </button>
      }
    />
  );
}
