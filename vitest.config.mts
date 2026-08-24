import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(projectDirectory, "src"),
      "server-only": path.join(projectDirectory, "tests", "server-only.ts"),
    },
  },
  test: {
    environment: "node",
    testTimeout: 10_000,
  },
});

