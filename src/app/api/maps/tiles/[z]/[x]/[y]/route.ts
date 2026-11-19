import { NextResponse, type NextRequest } from "next/server";
import { guard, TILE_ZOOM } from "@/lib/maps/server";

/**
 * GET /api/maps/tiles/{z}/{x}/{y}[@2x] — raster map tiles proxied with the server key.
 * Long-lived cache: tiles rarely change and the CDN/browser can reuse them.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/maps/tiles/[z]/[x]/[y]">) {
  const g = guard(request, "tiles", 1200);
  if ("response" in g) return g.response;
  if (!g.provider.tile) return NextResponse.json({ error: "not_supported" }, { status: 404 });

  const { z: zs, x: xs, y: ys } = await ctx.params;
  const retina = ys.endsWith("@2x");
  const z = Number(zs);
  const x = Number(xs);
  const y = Number(retina ? ys.slice(0, -3) : ys);
  const max = 2 ** z;
  if (
    ![z, x, y].every(Number.isInteger) ||
    z < TILE_ZOOM.min ||
    z > TILE_ZOOM.max ||
    x < 0 ||
    y < 0 ||
    x >= max ||
    y >= max
  ) {
    return NextResponse.json({ error: "invalid_tile" }, { status: 400 });
  }

  const upstream = await g.provider.tile(z, x, y, retina).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable",
    },
  });
}
