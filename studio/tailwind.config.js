/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        onyx: '#050505',
        graphite: '#0a0a0a',
        charcoal: '#111111',
        'bg-deep': '#030303',
        violet: '#7B5CF0',
        cobalt: '#4B6BF0',
        magenta: '#F04BD8',
        parchment: '#f5f5f7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    }
  },
  plugins: []
};
