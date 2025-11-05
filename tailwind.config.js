/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "Noto Sans", "sans-serif",
        ],
      },
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d6eaff",
          200: "#b7d8ff",
          300: "#8ec1ff",
          400: "#62a2ff",
          500: "#3f84ff", // primary
          600: "#2e68db",
          700: "#2552af",
          800: "#1f448c",
          900: "#1e3a75",
        },
      },
      borderRadius: {
        xl: "1rem",
        '2xl': "1.25rem",
      },
      boxShadow: {
        soft: "0 2px 10px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};