# Payment method instructions — paste these into /admin

**Do this before launch. It is the single highest-value edit in the whole audit.**

Every payment method currently ends its instructions with a line telling the
customer to send the receipt **on WhatsApp**:

> ٧. ابعث الـ Screenshot على واتساب للرقم 24146409
> 7. Send the screenshot on WhatsApp to 24146409

The very next thing the app does is ask them to attach that same screenshot in
the checkout screen. 102 people have declared a transfer; 5 have attached a
receipt. Most of the missing 97 are not people who quit — they are people who
did exactly what the instructions told them and then had no reason to come back.

The screen has since been rebuilt so the receipt is attached on the same screen
as the account number. These instructions have to agree with it.

The original text is kept in `supabase/backups/payment_methods_instructions_2026-08-29.json`.

---

## What to change

In **/admin → payment methods**, for each of the four methods, make two edits.

### 1. The WhatsApp line → the upload line

| Method | Find | Replace with |
|---|---|---|
| d17, flouci, crypto | `ابعث الـ Screenshot على واتساب للرقم 24146409` | `حمّل الـ Screenshot هوني تحت في نفس الصفحة — منها نأكّدو الخلاص ونحلّولك الحساب` |
| bank | `ابعث الصورة على واتساب للرقم 24146409` | `حمّل الصورة هوني تحت في نفس الصفحة — منها نأكّدو الخلاص ونحلّولك الحساب` |

English, all four:

| Find | Replace with |
|---|---|
| `Send the screenshot on WhatsApp to 24146409` | `Upload the screenshot here on this page — that is how we confirm the payment and open your account` |
| `Send the screenshot to me on WhatsApp at +216 24146409` (d17 only) | same as above |

WhatsApp is still on the screen, as the "something went wrong?" link at the
bottom. It just stops being the instruction.

### 2. The amount → one number, no arithmetic

D17 and Flouci tell the customer to send `قيمة الطلب + معلوم التحويل (1%)` —
so someone buying the 129 DT plan is told to send 130.29, while the card
directly above says **تخلّص 129 DT** and the admin queue records 129. Mismatched
amounts are a rejection generator, and doing arithmetic mid-payment loses
people.

| Method | Find | Replace with |
|---|---|---|
| d17, flouci | `المبلغ: قيمة الطلب + معلوم التحويل (1%)` | `المبلغ: نفس المبلغ اللي ظاهر فوق — معلوم التحويل علينا` |
| d17 (en) | `The amount + fees (1%)` | `Amount: exactly the amount shown above — the transfer fee is on us` |
| flouci (en) | `Amount: order value + transfer fee (1%)` | `Amount: exactly the amount shown above — the transfer fee is on us` |
| bank | `المبلغ: قيمة الطلب` | `المبلغ: نفس المبلغ اللي ظاهر فوق` |
| bank (en) | `Amount: order value` | `Amount: exactly the amount shown above` |

At 1% of a 129 DT plan that costs about 1.3 DT per sale, against a step that
currently converts at 5%.

**Crypto is deliberately left alone** on the amount. The network fee is charged
by the network, not by us, and whether a USDT price is quoted in dinars or in
USDT is a pricing decision, not a copy fix. Only its WhatsApp line changes.
Its English text is also missing its title — worth adding
`How to send payment via USDT (Solana network)` at the top while you are in there.

---

## Also in /admin, one field

**Payment settings → offer label.** Clear `offer_label_en` and `offer_label_ar`.

They currently read "Limited-time offer" / "عرض لفترة محدودة", permanently, with
no deadline and no discount attached to them. Nothing renders that label any
more — the checkout screen stopped showing it, because a standing urgency badge
sitting beside genuinely honest savings (12% at three months, 25% at six) costs
credibility with exactly the sceptical buyer the page has to convince. Clearing
the fields keeps the data honest too.

`payment_settings.price_tnd` (89) and `compare_at_tnd` (149) are leftovers from
the old single-price checkout. Nothing reads them; prices come from
`subscription_plans`. Harmless, but do not go editing them expecting the
checkout to change.
