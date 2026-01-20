import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors for the dispatcher app
        dispatcher: {
          primary: '#3B82F6',    // Blue
          secondary: '#10B981',  // Green
          warning: '#F59E0B',    // Amber
          danger: '#EF4444',     // Red
          dark: '#1F2937',       // Gray-800
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}

export default config
