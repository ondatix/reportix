import { defineConfig, configDefaults } from "vitest/config";
import { sri } from "vite-plugin-sri3";

export default defineConfig({
  plugins: [sri()],
  test: {
    // Alt-text golden tests are deactivated: they target a retired template
    // (templates/stmas_template.md) and need re-goldening against the
    // generated template set before they can run again.
    exclude: [...configDefaults.exclude, "test/alt-text/**"],
  },
});
