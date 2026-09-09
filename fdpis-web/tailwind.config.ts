import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Single restrained brand accent: deep teal.
        accent: {
          50: "#f0fbf9",
          100: "#d5f4ef",
          200: "#a9e8df",
          300: "#71d5c9",
          400: "#39bcae",
          500: "#0d9488", // chart-validated series step
          600: "#0f766e", // brand / UI step
          700: "#115e59",
          800: "#134e4a",
          900: "#0f3f3c",
        },
        ink: {
          50: "#f8f9fa",
          100: "#f1f3f4",
          200: "#e4e7e9",
          300: "#cdd2d6",
          400: "#9aa3aa",
          500: "#6b747c",
          600: "#4c545b",
          700: "#343b41",
          800: "#21262b",
          900: "#12161a",
        },
        // Semantic risk colours — only ever used where they carry meaning.
        risk: {
          good: "#0ca30c",
          warn: "#fab219",
          serious: "#ec835a",
          critical: "#d03b3b",
        },
        // Second categorical series slot (validated against accent-500).
        series2: "#eb6834",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        "metric-lg": ["2.75rem", { lineHeight: "1", letterSpacing: "-0.03em" }],
        "metric-xl": ["3.5rem", { lineHeight: "1", letterSpacing: "-0.035em" }],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(18 22 26 / 0.04)",
        lift: "0 4px 16px -4px rgb(18 22 26 / 0.10)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "grow-x": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 260ms cubic-bezier(0.22,1,0.36,1) both",
        "grow-x": "grow-x 320ms cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
