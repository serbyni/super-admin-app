/** Web Mercator helpers to turn a click on a static map image into coordinates. */
const TILE = 256;

function project(lat: number, lng: number, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const s = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

function unproject(x: number, y: number, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng: ((((lng + 180) % 360) + 360) % 360) - 180 };
}

/**
 * Coordinates of a point clicked on a static map centred on `center` at `zoom`.
 * `dx`/`dy` are offsets from the image centre in the map's logical pixels.
 */
export function pointAtOffset(
  center: { lat: number; lng: number },
  zoom: number,
  dx: number,
  dy: number,
): { lat: number; lng: number } {
  const c = project(center.lat, center.lng, zoom);
  return unproject(c.x + dx, c.y + dy, zoom);
}
