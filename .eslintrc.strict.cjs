/**
 * ESLint config that approximates DeepSource + SonarQube rules.
 * Run with: bun run lint:strict  (or: bunx eslint --config .eslintrc.strict.cjs src/)
 *
 * DeepSource's JavaScript analyzer uses ESLint under the hood and supports
 * style_guide (e.g. "standard"). SonarQube rules are available via eslint-plugin-sonarjs.
 * This config enables rules that catch the kinds of issues both report.
 */
module.exports = {
  root: true,
  extends: [
    'react-app',
    'react-app/jest',
    'plugin:sonarjs/recommended',
  ],
  plugins: ['sonarjs'],
  overrides: [
    {
      files: ['src/**/*.{ts,tsx,js,jsx}'],
      rules: {
        // DeepSource JS-0050: use === and !==
        eqeqeq: ['error', 'always'],
        // Avoid console in browser code (DeepSource JS-0002)
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        // Object shorthand (DeepSource JS-0240)
        'object-shorthand': ['warn', 'always'],
        // Empty callbacks (DeepSource JS-0321)
        'no-empty-function': ['warn', { allow: ['arrowFunctions'] }],
        // Prefer named exports when re-exporting (DeepSource JS-P1003)
        'sonarjs/prefer-single-boolean-return': 'warn',
      },
    },
  ],
  ignorePatterns: [
    'build/',
    'node_modules/',
    'coverage/',
    '*.config.js',
    '*.config.cjs',
  ],
};
