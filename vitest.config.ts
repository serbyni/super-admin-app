import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    // Its ESM uses extension-less imports (fine for Next's bundler, not for plain Node).
    server: { deps: { inline: ["@material/material-color-utilities"] } },
  },
});
