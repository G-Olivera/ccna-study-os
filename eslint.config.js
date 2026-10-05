// eslint.config.js — formato "flat config" do ESLint 9.
// Projeto sem build step: cada js/*.js é um ES module carregado direto pelo
// navegador via <script type="module"> / import() dinâmico. service-worker.js
// é o único arquivo que roda em contexto de Service Worker, não de módulo.

import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    ignores: ["js/vendor/**", "node_modules/**"],
  },
  {
    files: ["**/*.js"],
    ignores: ["service-worker.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      // Dead code já foi varrido manualmente numa auditoria anterior, mas
      // prefira "warn" aqui: o objetivo é sinalizar, não travar o CI por
      // causa de um parâmetro de callback não usado (comum em handlers
      // Firebase/DOM deste projeto).
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["service-worker.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.serviceworker },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
