/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#C0392B",
          dark: "#96291E",
          light: "#E57368",
          50: "#FDF1F0",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(17,24,39,0.04), 0 1px 3px rgba(17,24,39,0.06)",
        card: "0 1px 3px rgba(17,24,39,0.06), 0 1px 2px rgba(17,24,39,0.04)",
        "card-hover": "0 4px 12px rgba(17,24,39,0.08), 0 2px 4px rgba(17,24,39,0.04)",
        modal: "0 20px 40px -8px rgba(17,24,39,0.25), 0 8px 16px -4px rgba(17,24,39,0.1)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
