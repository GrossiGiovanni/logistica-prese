import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Blu istituzionale Eurosarda (dal logo)
        brand: {
          50: "#eef0fa",
          100: "#dce1f5",
          200: "#b9c3ea",
          500: "#3d4fae",
          600: "#2b3990",
          700: "#222d73",
        },
      },
    },
  },
  plugins: [],
};

export default config;
