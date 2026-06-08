import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#15233F',
          700: '#1F3864',
          500: '#2E5C9A',
        },
        blue: {
          400: '#4F7FC4',
        },
        brand: {
          green: '#2E8B57',
          amber: '#E0A93B',
          red: '#C0392B',
        },
        band: {
          light: '#D9DEE7',
          dark: '#8A93A5',
        },
        // Semantic tokens (CSS variables defined in index.css)
        bg: 'var(--bg)',
        card: 'var(--card)',
        border: 'var(--border)',
        muted: 'var(--muted)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        accent: 'var(--accent)',
        rag: {
          green: 'var(--rag-green)',
          amber: 'var(--rag-amber)',
          red: 'var(--rag-red)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(21, 35, 63, 0.04), 0 1px 3px rgba(21, 35, 63, 0.06)',
        pop: '0 8px 28px rgba(21, 35, 63, 0.16)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.28s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
