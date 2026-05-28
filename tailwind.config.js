/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Orbitron', 'sans-serif'],
      },
      colors: {
        neon: {
          green: '#39ff14',
          yellow: '#fbff00',
          red: '#ff073a',
          blue: '#00f3ff'
        },
        slate: {
          850: '#151e2e',
          900: '#0f172a',
          950: '#020617',
        }
      }
    }
  },
  plugins: [],
}
