/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // RBH brand palette — a deep "red bean" red on near-white. Use these
        // tokens instead of raw hex so a future rebrand is a one-line change
        // here. NOTE: this is the *identity* colour only — semantic status
        // colours (green = success / on-target, amber = at-risk, red-600 =
        // destructive) stay as Tailwind's own scales and are not brand red.
        primary: {
          DEFAULT: "#C1121F",
          light: "#FDE7E9",
          dark: "#8A0F19",
        },
        surface: "#FBF7F7",
      },
      // 3-tier elevation system — flat borders alone read as "unstyled default
      // Tailwind"; a soft, layered shadow is what makes cards/modals feel
      // designed. `card-hover` is the lift state for anything clickable.
      boxShadow: {
        xs: "0 1px 2px rgba(17,24,39,0.04), 0 1px 3px rgba(17,24,39,0.06)",
        card: "0 1px 3px rgba(17,24,39,0.06), 0 1px 2px rgba(17,24,39,0.04)",
        "card-hover": "0 4px 12px rgba(17,24,39,0.08), 0 2px 4px rgba(17,24,39,0.04)",
        modal: "0 20px 40px -8px rgba(17,24,39,0.25), 0 8px 16px -4px rgba(17,24,39,0.1)",
      },
      keyframes: {
        "modal-in": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "modal-in": "modal-in 180ms ease-out",
        "fade-in": "fade-in 150ms ease-out",
      },
    },
  },
  plugins: [],
};
