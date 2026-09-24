// Flat config — ESLint 9. Kept intentionally lean: typescript-eslint
// recommended + react-hooks, with the noise rules that fight this codebase
// turned off explicitly rather than silently ignored.
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist*/**", "node_modules/**", "coverage/**"] },
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The game intentionally uses _-prefixed placeholder args in engine callbacks.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Non-null assertions are load-bearing in hot paths (typed arrays, map lookups after has()).
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);
