import animate from 'tailwindcss-animate'

const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

/**
 * Custom scale keys added here must also be registered in src/lib/utils.ts so
 * tailwind-merge resolves conflicts between them.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        app: token('app'),
        panel: token('panel'),
        subtle: token('subtle'),
        selected: token('selected'),
        ink: {
          DEFAULT: token('ink'),
          body: token('ink-body'),
          secondary: token('ink-secondary'),
          muted: token('ink-muted'),
          faint: token('ink-faint'),
          fainter: token('ink-fainter'),
        },
        line: {
          DEFAULT: token('line'),
          soft: token('line-soft'),
          row: token('line-row'),
          input: token('line-input'),
          hover: token('line-hover'),
        },
        chip: {
          DEFAULT: token('chip'),
          foreground: token('chip-foreground'),
        },
        segmented: {
          DEFAULT: token('segmented'),
          active: token('segmented-active'),
        },
        'switch-off': token('switch-off'),
        viewport: {
          DEFAULT: token('viewport'),
          fluorescence: token('viewport-fluorescence'),
        },
        'overlay-card': token('overlay-card'),
        scrim: token('scrim'),
        syntax: {
          boolean: token('syntax-boolean'),
          string: token('syntax-string'),
        },
        ring: token('primary'),
        /** Logo tile background; matches public/favicon.svg in both themes */
        brand: token('brand'),
        primary: {
          DEFAULT: token('primary'),
          hover: token('primary-hover'),
          soft: token('primary-soft'),
          foreground: token('primary-foreground'),
        },
        destructive: {
          DEFAULT: token('destructive'),
          text: token('destructive-text'),
          soft: token('destructive-soft'),
          hover: token('destructive-hover'),
          foreground: token('destructive-foreground'),
        },
        success: token('success'),
        warning: {
          DEFAULT: token('warning'),
          soft: token('warning-soft'),
          text: token('warning-text'),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        /** Cards, menus and option tiles */
        card: '10px',
        /** Icon tiles in dialog headers */
        tile: '9px',
      },
      boxShadow: {
        segmented: '0 1px 2px rgb(var(--shadow-color) / 0.12)',
        tool: '0 1px 2px rgb(var(--shadow-color) / 0.14)',
        overlay: '0 2px 8px rgb(var(--shadow-color) / 0.08)',
        menu: '0 12px 32px rgb(var(--shadow-color) / 0.14)',
        modal: '0 24px 64px rgb(var(--shadow-color) / 0.22)',
        'selected-ring': '0 0 0 3px rgb(var(--primary) / 0.12)',
      },
      fontFamily: {
        sans: [
          'IBM Plex Sans',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'IBM Plex Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      /** Design type scale in px; sizes only, line height stays inherited */
      fontSize: {
        11: '11px',
        11.5: '11.5px',
        12: '12px',
        12.5: '12.5px',
        13: '13px',
      },
      spacing: {
        /** Default control height (buttons, inputs, icon tiles) */
        control: '34px',
      },
      width: {
        sidebar: '288px',
        'sidebar-right': '320px',
      },
      height: {
        header: '52px',
        toolbar: '48px',
        footer: '28px',
      },
    },
  },
  plugins: [animate],
}
