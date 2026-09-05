/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: ['dist/', 'node_modules/', 'webview/out/', 'webview/.next/', 'coverage/'],
  overrides: [
    {
      files: ['*.config.js', '*.config.cjs', '*.config.mjs'],
      env: { node: true },
      parserOptions: { sourceType: 'script' },
      rules: { 'no-undef': 'off' },
    },
    {
      files: ['webview/**/*.{ts,tsx}'],
      env: { browser: true, es2022: true, node: true },
    },
  ],
};
