"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { FieldError, FieldHint, FloatingLabel } from "./fields";
import { Icon } from "@/components/ui/icon";
import { DEFAULT_PHONE_COUNTRY, PREFERRED_PHONE_COUNTRIES } from "@/config/phone";

type Country = { code: CountryCode; name: string; dial: string };

const cachedCountries = new Map<string, Country[]>();
/** Countries with their names in the interface language `locale`. */
function allCountries(locale: string): Country[] {
  const hit = cachedCountries.get(locale);
  if (hit) return hit;
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const list = getCountries()
    .map((code) => ({ code, name: names.of(code) ?? code, dial: getCountryCallingCode(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  cachedCountries.set(locale, list);
  return list;
}

const digitsOf = (v: string) => v.replace(/\D/g, "");

/** E.164 value submitted to the server ("" when nothing typed). */
function toE164(national: string, country: CountryCode): string {
  const digits = digitsOf(national);
  if (!digits) return "";
  return (
    parsePhoneNumberFromString(digits, country)?.number ??
    `+${getCountryCallingCode(country)}${digits}`
  );
}

function initialState(value?: string): { country: CountryCode; national: string } {
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  if (parsed?.country) {
    return {
      country: parsed.country,
      national: new AsYouType(parsed.country).input(parsed.formatNational()),
    };
  }
  return { country: DEFAULT_PHONE_COUNTRY, national: "" };
}

function Flag({ code }: { code: CountryCode }) {
  return (
    <Image
      src={`/flags/${code}.svg`}
      alt=""
      width={24}
      height={16}
      unoptimized
      loading="lazy"
      className="h-4 w-6 shrink-0 rounded-xs object-cover shadow-xs"
    />
  );
}

type Props = {
  id: string;
  label: string;
  required?: boolean;
  /** E.164 number, e.g. "+21620123456". */
  defaultValue?: string;
  error?: string;
  /** Country to switch to while the number is still empty (e.g. from the business location). */
  suggestedCountry?: string;
};

/**
 * Phone number with a searchable country picker. Formats as you type for the chosen
 * country, detects the country when a "+…" number is pasted, and submits E.164 in `name={id}`.
 */
export function PhoneField({ id, label, required, defaultValue, error, suggestedCountry }: Props) {
  const t = useTranslations("fields");
  const locale = useLocale();
  const [{ country, national }, setState] = useState(() => initialState(defaultValue));
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const e164 = toE164(national, country);
  const valid = e164 !== "" && isValidPhoneNumber(e164);
  const dial = getCountryCallingCode(country);
  const placeholder = getExampleNumber(country, examples)?.formatNational() ?? "";

  // Follow the business location's country until the owner types a number.
  const [lastSuggested, setLastSuggested] = useState(suggestedCountry);
  if (suggestedCountry !== lastSuggested) {
    setLastSuggested(suggestedCountry);
    const cc = suggestedCountry?.toUpperCase() as CountryCode | undefined;
    if (cc && !digitsOf(national) && getCountries().includes(cc)) {
      setState({ country: cc, national: "" });
    }
  }

  function onType(raw: string) {
    // "+33 6 12…" or "0033…" typed/pasted: detect the country from the number.
    const intl = raw.trim().replace(/^00/, "+");
    if (intl.startsWith("+")) {
      const t = new AsYouType();
      t.input(intl);
      const detected = t.getCountry() ?? t.getNumber()?.country;
      if (detected) {
        // National format as written locally (e.g. "06 12 34 56 78" in France).
        const local = t.getNumber()?.formatNational() ?? t.getNationalNumber();
        setState({ country: detected, national: new AsYouType(detected).input(local) });
        return;
      }
      setState((s) => ({ ...s, national: intl }));
      return;
    }
    let digits = digitsOf(raw);
    // Backspace over a formatting space/dash: remove the digit before it instead of looping.
    if (raw.length < national.length && digits === digitsOf(national)) digits = digits.slice(0, -1);
    setState({ country, national: digits ? new AsYouType(country).input(digits) : "" });
  }

  function choose(code: CountryCode) {
    setState({ country: code, national: new AsYouType(code).input(digitsOf(national)) });
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div ref={wrapperRef} className="group relative">
      <div
        className={`relative flex items-stretch rounded-lg border transition-colors focus-within:ring-1 ${
          error
            ? "border-error focus-within:ring-error"
            : "border-outline-variant focus-within:border-primary focus-within:ring-primary hover:border-outline"
        }`}
      >
        <FloatingLabel htmlFor={id} required={required} error={error} rest="never">
          <span className={error ? "" : "group-focus-within:text-primary"}>{label}</span>
        </FloatingLabel>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={t("countryCode", {
            country: allCountries(locale).find((c) => c.code === country)?.name ?? country,
            dial,
          })}
          className="flex shrink-0 items-center gap-xs rounded-s-lg border-e border-outline-variant ps-3 pe-2 text-body-md text-on-surface hover:bg-surface-container"
        >
          <Flag code={country} />
          <span className="font-semibold tabular-nums">+{dial}</span>
          <Icon
            name="expand_more"
            className={`text-icon-lg text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          value={national}
          onChange={(e) => onType(e.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : national && !valid ? `${id}-hint` : undefined}
          className="w-full min-w-0 bg-transparent py-3.5 ps-3 pe-2 text-body-md text-on-surface tabular-nums placeholder:text-outline focus:outline-none"
        />
        {valid ? (
          <span className="flex items-center pe-3" title="Valid number">
            <Icon name="check_circle" filled className="text-icon-lg text-success" />
          </span>
        ) : null}
        <input type="hidden" name={id} value={e164} />
      </div>
      {open ? (
        <CountryList
          current={country}
          onChoose={choose}
          onClose={close}
          containerRef={wrapperRef}
        />
      ) : null}
      {error ? (
        <FieldError id={id} message={error} />
      ) : national && !valid ? (
        <FieldHint id={id}>{t("phoneIncomplete")}</FieldHint>
      ) : null}
    </div>
  );
}

function CountryList({
  current,
  onChoose,
  onClose,
  containerRef,
}: {
  current: CountryCode;
  onChoose: (c: CountryCode) => void;
  onClose: () => void;
  /** Clicks inside (e.g. on the toggle button) do not count as "outside". */
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("fields");
  const locale = useLocale();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const all = allCountries(locale);
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (q) {
      const pref = (c: Country) => {
        const i = PREFERRED_PHONE_COUNTRIES.indexOf(c.code);
        return i < 0 ? PREFERRED_PHONE_COUNTRIES.length : i;
      };
      // Best matches first: name starts with the query, then a word starts with it, then contains.
      const rank = (c: Country) => {
        const name = c.name.toLowerCase();
        if (c.code.toLowerCase() === q || c.dial === q || name.startsWith(q)) return 0;
        if (name.split(/[\s-]+/).some((w) => w.startsWith(q))) return 1;
        if (c.dial.startsWith(q)) return 2;
        return name.includes(q) ? 3 : -1;
      };
      return (
        all
          .map((c) => ({ c, r: rank(c) }))
          .filter((x) => x.r >= 0)
          // Ties: main markets (PREFERRED_PHONE_COUNTRIES) first, then alphabetical (stable).
          .sort((a, b) => a.r - b.r || pref(a.c) - pref(b.c))
          .map((x) => x.c)
      );
    }
    const preferred = PREFERRED_PHONE_COUNTRIES.map((code) =>
      all.find((c) => c.code === code)!,
    ).filter(Boolean);
    return [...preferred, ...all.filter((c) => !PREFERRED_PHONE_COUNTRIES.includes(c.code))];
  }, [query, locale]);
  const preferredCount = query.trim() ? 0 : PREFERRED_PHONE_COUNTRIES.length;

  useEffect(() => {
    searchRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose, containerRef]);

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[active]) onChoose(items[active].code);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg bg-surface-container-lowest shadow-card-warm sm:w-auto sm:min-w-80">
      <div className="relative flex items-center border-b border-surface-container-high">
        <Icon
          name="search"
          className="pointer-events-none absolute start-3 text-icon-lg text-on-surface-variant"
        />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          placeholder={t("searchCountry")}
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
          className="w-full bg-transparent py-2.5 ps-10 pe-3 text-body-sm text-on-surface placeholder:text-outline focus:outline-none"
        />
      </div>
      <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-xs">
        {items.length === 0 ? (
          <li className="px-md py-sm text-body-sm text-on-surface-variant">{t("noCountry")}</li>
        ) : (
          items.map((c, i) => (
            <li
              key={c.code}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={c.code === current}
              onMouseEnter={() => setActive(i)}
              onClick={() => onChoose(c.code)}
              className={`flex cursor-pointer items-center gap-sm px-md py-2 text-body-sm ${
                i === active ? "bg-surface-container" : ""
              } ${i === preferredCount - 1 ? "border-b border-surface-container-high" : ""}`}
            >
              <Flag code={c.code} />
              <span className="flex-1 truncate text-on-surface">{c.name}</span>
              <span className="text-on-surface-variant tabular-nums">+{c.dial}</span>
              {c.code === current ? (
                <Icon name="check" className="text-icon-md text-primary" />
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
