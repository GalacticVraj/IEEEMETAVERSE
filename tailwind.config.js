/** @type {import('tailwindcss').Config} */

/*
 * GridGuard visual language — FROZEN. See docs/design/color.md and
 * docs/design/visual-language.md. Target: premium engineering operations
 * console (SCADA / Mission Control). Forbidden: neon, glassmorphism,
 * decorative gradients, oversized rounded cards.
 *
 * Every status color is SEMANTIC and traceable to a simulation state — never
 * decorative. Do not add a color here without a simulation meaning.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Control-room surfaces — graphite, low-chroma, high legibility.
        surface: {
          void: '#08090B', // deepest background / 3D clear color
          base: '#0E1216', // app background
          panel: '#141A20', // instrument panel
          raised: '#1B222A', // raised control
          border: '#232C35', // hairline dividers
        },
        // Text — instrument labels and telemetry readouts.
        ink: {
          primary: '#E6EDF3',
          secondary: '#9DAAB6',
          muted: '#66727E',
          inverse: '#0E1216',
        },
        // SEMANTIC grid/zone status — each maps to a simulation condition.
        status: {
          nominal: '#3FB68B', // powered / within limits
          caution: '#E0A64B', // approaching a limit
          warning: '#E07B39', // overloaded, pre-trip
          critical: '#D14B4B', // trip / cascade
          offline: '#556170', // de-energized / blackout
        },
        // Instrument accent — telemetry, selection, focus. Not decorative.
        instrument: {
          DEFAULT: '#4FA8C7',
          dim: '#2E6B82',
        },
      },
      fontFamily: {
        // Zero bundled font assets in Phase 1 — system stacks only.
        mono: [
          'ui-monospace',
          'JetBrains Mono',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        // Restrained radii — instrument panels, not consumer cards.
        instrument: '2px',
        panel: '4px',
      },
    },
  },
  plugins: [],
};
