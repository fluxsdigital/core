import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/.next/**", "**/next-env.d.ts", "**/coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  { files: ["**/*.test.cjs", "**/*.test.tsx"], languageOptions: { globals: globals.jest } },
  {
    files: ["**/*.test.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
