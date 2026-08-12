/**
 * Scoped to the new shadcn-based components only. `preflight` is disabled
 * because its global element reset (margins, border-box, etc.) would apply
 * to antd's markup too — antd ships its own reset, and stacking a second one
 * on top of it silently breaks unrelated components across the app.
 */
module.exports = {
  content: ['./src/components/ui/**/*.{ts,tsx}', './src/components/AnnotationGroupDisplaySettings.tsx'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
