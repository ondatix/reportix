import { defineConfig, configDefaults } from "vitest/config";
import { sri } from "vite-plugin-sri3";

export default defineConfig({
  plugins: [sri()],
  test: {
    exclude: [...configDefaults.exclude],
  },
});
