// Copies country flag SVGs (country-flag-icons, MIT) to public/flags/<CC>.svg so the phone
// country picker loads only the flags it shows. Runs on postinstall; public/flags is gitignored.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve("country-flag-icons/package.json")), "3x2");
const out = join(import.meta.dirname, "..", "public", "flags");
if (!existsSync(src)) {
  console.warn("copy-flags: country-flag-icons not installed, skipping");
  process.exit(0);
}
mkdirSync(out, { recursive: true });
const files = readdirSync(src).filter((f) => /^[A-Z]{2}\.svg$/.test(f));
for (const f of files) cpSync(join(src, f), join(out, f));
console.log(`copy-flags: ${files.length} flags → public/flags`);
