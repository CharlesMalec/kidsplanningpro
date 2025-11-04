/* Simple ESLint config for TS + React (no standard-with-typescript) */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: false
  },
  plugins: ['@typescript-eslint', 'import', 'promise', 'n'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:promise/recommended'
  ],
  settings: {
    'import/resolver': {
      typescript: { project: './tsconfig.json' }
    }
  },
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  rules: {
    'import/no-unresolved': 'off' // TS handles path alias '@/*'
  },
  ignorePatterns: ['dist', 'node_modules']
}
