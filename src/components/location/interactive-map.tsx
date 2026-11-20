"use client";

import { useTranslations } from "next-intl";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Icon } from "@/components/ui/icon";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, PLACE_ZOOM } from "@/config/maps";
import type { BusinessLocation } from "@/lib/location/address";

/** Must match TILE_ZOOM / NEARBY_MIN_ZOOM on the server (src/lib/maps/types.ts). */
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;
const NEARBY_MIN_ZOOM = 16;

type NearbyPlace = { id: string; name: string; icon: string; place: BusinessLocation };

type Props = {
  loc: Partial<BusinessLocation>;
  attribution?: string;
  /** Pin moved by a click on the map or by dragging the pin. */
  onPick: (lat: number, lng: number) => void;
  /** A café / restaurant marker on the map was chosen. */
  onSelectPlace: (place: BusinessLocation) => void;
};

const pinIcon = L.divIcon({
  className: "",
  html: '<span class="material-symbols-outlined icon-filled text-icon-3xl text-primary drop-shadow-md">location_on</span>',
  iconSize: [48, 48],
  iconAnchor: [24, 46],
  popupAnchor: [0, -40],
});

function placeIcon(icon: string, selected: boolean) {
  const colors = selected
    ? "bg-primary text-on-primary"
    : "bg-surface-container-lowest text-primary";
  return L.divIcon({
    className: "",
    html: `<span class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary shadow-md ${colors}"><span class="material-symbols-outlined text-icon-md">${icon}</span></span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

/**
 * Draggable, zoomable map (Leaflet). Tiles come from /api/maps/tiles and nearby cafés and
 * restaurants from /api/places/nearby — the provider key stays on the server.
 */
export default function InteractiveMap({ loc, attribution, onPick, onSelectPlace }: Props) {
  const t = useTranslations("location");
  const hasPin = typeof loc.lat === "number" && typeof loc.lng === "number";
  const [initial] = useState(() =>
    hasPin
      ? { center: [loc.lat!, loc.lng!] as [number, number], zoom: PLACE_ZOOM }
      : {
          center: [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng] as [number, number],
          zoom: DEFAULT_MAP_ZOOM,
        },
  );
  const [zoom, setZoom] = useState(initial.zoom);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  return (
    <div className="relative isolate overflow-hidden rounded-lg bg-surface-container shadow-sm">
      <MapContainer
        center={initial.center}
        zoom={initial.zoom}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        className="aspect-4/3 w-full cursor-crosshair sm:aspect-map"
        attributionControl
      >
        <TileLayer
          url="/api/maps/tiles/{z}/{x}/{y}{r}"
          attribution={attribution}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
        />
        <MapBehaviour
          loc={loc}
          onPick={onPick}
          onZoom={setZoom}
          onPlaces={setPlaces}
          onLoading={setLoadingPlaces}
        />
        {zoom >= NEARBY_MIN_ZOOM
          ? places.map((p) => (
              <Marker
                key={p.id}
                position={[p.place.lat, p.place.lng]}
                icon={placeIcon(p.icon, p.id === loc.place_id)}
              >
                <Popup>
                  <PlacePopup place={p} onSelect={() => onSelectPlace(p.place)} />
                </Popup>
              </Marker>
            ))
          : null}
        {hasPin ? (
          <Marker
            position={[loc.lat!, loc.lng!]}
            icon={pinIcon}
            draggable
            zIndexOffset={1000}
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                onPick(p.lat, p.lng);
              },
            }}
          />
        ) : null}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-sm z-1000 flex justify-center">
        <span className="flex items-center gap-xs rounded-full bg-surface-container-lowest/95 px-md py-xs text-caption font-semibold text-on-surface shadow-sm">
          {loadingPlaces ? (
            <Icon name="progress_activity" className="animate-spin text-icon-sm" />
          ) : null}
          {zoom < NEARBY_MIN_ZOOM ? t("zoomToSee") : hasPin ? t("tapOrDrag") : t("tapOrPlace")}
        </span>
      </div>
    </div>
  );
}

function PlacePopup({ place, onSelect }: { place: NearbyPlace; onSelect: () => void }) {
  const t = useTranslations("location");
  const map = useMap();
  return (
    <div className="flex flex-col gap-xs font-sans">
      <p className="text-body-sm font-semibold text-on-surface">{place.name}</p>
      {place.place.formatted_address ? (
        <p className="text-caption text-on-surface-variant">{place.place.formatted_address}</p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          onSelect();
          map.closePopup();
        }}
        className="mt-xs flex items-center justify-center gap-xs rounded-lg bg-primary px-sm py-xs text-body-sm font-semibold text-on-primary hover:bg-primary-container"
      >
        <Icon name="check" className="text-icon-md" />
        {t("thisIsMine")}
      </button>
    </div>
  );
}

/** Map events: click to pin, follow external pin changes, load nearby places. */
function MapBehaviour({
  loc,
  onPick,
  onZoom,
  onPlaces,
  onLoading,
}: {
  loc: Partial<BusinessLocation>;
  onPick: (lat: number, lng: number) => void;
  onZoom: (z: number) => void;
  onPlaces: (p: NearbyPlace[]) => void;
  onLoading: (b: boolean) => void;
}) {
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadNearby = useMemo(
    () => (map: L.Map) => {
      if (timer.current) clearTimeout(timer.current);
      if (map.getZoom() < NEARBY_MIN_ZOOM) return;
      timer.current = setTimeout(async () => {
        abort.current?.abort();
        const ctrl = new AbortController();
        abort.current = ctrl;
        const b = map.getBounds();
        const q = new URLSearchParams({
          west: b.getWest().toFixed(6),
          south: b.getSouth().toFixed(6),
          east: b.getEast().toFixed(6),
          north: b.getNorth().toFixed(6),
        });
        onLoading(true);
        try {
          const res = await fetch(`/api/places/nearby?${q}`, { signal: ctrl.signal });
          if (res.ok) onPlaces(((await res.json()) as { places: NearbyPlace[] }).places);
        } catch {
          /* aborted or offline — keep the previous markers */
        } finally {
          if (abort.current === ctrl) onLoading(false);
        }
      }, 400);
    },
    [onLoading, onPlaces],
  );

  const map = useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
    zoomend: () => onZoom(map.getZoom()),
    moveend: () => loadNearby(map),
  });

  // First load (e.g. editing an existing location at street zoom).
  useEffect(() => {
    loadNearby(map);
    return () => {
      abort.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [map, loadNearby]);

  // Pin set from outside (search result, typed coordinates): bring it into view.
  const lat = loc.lat;
  const lng = loc.lng;
  useEffect(() => {
    if (typeof lat !== "number" || typeof lng !== "number") return;
    const point = L.latLng(lat, lng);
    if (!map.getBounds().contains(point) || map.getZoom() < 15) {
      map.flyTo(point, Math.max(map.getZoom(), PLACE_ZOOM), { duration: 0.8 });
    }
  }, [map, lat, lng]);

  return null;
}
