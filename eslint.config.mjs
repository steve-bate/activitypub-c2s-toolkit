// @ts-check
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from '@vue/eslint-config-typescript';

export default defineConfigWithVueTs(
  // Ignore build outputs and dependencies
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.vite/**'],
  },

  // Vue 3 essential rules
  pluginVue.configs['flat/essential'],

  // Official Vue+TS recommended config (type-checked)
  vueTsConfigs.recommendedTypeChecked,

  // Project-specific tweaks
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // You can keep or re-add any Vue HTML/template rules here
      'vue/max-attributes-per-line': 'off',
      'vue/html-self-closing': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-quotes': 'off',
      'vue/attributes-order': 'off',
      'vue/no-v-html': 'off',
      'vue/html-indent': 'off',
      'vue/attribute-hyphenation': 'off',
      // Example extra rule you had
      'vue/no-unused-components': 'error',
    },
  },
);
