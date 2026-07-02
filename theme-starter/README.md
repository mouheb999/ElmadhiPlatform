# ELMADHI theme-starter

Drop-in visual identity for the ELMADHI platform — identical colors, fonts, radii,
shadows, button styles and logo as the marketing landing page. Pulled token-for-token
from the live landing-page config.

## What's inside

```
theme-starter/
├─ tailwind.config.ts                 → copy to project root
├─ postcss.config.mjs                 → copy to project root
└─ src/
   ├─ app/
   │  ├─ globals.css                  → copy to src/app/globals.css (import in layout)
   │  └─ layout.example.tsx           → reference for wiring fonts + dark theme
   ├─ lib/
   │  ├─ utils.ts                     → cn() helper (used by Button + Logo)
   │  └─ fonts.ts                     → Cairo + Tajawal next/font setup
   └─ components/
      ├─ ui/button.tsx                → pill Button (primary / secondary / ghost)
      └─ layout/logo.tsx              → ELMADHI Logo + LogoMark
```

## Install (in your platform project)

1) Scaffold a Next.js 15 + TypeScript + Tailwind app if you haven't:

```
npx create-next-app@latest . --ts --tailwind --app --src-dir --import-alias "@/*"
```

2) Install the runtime deps these files need:

```
npm install clsx tailwind-merge class-variance-authority @radix-ui/react-slot lucide-react tailwindcss-animate
```

(Tailwind, PostCSS, autoprefixer come with create-next-app. Add `framer-motion`
when you start building animated screens, and `@supabase/ssr @supabase/supabase-js`
+ `next-intl` for data/auth/i18n.)

3) Copy the files to the matching paths (overwrite create-next-app's defaults):
   - `tailwind.config.ts` and `postcss.config.mjs` → project root
   - everything under `src/` → matching `src/` paths

4) Make sure `@/*` resolves to `src/*` in `tsconfig.json` (create-next-app does this
   with the import alias above).

5) Apply fonts + dark theme in your root layout — see `layout.example.tsx`. The key bits:
   - add `${cairo.variable} ${tajawal.variable}` to `<html className>`
   - `<body className="font-sans bg-bg text-ink antialiased">`
   - import `./globals.css`

## Using the tokens

Tailwind classes available everywhere:

- Colors: `bg-bg`, `bg-surface`, `text-ink`, `text-muted`, `bg-accent`,
  `hover:bg-accent-hover`, `border-hairline`, `ring-accent`
- Radius: `rounded-card` (28px)
- Shadow: `shadow-card`, `shadow-glow`
- Animation: `animate-fade-up`
- Helpers (from globals.css): `.container-page`, `.surface-card`, `.glow-accent`

Components:

```tsx
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/layout/logo";

<Logo />                         // mark + ELMADHI wordmark
<LogoMark className="h-9 w-9" /> // mark only
<Button>انضمّ</Button>           // primary pill
<Button variant="secondary" size="lg">المزيد</Button>
```

## Design tokens reference

| Token            | Value                          |
| ---------------- | ------------------------------ |
| bg               | #0F0F0F                        |
| surface          | #202020                        |
| accent           | #5DD62C                        |
| accent.hover     | #337418                        |
| ink (text)       | #F8F8F8                        |
| muted text       | rgba(248,248,248,0.65)         |
| border/hairline  | rgba(255,255,255,0.08)         |
| card radius      | 28px                           |
| card shadow      | 0 10px 40px rgba(0,0,0,0.35)   |
| glow             | 0 0 80px rgba(93,214,44,0.25)  |
| fonts            | Cairo (headings) + Tajawal     |

> The logo mark is a clean SVG recreation. For pixel-perfect artwork, drop the
> original at `public/logo.png` and swap `<LogoMark />` for a `next/image` `<Image>`.
