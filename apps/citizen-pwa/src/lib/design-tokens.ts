// Color palette
export const colors = {
  primary: '#001e40',
  assuranceBg: 'linear-gradient(#fff5ef, #ffeee6)',
  successBg: '#dcfce7',
  successFg: '#16a34a',
  queuedBg: '#fef3c7',
  queuedFg: '#f59e0b',
  failedBg: '#fee2e2',
  failedFg: '#dc2626',
  surface: '#f5f7fa',
  card: '#ffffff',
} as const

// Typography
export const fonts = {
  primary: "'Inter', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
} as const

// Spacing scale
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
} as const

// Border radius
export const borderRadius = {
  sm: '8px',
  md: '10px',
  lg: '12px',
  xl: '14px',
  full: '9999px',
} as const

// Motion durations
export const motion = {
  fast: 100,
  normal: 300,
  slow: 400,
  slower: 600,
} as const
