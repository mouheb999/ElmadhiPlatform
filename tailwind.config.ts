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
        /*
         * The dark palette of native fitness apps, sampled from reference
         * screenshots rather than approximated: a pure black page, flat
         * #1C1C1E cards, #2C2C2E for chips and controls inside them. No
         * gradients, rims or shadows — the contrast between black and the card
         * is the whole effect.
         */
        bg: "#000000",
        surface: "#1C1C1E",
        surface2: "#2C2C2E",
        accent: {
          DEFAULT: "#A8FF00",
          hover: "#93E000",
        },
        ink: "#FFFFFF",
        // Solid greys, so a label reads the same on the page and on a card.
        // Both pass 4.5:1 on #1C1C1E.
        muted: "#98989F",
        subtle: "#8E8E93",
        hairline: "rgba(255,255,255,0.09)",
        border: "rgba(255,255,255,0.09)",
        /**
         * One colour per part of the coaching loop, taken from the same
         * reference: lime for training (the active tab and buttons), the
         * calorie pink for food (the Move ring's colour — calories, as there),
         * blue for protein, purple for weight (the step-count purple).
         *
         * Food uses the accessible pink (#FF375F) rather than the ring's raw
         * #FA114F, which reaches only 4.3:1 behind small text on a card; the
         * difference is barely visible and this one passes 4.5:1. Every colour
         * here passes as text on #1C1C1E.
         */
        train: "#A8FF00",
        fuel: "#FF375F",
        protein: "#00B1FF",
        sleep: "#7D7AFF",
        body: "#9D86E0",
        learn: "#0A84FF",
        // Errors and "over target" get a red of their own. They used to borrow
        // the pink, which is now food's colour.
        danger: "#FF453A",
        background: "#000000",
        foreground: "#FFFFFF",
        ring: "#A8FF00",
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
        card: "22px",
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
