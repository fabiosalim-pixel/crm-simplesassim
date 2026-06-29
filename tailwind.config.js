/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas:  { DEFAULT: '#EEF1F5', dark: '#0F172A' },
        painel:  { DEFAULT: '#FFFFFF', dark: '#1E293B' },
        sidebar: { DEFAULT: '#0F2044', dark: '#0B1730' },
        borda:   { DEFAULT: '#E2E8F0', dark: '#334155' },
        marca:   { gold: '#C9A84C', navy: '#0F2044' },
      },
    },
  },
  plugins: [],
}
