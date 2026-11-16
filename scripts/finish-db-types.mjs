// Second step of `npm run db:types`: adds the header + helper types to the freshly generated
// Supabase types and replaces src/lib/supabase/database.types.ts.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "src", "lib", "supabase");
const tmp = join(dir, "database.types.tmp");
const generated = readFileSync(tmp, "utf8");
if (!generated.includes("export type Database")) {
  console.error(
    "db:types: generation failed (is SUPABASE_PROJECT_REF set and `supabase login` done?)",
  );
  process.exit(1);
}
const header = `// GENERATED from the Supabase database — do not edit by hand.
// Regenerate after every migration: \`npm run db:types\` (see README → Data access layer).

`;
const helpers = `
type PublicSchema = Database["public"];
export type DbFunctions = PublicSchema["Functions"];
export type DbFunctionName = keyof DbFunctions;
export type DbArgs<F extends DbFunctionName> = DbFunctions[F]["Args"];
export type DbReturns<F extends DbFunctionName> = DbFunctions[F]["Returns"];
`;
writeFileSync(tmp, header + generated.trimEnd() + "\n" + helpers);
renameSync(tmp, join(dir, "database.types.ts"));
console.log("db:types: src/lib/supabase/database.types.ts updated");
