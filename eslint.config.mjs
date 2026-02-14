// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';

export default tseslint.config(
  // Ignore build outputs and dependencies
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.vite/**'],
  },

  // Base JS + TS
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // Vue rules (flat)
  ...pluginVue.configs['flat/recommended'],

  // Tell ESLint how to parse TS (incl. in .vue files)
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
      // Types are handled by TypeScript; avoid false positives on type names.
      'no-undef': 'off',
      // Disable HTML/template formatting rules
      'vue/max-attributes-per-line': 'off',
      'vue/html-self-closing': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-quotes': 'off',
      'vue/attributes-order': 'off',
      'vue/no-v-html': 'off',
      'vue/html-indent': 'off',
      "vue/attribute-hyphenation": "off",
    },
  },
  {
    files: ['**/*.{ts,tsx,js,cjs,mjs}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // Types are handled by TypeScript; avoid false positives on type names.
      'no-undef': 'off',
      'vue/no-unused-components': 'error'
    },
  },
);
