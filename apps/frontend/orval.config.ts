import { defineConfig } from "orval";

export default defineConfig({
  kanso: {
    input: { target: "../backend/contracts/openapi.json" },
    output: {
      target: "src/api/generated/kanso.ts",
      schemas: "src/api/generated/model",
      client: "fetch",
      mode: "tags-split",
      clean: true,
      prettier: false,
      override: {
        mutator: { path: "src/api/http.ts", name: "http" },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
