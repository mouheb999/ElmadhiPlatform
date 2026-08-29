# Payment method logos

The checkout picker draws each method's mark in this order:

1. **`payment_methods.logo_url`** — a file in this folder, set per method in
   /admin. Wins over everything below.
2. **`BRAND_MARKS`** in `src/components/checkout/brand-marks.tsx` — either a
   bundled file from this folder, or inline path data.
3. **A wordmark** — the brand's name in our own typeface, for a method nobody
   has drawn a mark for yet.

## What is here

| Method | Mark | Source |
|---|---|---|
| D17 | `d17.svg` | Redrawn from the app icon |
| Flouci | `flouci.svg` | Redrawn from the app icon |
| Wafacash | `wafacash.svg` | Redrawn from the brand mark |
| Western Union | inline path | simple-icons (CC0), brand colour `#FFDD00` |
| USDT | inline path | simple-icons (CC0), brand colour `#50AF95` |
| Bank transfer | glyph | No brand — it is a mechanism, not a product |

The three redrawn files are traced from the real marks rather than copied, so
they are close but not pixel-exact. If you have the official vectors, replacing
them is the right move — overwrite the file, same name, and nothing else
changes.

## Replacing one, or adding a new method's logo

1. Save the SVG here, e.g. `poste.svg`.
2. In **/admin → payment methods**, set that method's **Logo URL** to
   `/payment-logos/poste.svg` and save.

No deploy needed beyond shipping the file, and an uploaded path beats whatever
the code would otherwise draw.

## What the file should be

- **SVG**, roughly square. The picker renders it at 36×36 with `object-contain`
  and a few pixels of padding, so a wide wordmark letterboxes rather than crops.
  Where a brand's full logo is a symbol plus its name, use just the symbol —
  the name is already printed under the tile.
- **Full colour is fine.** Files are rendered as-is on a near-white tile, which
  is what the marks designed for white app icons need. The two inline marks are
  tinted instead, on a dark tile — that is why the grid mixes the two grounds.
- Check it small. Anything under about 8px of detail turns to mush at 36×36.

## Trademarks

These marks belong to their owners and appear only to identify the payment
methods this shop accepts. Some brands publish usage rules for their logo —
worth a look before shipping one, especially on colour and clear space.
