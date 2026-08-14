import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
        bg: "#0F0F0F",
        surface: "#202020",
        accent: {
          DEFAULT: "#C0DA1B",
          hover: "#7D8E10",
        },
        ink: "#F8F8F8",
        muted: "rgba(248,248,248,0.65)",
        hairline: "rgba(255,255,255,0.08)",
        border: "rgba(255,255,255,0.08)",
        background: "#0F0F0F",
        foreground: "#F8F8F8",
        ring: "#C0DA1B",
      },
      fontFamily: {
        sans: ["var(--font-cairo)", "Cairo", "Tajawal", "system-ui", "sans-serif"],
        // --font-brand is Saira in English and Cairo in Arabic; see globals.css.
        display: [
          "var(--font-brand)",
          "var(--font-cairo)",
          "Cairo",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "28px",
      },
      boxShadow: {
        card: "0 10px 40px rgba(0,0,0,0.35)",
        glow: "0 0 80px rgba(192,218,27,0.25)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
