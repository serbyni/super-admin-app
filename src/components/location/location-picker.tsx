"use client";

import {
  APIProvider,
  AdvancedMarker,
  Map,
  Marker,
  useMap,
  useMapsLibrary,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { FieldError, FieldLabel, TextField } from "@/components/auth/fields";
import { Icon } from "@/components/ui/icon";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, PLACE_ZOOM } from "@/config/maps";
import { mapsEnv } from "@/lib/env";
import { parseAddressComponents, roundCoord, type BusinessLocation } from "@/lib/location/address";

type Errors = Partial<
  Record<"location" | "street" | "postal_code" | "city" | "country_code", string>
>;

type Props = { initial?: Partial<BusinessLocation>; errors?: Errors };

/**
 * Business location: Google Places search + map preview with a draggable pin, or typed
 * coordinates. Submits `location` (JSON) plus editable `street`, `postal_code`, `city`.
 */
export function LocationPicker({ initial, errors = {} }: Props) {
  const { apiKey, mapId } = mapsEnv();
  const [loc, setLoc] = useState<Partial<BusinessLocation>>(initial ?? {});
  const update = useCallback(
    (next: Partial<BusinessLocation>) => setLoc((prev) => ({ ...prev, ...next })),
    [],
  );

  return (
    <fieldset className="flex flex-col gap-md rounded-xl bg-surface-container-low/60 p-md">
      <legend className="sr-only">Business location</legend>
      <div className="flex items-center gap-sm">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-container text-primary">
          <Icon name="storefront" className="text-icon-md" />
        </span>
        <div>
          <p className="text-body-md font-semibold text-on-surface">Business location</p>
          <p className="text-caption text-on-surface-variant">
            Where customers find you. Used for your café page and maps.
          </p>
        </div>
      </div>
      <input type="hidden" name="location" value={JSON.stringify(loc)} />
      {apiKey ? (
        <APIProvider apiKey={apiKey} libraries={["places", "geocoding", "marker"]}>
          <MapsLocation loc={loc} update={update} mapId={mapId} errors={errors} />
        </APIProvider>
      ) : (
        <ManualCoordinates loc={loc} update={update} errors={errors} withCountry />
      )}
      <AddressFields loc={loc} update={update} errors={errors} />
    </fieldset>
  );
}

/* ── With Google Maps ─────────────────────────────────────────────────────── */

function MapsLocation({
  loc,
  update,
  mapId,
  errors,
}: {
  loc: Partial<BusinessLocation>;
  update: (l: Partial<BusinessLocation>) => void;
  mapId?: string;
  errors: Errors;
}) {
  const geocodingLib = useMapsLibrary("geocoding");
  const geocoder = useMemo(
    () => (geocodingLib ? new geocodingLib.Geocoder() : null),
    [geocodingLib],
  );
  const hasPin = typeof loc.lat === "number" && typeof loc.lng === "number";

  /** Reverse-geocode a point and fill the address (keeps the chosen source). */
  const locate = useCallback(
    async (lat: number, lng: number, source: BusinessLocation["source"]) => {
      const point = { lat: roundCoord(lat), lng: roundCoord(lng) };
      update({ ...point, source, place_id: undefined });
      if (!geocoder) return;
      try {
        const { results } = await geocoder.geocode({ location: point });
        const best = results[0];
        if (best) {
          update({
            ...parseAddressComponents(best.address_components),
            formatted_address: best.formatted_address,
          });
        }
      } catch {
        /* keep coordinates; the owner can type the address */
      }
    },
    [geocoder, update],
  );

  const onMapClick = useCallback(
    (e: MapMouseEvent) => {
      const p = e.detail.latLng;
      if (p) void locate(p.lat, p.lng, "map_pin");
    },
    [locate],
  );

  const onDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const p = e.latLng;
      if (p) void locate(p.lat(), p.lng(), "map_pin");
    },
    [locate],
  );

  const position = hasPin ? { lat: loc.lat!, lng: loc.lng! } : null;

  return (
    <>
      <PlaceSearch onPlace={(place) => update(place)} error={errors.location} />
      <div className="overflow-hidden rounded-lg shadow-sm">
        <Map
          className="h-72 w-full"
          defaultCenter={position ?? DEFAULT_MAP_CENTER}
          defaultZoom={position ? PLACE_ZOOM : DEFAULT_MAP_ZOOM}
          mapId={mapId}
          gestureHandling="cooperative"
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={false}
          onClick={onMapClick}
        >
          <FollowPin position={position} />
          {position ? (
            mapId ? (
              <AdvancedMarker
                position={position}
                draggable
                onDragEnd={onDragEnd}
                title="Your business"
              />
            ) : (
              <Marker position={position} draggable onDragEnd={onDragEnd} title="Your business" />
            )
          ) : null}
        </Map>
      </div>
      <p className="flex items-start gap-xs text-caption text-on-surface-variant">
        <Icon name="touch_app" className="text-icon-sm" />
        Not on Google Maps? Click the map or drag the pin to your entrance, or enter coordinates
        below.
      </p>
      <ManualCoordinates
        loc={loc}
        update={update}
        errors={errors}
        onSet={(lat, lng) => locate(lat, lng, "coordinates")}
      />
    </>
  );
}

/** Pans/zooms the map when the pin moves from outside the map (search or typed coordinates). */
function FollowPin({ position }: { position: { lat: number; lng: number } | null }) {
  const map = useMap();
  const last = useRef<string>("");
  useEffect(() => {
    if (!map || !position) return;
    const key = `${position.lat},${position.lng}`;
    if (key === last.current) return;
    last.current = key;
    map.panTo(position);
    if ((map.getZoom() ?? 0) < PLACE_ZOOM - 2) map.setZoom(PLACE_ZOOM);
  }, [map, position]);
  return null;
}

/** Places API (New) autocomplete with session tokens (billing-friendly). */
function PlaceSearch({
  onPlace,
  error,
}: {
  onPlace: (place: Partial<BusinessLocation>) => void;
  error?: string;
}) {
  const places = useMapsLibrary("places");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<google.maps.places.PlacePrediction[]>([]);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const searchable = !!places && query.trim().length >= 3;
  const visible = searchable ? suggestions : [];

  useEffect(() => {
    if (!places || query.trim().length < 3) return;
    token.current ??= new places.AutocompleteSessionToken();
    const handle = setTimeout(async () => {
      try {
        const { suggestions: s } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
          {
            input: query,
            sessionToken: token.current!,
          },
        );
        setSuggestions(
          s
            .map((x) => x.placePrediction)
            .filter((p): p is google.maps.places.PlacePrediction => !!p),
        );
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [places, query]);

  async function choose(prediction: google.maps.places.PlacePrediction) {
    setOpen(false);
    setQuery(prediction.text.text);
    const place = prediction.toPlace();
    await place.fetchFields({
      fields: ["id", "displayName", "formattedAddress", "addressComponents", "location"],
    });
    token.current = null; // session ends after fetchFields
    const p = place.location;
    if (!p) return;
    onPlace({
      source: "google_place",
      place_id: place.id,
      formatted_address: place.formattedAddress ?? undefined,
      lat: roundCoord(p.lat()),
      lng: roundCoord(p.lng()),
      ...parseAddressComponents(place.addressComponents),
    });
  }

  return (
    <div className="relative">
      <FieldLabel htmlFor="placeSearch" required>
        Find your business on Google Maps
      </FieldLabel>
      <div className="relative flex items-center">
        <Icon
          name="search"
          className="pointer-events-none absolute start-3.5 text-icon-lg text-on-surface-variant"
        />
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
          placeholder="Café name or address, e.g. Artisan Brew Tunis"
          className={`w-full rounded-lg bg-surface-container-lowest py-3 ps-11 pe-4 text-body-md text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary-container focus:outline-none ${
            error ? "ring-2 ring-error" : ""
          }`}
        />
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
                  <span className="block text-body-sm font-semibold text-on-surface">
                    {s.mainText?.text ?? s.text.text}
                  </span>
                  <span className="block text-caption text-on-surface-variant">
                    {s.secondaryText?.text}
                  </span>
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

/* ── Coordinates (fallback, and "not on Google Maps") ─────────────────────── */

function ManualCoordinates({
  loc,
  update,
  errors,
  onSet,
  withCountry = false,
}: {
  loc: Partial<BusinessLocation>;
  update: (l: Partial<BusinessLocation>) => void;
  errors: Errors;
  onSet?: (lat: number, lng: number) => void;
  withCountry?: boolean;
}) {
  const [lat, setLat] = useState(loc.lat?.toString() ?? "");
  const [lng, setLng] = useState(loc.lng?.toString() ?? "");
  const valid =
    lat.trim() !== "" &&
    lng.trim() !== "" &&
    Math.abs(Number(lat)) <= 90 &&
    Math.abs(Number(lng)) <= 180 &&
    !Number.isNaN(Number(lat)) &&
    !Number.isNaN(Number(lng));

  function apply() {
    if (!valid) return;
    const la = roundCoord(Number(lat));
    const lo = roundCoord(Number(lng));
    if (onSet) onSet(la, lo);
    else update({ lat: la, lng: lo, source: "coordinates", place_id: undefined });
  }

  const body = (
    <div className="flex flex-col gap-sm">
      <div className={`grid grid-cols-1 gap-sm ${onSet ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <TextField
          id="latInput"
          label="Latitude"
          icon="explore"
          inputMode="decimal"
          placeholder="36.8065"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          onBlur={!onSet ? apply : undefined}
        />
        <TextField
          id="lngInput"
          label="Longitude"
          icon="explore"
          inputMode="decimal"
          placeholder="10.1815"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          onBlur={!onSet ? apply : undefined}
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
              Place pin
            </button>
          </div>
        ) : null}
      </div>
      {withCountry ? (
        <TextField
          id="countryCodeInput"
          label="Country code"
          icon="public"
          placeholder="TN"
          maxLength={2}
          required
          value={loc.country_code ?? ""}
          onChange={(e) => update({ country_code: e.target.value.toUpperCase() })}
          error={errors.country_code}
        />
      ) : null}
      {!onSet ? <FieldError id="latInput" message={errors.location} /> : null}
    </div>
  );

  return onSet ? (
    <details className="rounded-lg bg-surface-container-lowest p-sm">
      <summary className="cursor-pointer text-body-sm font-semibold text-primary">
        Enter coordinates instead
      </summary>
      <div className="pt-sm">{body}</div>
    </details>
  ) : (
    <div>
      <p className="mb-sm text-caption text-on-surface-variant">
        Map search is not configured. Enter your business coordinates and address.
      </p>
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
  return (
    <div className="flex flex-col gap-sm">
      {loc.formatted_address || loc.country ? (
        <div className="flex items-start gap-sm rounded-lg bg-surface-container-lowest p-sm">
          <Icon name="location_on" filled className="mt-0.5 text-icon-lg text-primary" />
          <div className="text-body-sm">
            <p className="font-semibold text-on-surface">
              {loc.formatted_address ?? "Selected location"}
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
        label="Street and number"
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
          label="Postal code"
          icon="markunread_mailbox"
          autoComplete="postal-code"
          placeholder="1000"
          value={loc.postal_code ?? ""}
          onChange={(e) => update({ postal_code: e.target.value })}
          error={errors.postal_code}
        />
        <TextField
          id="city"
          label="City"
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
