/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          600: '#0D7377',
          500: '#0F9488',
          400: '#4DB6A8',
          300: '#8FD4CA',
          200: '#C4E8E2',
          100: '#E8F6F3',
          50: '#F3FAF9',
        },
        danger: { 600: '#C21F1F', 500: '#DC2626', 400: '#EF4444' },
        warning: { 500: '#D97706', 400: '#F59E0B' },
        success: { 500: '#059669', 400: '#10B981' },
        info: { 500: '#2563EB', 400: '#3B82F6' },
        surface: {
          950: '#171A1A',
          900: '#25292A',
          800: '#333A3B',
          700: '#414849',
          600: '#4F5859',
          500: '#5E6667',
          400: '#768081',
          300: '#A3ADAE',
          200: '#D5DEDD',
          100: '#F0F4F4',
          50: '#F8FAFA',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        md: '0 4px 12px rgba(0,0,0,0.08)',
        lg: '0 8px 24px rgba(0,0,0,0.12)',
        'glow-teal': '0 0 24px rgba(15,148,136,0.3)',
        'glow-red': '0 0 24px rgba(220,38,38,0.3)',
        'glow-success': '0 0 24px rgba(5,150,105,0.3)',
      },
      zIndex: {
        float: '20',
        nav: '30',
        modal: '40',
        toast: '50',
        splash: '60',
        emergency: '70',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(15,148,136,0.2)' },
          '50%': { boxShadow: '0 0 24px rgba(15,148,136,0.5)' },
        },
        'pulse-scale': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        'pulse-glow': 'pulse-glow 1.5s ease-in-out 3',
        'pulse-scale': 'pulse-scale 1.5s ease-in-out 3',
      },
    },
  },
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-call
    require('tailwindcss-animate'),
  ],
}
