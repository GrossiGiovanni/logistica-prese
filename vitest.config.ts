import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Test della logica pura (parser AS400, costi, warning, date, forecast).
// Nessun accesso al database: i test girano in isolamento.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Il fuso dei test NON deve coincidere con Roma: così i bug di fuso emergono.
    env: { TZ: "UTC" },
  },
});
