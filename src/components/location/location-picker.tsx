"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { FieldError, FloatingLabel, outlinedBox, TextField } from "@/components/auth/fields";
import { Icon } from "@/components/ui/icon";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, PLACE_ZOOM } from "@/config/maps";
import { roundCoord, type BusinessLocation } from "@/lib/location/address";
import { pointAtOffset } from "@/lib/location/mercator";

type Errors = Partial<
  Record<"location" | "street" | "postal_code" | "city" | "country_code", string>
>;

/** What the server tells the browser about maps — never a key. */
export type MapsClientConfig = { enabled: boolean; interactive: boolean; attribution?: string };

/** Leaflet needs `window`: load the interactive map in the browser only. */
const InteractiveMap = dynamic(() => import("./interactive-map"), {
  ssr: false,
  loading: () => (
    <div className="aspect-4/3 w-full animate-pulse rounded-lg bg-surface-container sm:aspect-map" />
  ),
});

type Props = {
  initial?: Partial<BusinessLocation>;
  errors?: Errors;
  /** All provider calls go through our /api routes with a server-only key. */
  maps: MapsClientConfig;
  /** Called with the ISO country code whenever the location's country changes. */
  onCountryChange?: (countryCode: string | undefined) => void;
};

/** Logical size of /api/maps/static images (must match STATIC_MAP on the server). */
const MAP_W = 640;
const MIN_ZOOM = 3;
const MAX_ZOOM = 20;

type Address = Partial<
  Pick<
    BusinessLocation,
    "formatted_address" | "street" | "postal_code" | "city" | "region" | "country" | "country_code"
  >
>;

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Business location: Google Places search, a static map you click to move the pin, or typed
 * coordinates. No Google key reaches the browser — everything goes through our /api proxies.
 * Submits `location` (JSON) plus editable `street`, `postal_code`, `city`.
 */
export function LocationPicker({ initial, errors = {}, maps, onCountryChange }: Props) {
  const t = useTranslations("location");
  const mapsEnabled = maps.enabled;
  const [loc, setLoc] = useState<Partial<BusinessLocation>>(initial ?? {});
  const update = useCallback(
    (next: Partial<BusinessLocation>) => setLoc((prev) => ({ ...prev, ...next })),
    [],
  );

  const countryCode = loc.country_code;
  useEffect(() => {
    onCountryChange?.(countryCode);
  }, [countryCode, onCountryChange]);

  /** Move the pin and (when maps are enabled) look up the address for it. */
  const locate = useCallback(
    async (lat: number, lng: number, source: BusinessLocation["source"]) => {
      const point = { lat: roundCoord(lat), lng: roundCoord(lng) };
      // New position: drop the previous address so nothing stale is kept, then fill it again.
      update({
        ...point,
        source,
        place_id: undefined,
        formatted_address: undefined,
        street: undefined,
        postal_code: undefined,
        city: undefined,
        region: undefined,
        country: undefined,
        country_code: undefined,
      });
      if (!mapsEnabled) return;
      const data = await getJson<{ address: Address | null }>(
        `/api/geocode/reverse?lat=${point.lat}&lng=${point.lng}`,
      );
      if (data?.address) update(data.address);
    },
    [mapsEnabled, update],
  );

  return (
    <fieldset className="flex flex-col gap-md rounded-xl border border-surface-container-high p-md">
      <legend className="sr-only">{t("legend")}</legend>
      <div className="flex items-center gap-sm">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-container text-primary">
          <Icon name="storefront" className="text-icon-md" />
        </span>
        <div>
          <p className="text-body-md font-semibold text-on-surface">{t("legend")}</p>
          <p className="text-caption text-on-surface-variant">{t("body")}</p>
        </div>
      </div>
      <input type="hidden" name="location" value={JSON.stringify(loc)} />

      {mapsEnabled ? (
        <>
          <PlaceSearch onPlace={update} error={errors.location} />
          {maps.interactive ? (
            <InteractiveMap
              loc={loc}
              attribution={maps.attribution}
              onPick={(lat, lng) => void locate(lat, lng, "map_pin")}
              onSelectPlace={update}
            />
          ) : (
            <StaticMapPicker
              loc={loc}
              attribution={maps.attribution}
              onPick={(lat, lng) => void locate(lat, lng, "map_pin")}
            />
          )}
          <ManualCoordinates
            loc={loc}
            errors={errors}
            onSet={(lat, lng) => void locate(lat, lng, "coordinates")}
          />
        </>
      ) : (
        <ManualCoordinates loc={loc} errors={errors} update={update} withCountry />
      )}

      <AddressFields loc={loc} update={update} errors={errors} />
    </fieldset>
  );
}

/* ── Search (Places API (New) via /api/places/*) ──────────────────────────── */

type Suggestion = {
  placeId: string;
  main: string;
  secondary?: string;
  /** Provided directly by some providers (no details call needed). */
  place?: BusinessLocation;
};

function PlaceSearch({
  onPlace,
  error,
}: {
  onPlace: (place: Partial<BusinessLocation>) => void;
  error?: string;
}) {
  const t = useTranslations("location");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const token = useRef<string | null>(null);
  const chosenLabel = useRef<string | null>(null);
  const visible = query.trim().length >= 3 ? suggestions : [];

  useEffect(() => {
    const input = query.trim();
    if (input.length < 3 || query === chosenLabel.current) return;
    token.current ??= crypto.randomUUID(); // one billing session per selection
    const sessionToken = token.current;
    const handle = setTimeout(async () => {
      const data = await getJson<{ suggestions: Suggestion[] }>("/api/places/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, sessionToken }),
      });
      setSuggestions(data?.suggestions ?? []);
      setOpen(true);
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  async function choose(s: Suggestion) {
    setOpen(false);
    const label = s.secondary ? `${s.main}, ${s.secondary}` : s.main;
    chosenLabel.current = label;
    setSuggestions([]);
    setQuery(label);
    if (s.place) {
      token.current = null;
      onPlace(s.place);
      return;
    }
    if (!token.current) return;
    setBusy(true);
    const data = await getJson<{ place: BusinessLocation }>(
      `/api/places/details?placeId=${encodeURIComponent(s.placeId)}&sessionToken=${token.current}`,
    );
    token.current = null; // session ends with the details call
    setBusy(false);
    if (data?.place) onPlace(data.place);
  }

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          id="placeSearch"
          type="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && visible.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => visible.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={t("searchPlaceholder")}
          className={`${outlinedBox(error)} ps-11 pe-4`}
        />
        <Icon
          name={busy ? "progress_activity" : "search"}
          className={`pointer-events-none absolute start-3.5 text-icon-lg text-on-surface-variant ${busy ? "animate-spin" : ""}`}
        />
        <FloatingLabel htmlFor="placeSearch" required error={error} withIcon>
          {t("find")}
        </FloatingLabel>
      </div>
      {open && visible.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg bg-surface-container-lowest shadow-card-warm"
        >
          {visible.map((s) => (
            <li key={s.placeId} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void choose(s)}
                className="flex w-full items-start gap-sm px-md py-sm text-start hover:bg-surface-container-low"
              >
                <Icon name="location_on" className="mt-0.5 text-icon-md text-primary" />
                <span>
                  <span className="block text-body-sm font-semibold text-on-surface">{s.main}</span>
                  {s.secondary ? (
                    <span className="block text-caption text-on-surface-variant">
                      {s.secondary}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <FieldError id="placeSearch" message={error} />
    </div>
  );
}

/* ── Map (Google Static Maps via /api/maps/static; click to move the pin) ─── */

function StaticMapPicker({
  loc,
  attribution,
  onPick,
}: {
  loc: Partial<BusinessLocation>;
  attribution?: string;
  onPick: (lat: number, lng: number) => void;
}) {
  const t = useTranslations("location");
  const hasPin = typeof loc.lat === "number" && typeof loc.lng === "number";
  const center = hasPin ? { lat: loc.lat!, lng: loc.lng! } : DEFAULT_MAP_CENTER;
  const [zoom, setZoom] = useState(hasPin ? PLACE_ZOOM : DEFAULT_MAP_ZOOM);
  const [pinned, setPinned] = useState(hasPin);
  const [loading, setLoading] = useState(true);

  // Zoom in when a pin appears (search result, typed coordinates).
  if (hasPin && !pinned) {
    setPinned(true);
    setZoom(PLACE_ZOOM);
  }

  const src = `/api/maps/static?lat=${center.lat}&lng=${center.lng}&zoom=${zoom}&marker=${hasPin ? 1 : 0}`;

  function onClick(e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = MAP_W / rect.width; // displayed px → map logical px
    const dx = (e.clientX - rect.left - rect.width / 2) * ratio;
    const dy = (e.clientY - rect.top - rect.height / 2) * ratio;
    const p = pointAtOffset(center, zoom, dx, dy);
    setLoading(true);
    onPick(p.lat, p.lng);
  }

  return (
    <div className="flex flex-col gap-xs">
      <div className="relative overflow-hidden rounded-lg bg-surface-container shadow-sm">
        <button
          type="button"
          onClick={onClick}
          aria-label={t("mapLabel")}
          className="block aspect-map w-full cursor-crosshair"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- proxied Google Static Map, not a static asset */}
          <img
            key={src}
            src={src}
            alt={hasPin ? t("mapAltPin") : t("mapAlt")}
            className={`h-full w-full object-cover transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
            draggable={false}
          />
        </button>
        <div className="absolute end-sm top-sm flex flex-col overflow-hidden rounded-lg bg-surface-container-lowest/95 shadow-md">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setZoom((z) => Math.min(MAX_ZOOM, z + 1));
            }}
            disabled={zoom >= MAX_ZOOM}
            aria-label={t("zoomIn")}
            className="flex h-9 w-9 items-center justify-center text-on-surface hover:bg-surface-container disabled:opacity-40"
          >
            <Icon name="add" className="text-icon-lg" />
          </button>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setZoom((z) => Math.max(MIN_ZOOM, z - 1));
            }}
            disabled={zoom <= MIN_ZOOM}
            aria-label={t("zoomOut")}
            className="flex h-9 w-9 items-center justify-center border-t border-surface-container-high text-on-surface hover:bg-surface-container disabled:opacity-40"
          >
            <Icon name="remove" className="text-icon-lg" />
          </button>
        </div>
        {!hasPin ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-sm flex justify-center">
            <span className="rounded-full bg-surface-container-lowest/95 px-md py-xs text-caption font-semibold text-on-surface shadow-sm">
              {t("placeHint")}
            </span>
          </div>
        ) : null}
      </div>
      {attribution ? (
        <p className="text-end text-caption text-on-surface-variant">
          {t("mapAttribution", { attribution })}
        </p>
      ) : null}
      <p className="flex items-start gap-xs text-caption text-on-surface-variant">
        <Icon name="touch_app" className="text-icon-sm" />
        {t("wrongPlace")}
      </p>
    </div>
  );
}

/* ── Coordinates ──────────────────────────────────────────────────────────── */

function ManualCoordinates({
  loc,
  errors,
  onSet,
  update,
  withCountry = false,
}: {
  loc: Partial<BusinessLocation>;
  errors: Errors;
  onSet?: (lat: number, lng: number) => void;
  update?: (l: Partial<BusinessLocation>) => void;
  withCountry?: boolean;
}) {
  const t = useTranslations("location");
  const [lat, setLat] = useState(loc.lat?.toString() ?? "");
  const [lng, setLng] = useState(loc.lng?.toString() ?? "");
  const la = Number(lat);
  const lo = Number(lng);
  const valid = lat.trim() !== "" && lng.trim() !== "" && Math.abs(la) <= 90 && Math.abs(lo) <= 180;

  function apply() {
    if (!valid) return;
    if (onSet) onSet(la, lo);
    else
      update?.({
        lat: roundCoord(la),
        lng: roundCoord(lo),
        source: "coordinates",
        place_id: undefined,
      });
  }

  const body = (
    <div className="flex flex-col gap-sm">
      <div className={`grid grid-cols-1 gap-sm ${onSet ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <TextField
          id="latInput"
          label={t("latitude")}
          icon="explore"
          inputMode="decimal"
          placeholder="36.8065"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          onBlur={onSet ? undefined : apply}
        />
        <TextField
          id="lngInput"
          label={t("longitude")}
          icon="explore"
          inputMode="decimal"
          placeholder="10.1815"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          onBlur={onSet ? undefined : apply}
        />
        {onSet ? (
          <div className="flex items-end">
            <button
              type="button"
              onClick={apply}
              disabled={!valid}
              className="flex w-full items-center justify-center gap-xs rounded-lg bg-secondary-container px-md py-3 text-body-sm font-semibold text-on-secondary-container transition-colors hover:bg-secondary-fixed-dim disabled:opacity-50"
            >
              <Icon name="pin_drop" className="text-icon-md" />
              {t("placePin")}
            </button>
          </div>
        ) : null}
      </div>
      {withCountry ? (
        <TextField
          id="countryCodeInput"
          label={t("countryCode")}
          icon="public"
          placeholder="TN"
          maxLength={2}
          required
          value={loc.country_code ?? ""}
          onChange={(e) => update?.({ country_code: e.target.value.toUpperCase() })}
          error={errors.country_code}
        />
      ) : null}
      {onSet ? null : <FieldError id="latInput" message={errors.location} />}
    </div>
  );

  return onSet ? (
    <details className="rounded-lg bg-surface-container-lowest p-sm">
      <summary className="cursor-pointer text-body-sm font-semibold text-primary">
        {t("notOnMap")}
      </summary>
      <div className="pt-sm">{body}</div>
    </details>
  ) : (
    <div>
      <p className="mb-sm text-caption text-on-surface-variant">{t("noSearch")}</p>
      {body}
    </div>
  );
}

/* ── Address (pre-filled from Google, editable) ───────────────────────────── */

function AddressFields({
  loc,
  update,
  errors,
}: {
  loc: Partial<BusinessLocation>;
  update: (l: Partial<BusinessLocation>) => void;
  errors: Errors;
}) {
  const t = useTranslations("location");
  return (
    <div className="flex flex-col gap-sm">
      {loc.formatted_address || loc.country ? (
        <div className="flex items-start gap-sm rounded-lg bg-surface-container-lowest p-sm">
          <Icon name="location_on" filled className="mt-0.5 text-icon-lg text-primary" />
          <div className="text-body-sm">
            <p className="font-semibold text-on-surface">
              {loc.formatted_address ?? t("selected")}
            </p>
            <p className="text-on-surface-variant">
              {[loc.region, loc.country && `${loc.country} (${loc.country_code})`]
                .filter(Boolean)
                .join(" · ")}
              {typeof loc.lat === "number" ? ` · ${loc.lat}, ${loc.lng}` : ""}
            </p>
          </div>
        </div>
      ) : null}
      <TextField
        id="street"
        label={t("street")}
        icon="signpost"
        autoComplete="street-address"
        placeholder="10 Rue de Marseille"
        value={loc.street ?? ""}
        onChange={(e) => update({ street: e.target.value })}
        error={errors.street}
      />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <TextField
          id="postal_code"
          label={t("postalCode")}
          icon="markunread_mailbox"
          autoComplete="postal-code"
          placeholder="1000"
          value={loc.postal_code ?? ""}
          onChange={(e) => update({ postal_code: e.target.value })}
          error={errors.postal_code}
        />
        <TextField
          id="city"
          label={t("city")}
          icon="location_city"
          autoComplete="address-level2"
          placeholder="Tunis"
          required
          value={loc.city ?? ""}
          onChange={(e) => update({ city: e.target.value })}
          error={errors.city}
        />
      </div>
    </div>
  );
}
