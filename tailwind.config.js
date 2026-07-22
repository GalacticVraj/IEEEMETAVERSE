/** @type {import('tailwindcss').Config} */

/*
 * GridGuard visual language — doctrine v2: DAYLIGHT DIGITAL TWIN.
 * See docs/superpowers/specs/2026-07-22-experience-foundation-design.md.
 *
 * The 3D city reads like a daylight digital twin; the UI is a mission-control
 * overlay in neutral daylight surfaces. Forbidden as ever: neon, glassmorphism,
 * decorative gradients, oversized rounded cards, emoji iconography.
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
        // Daylight console surfaces — warm paper neutrals, high legibility.
        surface: {
          void: '#DDE3E8', // 3D clear-color fallback / horizon haze
          base: '#EEF0EF', // app background
          panel: '#FAFAF7', // instrument panel
          raised: '#FFFFFF', // raised control
          border: '#D3D7D2', // hairline dividers
        },
        // Text — instrument labels and telemetry readouts.
        ink: {
          primary: '#1C2530',
          secondary: '#5A6774',
          muted: '#8B97A3',
          inverse: '#FAFAF7',
        },
        // SEMANTIC grid/zone status — each maps to a simulation condition.
        status: {
          nominal: '#217A56', // powered / within limits
          caution: '#9A6B15', // approaching a limit
          warning: '#B4531F', // overloaded, pre-trip
          critical: '#B3261E', // trip / cascade
          offline: '#5F6B76', // de-energized / blackout
          recovery: '#217A56', // re-energization in progress
        },
        // Instrument accent — telemetry, selection, focus. Not decorative.
        instrument: {
          DEFAULT: '#22637E',
          dim: '#7FA6B8',
        },
      },
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'ui-monospace',
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
