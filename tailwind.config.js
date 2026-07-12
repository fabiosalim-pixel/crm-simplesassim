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
        sidebar: { DEFAULT: '#FFFFFF', dark: '#0B1220' },
        borda:   { DEFAULT: '#E2E8F0', dark: '#334155' },
        marca:   { gold: '#C9A84C', golddark: '#8A6D2A', navy: '#0F2044' },
      },
    },
  },
  plugins: [],
}
