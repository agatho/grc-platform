import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
  {
        plugins: { "react-hooks": reactHooks },
        rules: {
                "@typescript-eslint/no-unused-vars": "off",
                "@typescript-eslint/no-explicit-any": "off",
                "@typescript-eslint/no-empty-object-type": "off",
                "@typescript-eslint/no-require-imports": "off",
                "@typescript-eslint/triple-slash-reference": "off",
                "no-empty": "warn",
                "no-extra-boolean-cast": "warn",
                "prefer-const": "warn",
                "react-hooks/exhaustive-deps": "off",
                "react-hooks/rules-of-hooks": "warn",
        },
  },
  {
        ignores: [
                ".next/**",
                "node_modules/**",
                "coverage/**",
                "next-env.d.ts",
              ],
  },
  );
