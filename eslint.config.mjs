import js from "@eslint/js";
import tseslint from "typescript-eslint";
import premierepro from "@adobe/eslint-plugin-premierepro";

export default tseslint.config(
  { ignores: ["dist/**", "release/**", "node_modules/**", "scripts/**", "*.config.*"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Règles officielles Adobe : création d'actions dans lockedAccess /
  // executeTransaction, pas d'async dans une transaction, etc.
  premierepro.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { project: ["tsconfig.json", "tsconfig.test.json"], tsconfigRootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
