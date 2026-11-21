// Installable-app icons (Home Screen / web app manifest), cropped from the brand logo's tile.
// Run: node scripts/app-icons.mjs  → public/icon-192.png, public/icon-512.png
import sharp from "sharp";

const SRC = "public/brand/serbi-logo.jpg";
// The rounded tile without the "SERBI" word under it.
const TILE = { left: 36, top: 14, width: 378, height: 378 };

for (const size of [192, 512]) {
  await sharp(SRC).extract(TILE).resize(size, size).png().toFile(`public/icon-${size}.png`);
  console.log(`public/icon-${size}.png`);
}
