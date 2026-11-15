// Fails when Tailwind arbitrary values (e.g. text-[14px], max-w-[36rem], bg-[#fff]) are used in src/.
// Add a token to src/app/globals.css (@theme) and use the named utility instead.
// Run: npm run lint:tokens
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../src", import.meta.url).pathname;
const EXT = /\.(tsx?|jsx?|mdx)$/;
// utility-[value]  e.g. text-[14px], hover:scale-[1.01], -translate-x-[3px]
const ARBITRARY = /(?<![\w/"'`])-?[a-z][\w-]*(?::[\w-]+)*-\[[^\]\s]+\]/g;
// Utilities whose brackets are not design values (e.g. data/aria variants written as data-[state=open]:).
const ALLOW = [/^(data|aria|supports|has|group|peer)-\[/];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : EXT.test(p) ? [p] : [];
  });
}

const problems = [];
for (const file of walk(ROOT)) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const match of line.matchAll(ARBITRARY)) {
        const cls = match[0].replace(/^.*?:(?=[^:]*-\[)/, "");
        if (ALLOW.some((re) => re.test(cls))) continue;
        problems.push(`${relative(process.cwd(), file)}:${i + 1}  ${match[0]}`);
      }
    });
}

if (problems.length) {
  console.error("Tailwind arbitrary values are not allowed. Add a token in src/app/globals.css:\n");
  console.error(problems.map((p) => `  ${p}`).join("\n"));
  process.exit(1);
}
console.log("No Tailwind arbitrary values found.");
