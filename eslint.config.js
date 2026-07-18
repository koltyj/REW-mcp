import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "prefer-const": "error",
      eqeqeq: ["error", "always"],

      // Task #16: surface unsafe casts and anonymous inline type assertions as
      // warnings. `objectLiteralTypeAssertions: "never"` flags `x as { ... }`
      // (anonymous object-literal assertions), steering code towards named or
      // generated types.
      "@typescript-eslint/consistent-type-assertions": [
        "warn",
        {
          assertionStyle: "as",
          objectLiteralTypeAssertions: "never",
        },
      ],

      // The type-aware rules below flag `any`/`unknown` leaking through casts and
      // API boundaries. They are kept at "warn" (not "error") so they highlight
      // the existing debt without blocking the build.
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-redundant-type-constituents": "warn",
      "@typescript-eslint/no-base-to-string": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/restrict-template-expressions": "warn",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/unbound-method": "warn",
    },
  },
  {
    ignores: [
      "dist/",
      "node_modules/",
      "**/*.test.ts",
      "vitest.config.ts",
      "eslint.config.js",
      "src/api/generated/",
    ],
  }
);
