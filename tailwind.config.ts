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
        // Surfaces step up in lightness instead of carrying borders and glows:
        // a card is #1A1A1A on the #0F0F0F page, a control inside it #2C2C2E.
        surface: "#1A1A1A",
        surface2: "#2C2C2E",
        accent: {
          DEFAULT: "#C0DA1B",
          hover: "#A9C016",
        },
        ink: "#F8F8F8",
        // Solid greys rather than translucent white, so a label reads the same
        // on the page and on a card. Both pass 4.5:1 on #1A1A1A.
        muted: "#9A9AA0",
        subtle: "#8E8E93",
        hairline: "rgba(255,255,255,0.09)",
        border: "rgba(255,255,255,0.09)",
        /**
         * One colour per part of the coaching loop, so a ring, a chart or an
         * icon says which part of your day it belongs to before you read it.
         * Lime stays the brand and owns training; the rest join it. All six
         * pass 4.5:1 as text on #1A1A1A, and they differ in lightness as well as
         * hue so they stay apart for colour-blind users.
         */
        train: "#C0DA1B",
        fuel: "#FF9F43",
        protein: "#3DD6F5",
        sleep: "#A58BFF",
        body: "#FF6B8B",
        learn: "#5AA9FF",
        background: "#0F0F0F",
        foreground: "#F8F8F8",
        ring: "#C0DA1B",
      },
      fontFamily: {
        // --font-ui is Inter in English and Cairo in Arabic; see globals.css.
        sans: ["var(--font-ui)", "Inter", "Cairo", "system-ui", "sans-serif"],
        // Headings and buttons share the UI face now — one family, many
        // weights, the way native apps set type. Kept as its own token so the
        // 60-odd `font-display` call sites did not all have to change.
        display: ["var(--font-ui)", "Inter", "Cairo", "system-ui", "sans-serif"],
        // Big figures: Saira in English, Cairo in Arabic.
        num: ["var(--font-num)", "Saira", "Cairo", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "24px",
      },
      boxShadow: {
        // Neutralised rather than deleted: a drop shadow is invisible on a near-
        // black page and the lime glow was on everything, so nothing stood out.
        // Depth now comes from the surface steps above.
        card: "none",
        glow: "none",
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
