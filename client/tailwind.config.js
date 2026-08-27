/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // E-ink optimized palette - only grayscale
        'ink': {
          black: '#000000',
          dark: '#333333',
          medium: '#666666',
          light: '#999999',
          lighter: '#cccccc',
          white: '#ffffff',
        }
      },
      fontSize: {
        // Minimum 16px for E-ink readability
        'base': '16px',
        'lg': '18px',
        'xl': '20px',
        '2xl': '24px',
      },
      minWidth: {
        'touch': '48px',
      },
      minHeight: {
        'touch': '48px',
      }
    },
  },
  plugins: [],
}
