/**
 * The marks on the payment picker.
 *
 * Two kinds live here, and the difference matters:
 *
 *  - **Real logos**, for the brands whose marks are published as open path
 *    data. Western Union and Tether come from simple-icons (CC0), single-path
 *    and monochrome by design, so they take the brand's own colour cleanly on
 *    our dark surface. They are inlined rather than served from /public
 *    because a one-path glyph costs less as markup than as a request, and
 *    inlining is what lets `currentColor` tint them.
 *
 *  - **Wordmarks**, for the brands whose logos are not publicly redistributable
 *    as vectors: D17, Flouci, Wafacash. These are the brand's *name*, set in
 *    our own typeface on the brand's colour. That is a deliberate choice and
 *    not a placeholder for a missing asset: a logo redrawn from memory is
 *    wrong in a way that reads as amateurish to the exact customer who uses
 *    that app every day, and it is somebody else's trademark to get wrong.
 *
 * To use a real logo for those three: drop the file in `public/payment-logos/`
 * and put the path in the method's `logo_url` in /admin. The picker prefers it
 * over anything here, no code change needed. See the README in that folder.
 *
 * Trademarks belong to their owners. They appear here to identify the payment
 * methods this shop accepts, which is what they are for.
 */

/** Brand colours, from each brand's own guidance where it is published. */
export type BrandMarkSpec = {
  /** The brand's colour, used for the glyph and a tint behind it. */
  tint: string;
  /** Single-path logo, viewBox 0 0 24 24. */
  path?: string;
  /** Shown when there is no path: the brand's name, in our typeface. */
  word?: string;
  /** Tighter tracking for a longer word, so it still fits the tile. */
  tight?: boolean;
};

export const BRAND_MARKS: Record<string, BrandMarkSpec> = {
  // simple-icons, CC0. Brand colour from westernunion.com.
  western_union: {
    tint: "#FFDD00",
    path:
      "M15.799 5.188h5.916L24 9.155l-4.643 8.043c-1.246 2.153-3.28 2.153-4.526 0L7.893 5.188h5.919l4.273 7.39a1.127 1.127 0 0 0 1.981.002l-4.267-7.392ZM0 5.188h5.921l6.237 10.802-.697 1.204c-1.246 2.153-3.285 2.153-4.531 0L0 5.188Z",
  },
  // simple-icons, CC0. Brand colour from tether.to/branding.
  crypto: {
    tint: "#50AF95",
    path:
      "M18.7538 10.5176c0 .6251-2.2379 1.1483-5.2381 1.2812l.0028.0007c-.0848.0064-.5233.0325-1.5012.0325-.7778 0-1.33-.0233-1.5237-.0325-3.0059-.1322-5.2495-.6555-5.2495-1.2819s2.2436-1.149 5.2495-1.2834v2.0442c.1965.0142.7594.0474 1.5372.0474.9334 0 1.4008-.0389 1.4849-.0466V9.2356c2.9994.1337 5.2381.657 5.2381 1.282zm5.19.5466L12.1248 22.389a.1803.1803 0 0 1-.2496 0L.0562 11.0635a.1781.1781 0 0 1-.0382-.2079l4.3762-9.1921a.1767.1767 0 0 1 .1626-.1026h14.8878a.1768.1768 0 0 1 .1612.1032l4.3762 9.1922a.1782.1782 0 0 1-.0382.2079zm-4.478-.4038c0-.8068-2.5515-1.4799-5.9473-1.6369V7.195h4.186V4.4055H6.3076V7.195h4.1852v1.8286c-3.4018.1562-5.9601.83-5.9601 1.6376 0 .8075 2.5583 1.4806 5.9601 1.6376v5.8618h3.025v-5.8639c3.394-.1563 5.948-.8295 5.948-1.6363z",
  },

  // Wordmarks. Colours sampled from each brand's public identity; the shapes
  // are ours, not theirs.
  d17: { tint: "#F5A623", word: "D17" },
  flouci: { tint: "#4C8DFF", word: "flouci", tight: true },
  wafacash: { tint: "#E8622D", word: "wafacash", tight: true },
};
