/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          red: '#E66000',
          dark: '#2D3B45',
        },
      },
    },
  },
  plugins: [],
}
