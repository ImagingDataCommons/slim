/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', './public/index.html'],
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

        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        primary: {
          DEFAULT: token('primary'),
          hover: token('primary-hover'),
          soft: token('primary-soft'),
          foreground: token('primary-foreground'),
        },
        secondary: {
          DEFAULT: token('secondary'),
          foreground: token('secondary-foreground'),
        },
        destructive: {
          DEFAULT: token('destructive'),
          text: token('destructive-text'),
          soft: token('destructive-soft'),
          hover: token('destructive-hover'),
          foreground: token('destructive-foreground'),
        },
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground'),
        },
        accent: {
          DEFAULT: token('accent'),
          foreground: token('accent-foreground'),
        },
        popover: {
          DEFAULT: token('popover'),
          foreground: token('popover-foreground'),
        },
        card: {
          DEFAULT: token('card'),
          foreground: token('card-foreground'),
        },
        success: {
          DEFAULT: token('success'),
          foreground: token('success-foreground'),
        },
        warning: {
          DEFAULT: token('warning'),
          soft: token('warning-soft'),
          text: token('warning-text'),
          foreground: token('warning-foreground'),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
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
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
      },
      spacing: {
        4.5: '1.125rem',
        13: '3.25rem',
        15: '3.75rem',
        18: '4.5rem',
        22: '5.5rem',
        72: '18rem',
        80: '20rem',
        88: '22rem',
        96: '24rem',
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
      minWidth: {
        sidebar: '288px',
        'sidebar-right': '320px',
      },
      maxWidth: {
        sidebar: '288px',
        'sidebar-right': '320px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'collapsible-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' },
        },
        'collapsible-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
          to: { height: '0' },
        },
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'collapsible-down': 'collapsible-down 0.2s ease-out',
        'collapsible-up': 'collapsible-up 0.2s ease-out',
        spin: 'spin 1s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
