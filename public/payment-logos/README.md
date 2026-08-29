# Payment method logos

The checkout picker draws each method's mark in this order:

1. **`payment_methods.logo_url`** — a file in this folder. Wins over everything.
2. **`BRAND_MARKS`** in `src/components/checkout/brand-marks.tsx` — open path
   data for Western Union and Tether, from simple-icons (CC0), in each brand's
   own colour.
3. **A wordmark** — the brand's name in our typeface, for the marks that are
   not publicly redistributable as vectors.

## The three that need you

D17, Flouci and Wafacash are on (3). Nobody publishes their logos as open
vectors and they are not in any icon set, so they are set as wordmarks rather
than drawn from memory — a nearly-right logo is wrong in a way the customer
who uses that app every day will notice immediately, and it is somebody else's
trademark to get wrong.

To use the real ones:

1. Save the SVG here as `d17.svg`, `flouci.svg`, `wafacash.svg`.
   The brands' own sites are the right source; a press or media page usually
   has them. Failing that, open the site and export the logo from the page.
2. In **/admin → payment methods**, set that method's **Logo URL** to
   `/payment-logos/d17.svg` and save.

That is the whole change — no deploy needed beyond shipping the file.

## What the file should be

- **SVG**, square-ish. The picker renders it at 36×36 with `object-contain`
  and a little padding, so a wide wordmark will letterbox rather than crop.
- **Full colour is fine here.** Unlike the marks in `brand-marks.tsx`, an
  uploaded file is rendered as-is and not tinted.
- Check it against the dark surface (`#202020`). A logo with black lettering
  and no background disappears; use the light or reversed version if the brand
  publishes one.

## Trademarks

These marks belong to their owners and appear only to identify the payment
methods this shop accepts. Some brands publish usage rules for their logo —
worth a look before shipping one, especially on colour and clear space.
