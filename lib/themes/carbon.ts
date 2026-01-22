// Carbon Theme - Vercel/Stripe inspired
// Ultra-minimal soft black with white/blue accent

export const carbon = {
  // Backgrounds
  bgBase: '#0a0a0a',
  bgSurface1: '#111111',
  bgSurface2: '#171717',
  bgSurface3: '#1f1f1f',
  bgHover: '#262626',

  // Borders
  border: '#262626',
  borderLight: '#333333',
  borderSubtle: '#1a1a1a',

  // Text
  textPrimary: '#EDEDED',
  textSecondary: '#888888',
  textTertiary: '#666666',
  textMuted: '#444444',

  // Accent - Clean blue (minimal use)
  accent: '#0070F3',
  accentLight: '#3291FF',
  accentBg: 'rgba(0, 112, 243, 0.1)',
  accentBorder: 'rgba(0, 112, 243, 0.25)',

  // Semantic
  success: '#50E3C2',
  successDark: '#0D9373',
  successBg: 'rgba(80, 227, 194, 0.1)',
  successBorder: 'rgba(80, 227, 194, 0.2)',

  warning: '#F5A623',
  warningBg: 'rgba(245, 166, 35, 0.1)',
  warningBorder: 'rgba(245, 166, 35, 0.2)',

  critical: '#EE0000',
  criticalBg: 'rgba(238, 0, 0, 0.1)',
  criticalBorder: 'rgba(238, 0, 0, 0.2)',

  // Component styles
  card: {
    background: '#111111',
    border: '1px solid #262626',
    borderRadius: '8px',
  },

  input: {
    background: '#171717',
    border: '1px solid #262626',
    borderRadius: '6px',
    color: '#EDEDED',
    placeholder: '#666666',
  },

  button: {
    primary: {
      background: '#EDEDED',
      color: '#0a0a0a',
      border: 'none',
    },
    secondary: {
      background: 'transparent',
      color: '#888888',
      border: '1px solid #262626',
    },
  },
} as const;

export type CarbonTheme = typeof carbon;
