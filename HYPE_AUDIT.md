# Hype Fitness: audit and relaunch plan

Date: 2026-11-11. Method: `tunisia-ecom-media-buying` skill (Scalini / Bechir), in its order of operations: **Offer → unit economics → structure → creative → read the data → scale.**

## 0. Read this first

**Verdict: this is a business problem first, a conversion problem second and an offer problem third. It is not an ads problem.** The ads were the last thing wrong, and I could not even audit them, because the ad data is not here.

**What this document is built on.** `audit-data/` does not exist in the repo: not in the working tree, not in any of the 16 remote branches, not in git history. The two live connectors do not fill the gap either:

| Source | What I found |
|---|---|
| `audit-data/` | Missing everywhere. |
| Supabase connector | Connected to a different app (a travel site: `safaris`, `destinations`, `visa_applications`). Not Hype Fitness. |
| Meta connector (Adspirer) | One account, "cylia ads". I could not confirm it is Hype's, and only 2 calls were left in the monthly quota, so I did not spend one on a guess. |
| Repo | Fully read. It holds one real measurement of the funnel, from `LAUNCH-AUDIT-2.md` (live database, 2026-08-29). |

So every number below is one of three kinds, and each is labelled:
- **[you]** a number you gave me in the brief.
- **[repo]** read from the code or from the 2026-08-29 audit. That audit predates the checkout redesign, so it describes the old flow.
- **[need]** a number I do not have. I did not guess any of these. The full list is in section 7.

Two parts of task 2 could not be run and I say so where they belong: the **Ad Position Analysis** (needs spend, CPM, frequency and CPA per ad set) and checkpoints 2 and 3 of the unit economics (need ad spend, sales and OPEX).

**One conflict to settle before anything else.** You wrote that the plans are 20 / 54 / 96 / 168 DT. The repo's latest commit on `main` (2026-09-22, migration `057_restore_original_pricing.sql`) sets them back to **49 / 129 / 219 DT** and takes the 12-month plan off sale. Either that migration was never applied to production, or the live prices are not the ones in your brief. The math below is shown for both.

Currency: 3 DT ≈ $1, the same rate the skill uses.

---

## 1. Repo audit: every step and every drop-off point

### 1.1 The path a cold visitor walks

This is the path the code builds today, with an ad pointed at `/start`.

| # | Screen | What the user must do | Drop-off risk |
|---|---|---|---|
| 0 | `/` home (only if the link points here) | Read a one-line hero, tap "Start" | Extra screen. Hero is functional: "Your personal coach for eating and training, without a coach." No proof, no price, no offer. |
| 1 | `/start` Q1 goal | Tap 1 of 4 | Low. Lands directly on a question, which is good. |
| 2 | Q2 gender | Tap | Low |
| 3 | Q3 age | Type + Next | Typing starts |
| 4 | Q4 height | Type + Next | |
| 5 | Q5 weight | Type + Next | Sensitive number |
| 6 | Q6 target weight | Type + Next | |
| 7 | Interstitial "gap" | Read + Next | |
| 8 | Q7 training days | Tap | |
| 9 | Q8 activity level | Tap | |
| 10 | Interstitial "mechanism" | Read + Next | |
| 11 | Q9 experience | Tap | |
| 12 | Q10 meals per day | Tap | |
| 13 | Q11 blocker | Tap | |
| 14 | Interstitial "blocker" | Read + Next | |
| 15 | "Building" animation | Wait | |
| 16 | Plan reveal (calories, macros, target date) | Read, tap "Unlock my plan" | **First mention that it costs money.** Q1 says "Free. No account, no card." |
| 17 | `/checkout` step 1 | Scroll past recap + app preview, pick a term, tap "Create my account" | **First time a price is seen**, 17 screens in. No testimonials on the page. |
| 18 | `/login?mode=signup` | Fill 4 fields: name, phone, email, password (Google sign-in adds a separate `/phone` screen) | Account wall right after the price |
| 19 | `/checkout` step 2 | Pick D17 / Flouci / crypto / bank, read the instructions | |
| 20 | **Leave the app** | Open D17 or Flouci, make the transfer | **Highest-risk step.** Nothing brings them back. |
| 21 | Take a screenshot | | |
| 22 | Come back, attach the screenshot, tap send | | Old flow: 102 said they paid, 5 attached a receipt **[repo]** |
| 23 | Wait for a human | Screen says "a few hours" | Measured average: **12.2 hours**, locked out the whole time **[repo]** |
| 24 | Account opens | Go to the dashboard | |
| 25 | Diet questionnaire (pre-filled from `/start`) | Confirm / complete | Second questionnaire after paying |
| 26 | Workout questionnaire | Answer | Third |
| 27 | First real use of the product | | |

**Count:** 16 screens before a price is shown, about **26 taps and typed fields before money moves** (19 in the questionnaire, 1 to pick a plan, 5 on the account form, 1 to pick a payment method), a forced exit from the app to pay, then a human-speed wait, then 2 more questionnaires. **27 steps from click to first use.**

**The path your ads actually used was longer.** Click-to-DM puts these in front of step 1: ad → open the DM → write a message → wait for a human reply → receive a link → tap it. That is about **32 steps**, with two separate waits on a human (the DM reply and the activation).

### 1.2 What the code gets right (keep it)

- `/start` opens on a question, with no welcome screen, and gives a real computed plan before asking for anything. In skill terms this is already a good cold-traffic entry.
- No account until the price. Answers are never asked twice.
- Receipt upload is now on the same screen as the account number (fix for the 102 → 5 leak).
- Full funnel tracking exists: `funnel_events` records every step from `landed` to `activated`.
- Meta is wired correctly for a Sales campaign: pixel events for Lead (reveal), InitiateCheckout (plan chosen), AddPaymentInfo (receipt uploaded), and a server-side **Purchase** through the Conversions API at activation, with the original ad click attached.

### 1.3 What is broken or missing

| # | Finding | Evidence |
|---|---|---|
| 1 | **Zero testimonials.** The page that asks a stranger for a bank transfer has no social proof at all. | `src/lib/social-proof.ts`: `TESTIMONIALS = []` |
| 2 | **Payment is manual and off-site.** No payment API. The webhook for Konnect/Flouci exists but is an unfinished TODO. | `src/app/api/webhook/payment/route.ts` |
| 3 | **The activation promise is not kept.** Copy says "within a few hours"; measured 12.2 h. | `co.promise`, `LAUNCH-AUDIT-2.md` |
| 4 | **No trial.** `REVERSE_TRIAL = false`: nobody uses the product before paying. | `src/lib/access.ts:48` |
| 5 | **The guarantee is not a risk reversal.** "If the plan does not fit, we rebuild it." No money back. "Cancel anytime" means nothing on a prepaid plan that never auto-renews. | `co.guarantee_*`, `co.cancel_*` |
| 6 | **No urgency or scarcity of any kind.** (The fake "limited offer" pill was rightly removed; nothing real replaced it.) | `checkout-client.tsx` |
| 7 | **No renewal engine.** No auto-renew, no automatic reminder. Renewals depend on you opening the admin "expiring" list and messaging people by hand. | `faq.a_auto`, `admin/subscriptions` |
| 8 | **No automatic chase of abandoned payments.** In August: 83 open requests worth 6,937 DT, 60 reachable by phone, 1 chased. | `LAUNCH-AUDIT-2.md` |
| 9 | **The ads never used any of this.** Click-to-DM campaigns do not optimise on the pixel or the Purchase event. The whole measurement stack built on 2026-09-19 sat unused. | your brief + `lib/funnel/track.ts` |
| 10 | **Price conflict** between your brief and the repo (see section 0). | migration 057 |

I could not verify from here: whether `NEXT_PUBLIC_META_PIXEL_ID` and `META_CAPI_ACCESS_TOKEN` are set in production, whether the payment-method instructions still tell people to send the receipt on WhatsApp (`docs/payment-method-instructions.md`), and which prices are live.

### 1.4 The only measured funnel (old flow, 2026-08-29) **[repo]**

| Stage | Count | Of signups |
|---|---:|---:|
| Signed up | 959 | 100% |
| Gave a phone number | 567 | 59.1% |
| Tapped "I've transferred" | 102 | 10.6% |
| Sent a receipt in the app | 5 | 0.5% |
| Subscribed | 7 | 0.7% |

959 accounts produced 7 subscribers. This was before the `/start` funnel and the merged receipt screen. There is no measurement of the new flow in the repo.

---

## 2. The data audit

### 2.1 How the skill's terms map to a subscription

| Skill term (COD) | Hype Fitness |
|---|---|
| AOV | Average first payment, weighted by plan mix **[need]** |
| COGS | Influencer share + AI/API cost per user + hosting per user |
| Shipping / packaging | None. Payment fees: the 1% D17/Flouci fee if you absorb it |
| Returns | Refunds and rejected payments |
| Confirmation rate | Checkout started → actually paid |
| Delivery rate | Paid → activated and not refunded |
| Repeat purchases | Renewal rate and LTV |
| "Platform purchase" | The event Meta counts. With Purchase sent at activation, platform CPA = real CPA. With InitiateCheckout as the event, the confirmation × delivery discount applies. |

### 2.2 Checkpoint 1: gross margin (target 70–80%+)

**Formula:** gross margin = (AOV − COGS − fees − refunds) ÷ AOV

The influencer share alone decides this checkpoint, so it can be computed from your numbers:

| Influencer share **[you]** | Gross margin before AI, hosting, fees, refunds | vs 70% target |
|---|---|---|
| 40% | 60% | fails by 10 points |
| 45% | 55% | fails by 15 points |
| 50% | 50% | fails by 20 points |

AI, hosting and refunds **[need]** only push it lower.

In dinars, per sale, before AI and hosting:

| Plan | Price | Gross profit at 40% share | at 50% share |
|---|---|---|---|
| 1 month (your brief) | 20 DT ($6.67) | 12 DT ($4.00) | 10 DT ($3.33) |
| 3 months | 54 DT ($18) | 32.4 DT ($10.80) | 27 DT ($9.00) |
| 6 months | 96 DT ($32) | 57.6 DT ($19.20) | 48 DT ($16.00) |
| 12 months | 168 DT ($56) | 100.8 DT ($33.60) | 84 DT ($28.00) |
| 1 month (repo) | 49 DT ($16.33) | 29.4 DT ($9.80) | 24.5 DT ($8.17) |
| 3 months (repo) | 129 DT ($43) | 77.4 DT ($25.80) | 64.5 DT ($21.50) |
| 6 months (repo) | 219 DT ($73) | 131.4 DT ($43.80) | 109.5 DT ($36.50) |

**Result: FAIL.** And it trips Bechir's product kill rule: **COGS ≈ 50% of price → won't scale** (he killed a product at a $2.25 CPA for exactly this). The scalable zone is COGS under 25%. Your COGS is 40–50% before a single API call. The skill's instruction for this checkpoint is: *fix COGS or price first; scaling makes the loss bigger.*

To pass: the share must be **≤ 30% minus your AI and hosting cost** for a 70% margin, and **≤ about 20%** to reach the "COGS < 25%" zone.

### 2.3 Checkpoint 2: LTGP : Marketing CAC (target 2.0+)

**Formula:** marketing CAC = (ad spend + production + UGC + agency) ÷ paying customers. LTGP:CAC = lifetime gross profit per customer ÷ marketing CAC.

**Cannot be computed: ad spend and sales are [need].** What can be computed is the ceiling it sets. With no renewal data, LTGP is the gross profit of the first payment:

| First payment | Gross profit (40–50% share) | Max CAC for a 2.0 ratio |
|---|---|---|
| 20 DT | 10–12 DT | **5–6 DT ($1.67–2.00)** |
| 54 DT | 27–32.4 DT | 13.5–16.2 DT ($4.50–5.40) |
| 49 DT (repo) | 24.5–29.4 DT | 12.25–14.7 DT ($4.08–4.90) |
| 129 DT (repo) | 64.5–77.4 DT | 32.25–38.7 DT ($10.75–12.90) |

At 20 DT you have at most **$2 to acquire a paying subscriber**: a person who clicked, answered 11 questions, made an account, left the app, made a bank transfer and uploaded a screenshot. Renewals would raise this ceiling, but the renewal rate is **[need]** and the app has no renewal engine (finding 7).

### 2.4 Checkpoint 3: net profit (target 25%+ net)

**Formula:** real CAC = marketing CAC + OPEX per order. Net profit = gross profit − real CAC.

**Cannot be computed: OPEX is [need].** Note that your own time is OPEX here: every sale is activated by hand, and every DM was answered by hand.

### 2.5 Target CPA and target platform CPA

**Formulas:**
- Target CPA = AOV × max ad spend %
- Target platform CPA = target CPA × confirmation rate × delivery rate

**Target CPA** (cost per paying subscriber), three ad-spend options as in the SmileKit example:

| First payment | 15% | 25% | 30% |
|---|---|---|---|
| 20 DT | 3.0 DT ($1.00) | 5.0 DT ($1.67) | 6.0 DT ($2.00) |
| 54 DT | 8.1 DT ($2.70) | 13.5 DT ($4.50) | 16.2 DT ($5.40) |
| 96 DT | 14.4 DT ($4.80) | 24 DT ($8.00) | 28.8 DT ($9.60) |
| 49 DT (repo) | 7.35 DT ($2.45) | 12.25 DT ($4.08) | 14.7 DT ($4.90) |
| 129 DT (repo) | 19.35 DT ($6.45) | 32.25 DT ($10.75) | 38.7 DT ($12.90) |
| 219 DT (repo) | 32.85 DT ($10.95) | 54.75 DT ($18.25) | 65.7 DT ($21.90) |

With a 40–50% share, 25% on ads leaves 25–35% for AI, hosting, your time and profit. 30% leaves 20–30%. So 25% is the highest I would use, and only after the share is renegotiated. Your real AOV depends on plan mix **[need]**.

**Target platform CPA** (cost per *checkout started*, the equivalent of a COD order). Confirmation and delivery rates on the current flow are **[need]**. The only measurement is the old flow: 102 payment requests started → 7 subscribers = **6.9% confirmation** **[repo]**.

At that old rate, for a 20 DT sale and 25% ad spend:
5.0 DT × 0.069 × 1.0 = **0.34 DT ≈ $0.11 per checkout started.**

No campaign in Tunisia delivers a checkout start for 11 cents. This single line is the diagnosis: at the old confirmation rate, no ad could have been profitable. The table shows what the target becomes as the confirmation rate improves (delivery rate taken as 100%, so these are upper bounds; this is a sensitivity table, not a forecast):

| Target CPA | at 6.9% (old, measured) | at 30% | at 50% | at 70% |
|---|---|---|---|---|
| 5 DT (20 DT plan, 25%) | 0.34 DT ($0.11) | 1.5 DT ($0.50) | 2.5 DT ($0.83) | 3.5 DT ($1.17) |
| 13.5 DT (54 DT plan, 25%) | 0.93 DT ($0.31) | 4.05 DT ($1.35) | 6.75 DT ($2.25) | 9.45 DT ($3.15) |
| 32.25 DT (129 DT plan, 25%) | 2.2 DT ($0.74) | 9.7 DT ($3.23) | 16.1 DT ($5.38) | 22.6 DT ($7.53) |

### 2.6 Ad Position Analysis

**Not run. No ad data.** It needs, per ad set over a 7-day window: spend, CPM, frequency, cost per real purchase. Send the Ads Manager export (section 7) and I will fill this table:

| Ad set | Spend | Spend share | CPM | Frequency | Cost per DM | Real sales | Real CPA | True role (TOFU/MOFU/BOFU) | Decision |
|---|---|---|---|---|---|---|---|---|---|

What I can say from the brief alone, without numbers:
- **Wrong objective.** The skill's structure is objective Sales, conversion location Website, event Purchase. Click-to-DM optimises for conversations, so Meta found people who message, not people who pay. "Lots of DMs, few sales" is the campaign doing what it was asked to do.
- **One concept.** Everything was built around the AI meal scan. The skill wants 3–4 concepts, one per ad set, 3 hooks each, spread across the funnel. One feature-led concept covers no funnel stage reliably.
- **A feature is not a desire.** The meal scan is a mechanism. It attracts curiosity, and curiosity sends DMs.

### 2.7 The 7-question offer audit

The skill files state the rule ("under 4 Strong answers → fix the offer before touching the ads") but do not list the seven questions word for word. I built them from the three components of a cold friendly offer that the skill does define (desire, value stack, persuasion). If you have Bechir's worksheet, send it and I will re-score against his exact wording.

| # | Question | Score | Evidence |
|---|---|---|---|
| 1 | Does it sell ONE mass-market desire (attractiveness, status, belonging, health)? | **Weak** | Ads sold a feature (meal scan). Hero sells "a coach without a coach". Nothing sells the body the buyer wants. |
| 2 | Is perceived value 5–10× the price, without competing on price? | **Weak** | The only lever pulled was price: 49 → 20 DT, a 59% cut. No value anchor anywhere. |
| 3 | Is it framed as a complete solution (bundle, named transformation)? | **Medium** | The product is complete (training + nutrition + scan + weekly adjustment + coach Q&A), but it is sold as "full access, choose how long". |
| 4 | Real social proof and authority? | **Weak** | 0 testimonials. The influencer was the authority and has stopped posting. |
| 5 | A guarantee that removes the risk? | **Weak** | "We rebuild your plan." No money back, on a transfer sent to a stranger. |
| 6 | Real scarcity or urgency? | **Weak** | None. |
| 7 | Certainty (what happens, how fast, what result)? | **Medium** | Steps are well explained, but "a few hours" was 12.2 h in practice. |

**Strong answers: 0 of 7.** Under 4 → fix the offer before touching the ads.

---

## 3. Diagnosis: why it is not profitable, ranked

| Rank | Reason | The number that proves it | Type |
|---|---|---|---|
| 1 | **The revenue share makes the margin unscalable.** | 40–50% share → gross margin 50–60% at best, against a 70% minimum. COGS sits at Bechir's "≈50% → won't scale" line. The partner has also stopped producing content, so you pay a top-of-funnel cost and get no top of funnel. | **Business** |
| 2 | **The price is too low to buy cold traffic.** | A 20 DT sale leaves 10–12 DT gross profit, so a paying subscriber must cost under 5–6 DT ($1.67–2.00) to hit LTGP:CAC 2.0. Target CPA at 25% = 5 DT ($1.67). | **Business / offer** |
| 3 | **Checkout does not close.** | 959 signups → 7 subscribers (0.7%). 102 said they paid → 5 receipts. 12.2 h average wait. 83 open requests worth 6,937 DT, 1 chased. At the measured 6.9% confirmation rate the target cost per checkout start is $0.11. (Old flow; the new flow is unmeasured.) | **Conversion** |
| 4 | **The path is about 32 steps with two waits on a human.** | 27 steps from `/start` to first use, plus about 5 for the DM. 16 screens before a price is shown. | **Conversion** |
| 5 | **The offer has nothing that closes a stranger.** | 0 of 7 Strong. 0 testimonials. No money-back guarantee. No urgency. | **Offer** |
| 6 | **Lifetime value is unknown and unmanaged.** | No auto-renew, no reminder, renewal rate **[need]**. Without renewals, the first payment is the whole LTV. | **Business** |
| 7 | **The campaign was set to buy conversations.** | Click-to-DM objective, one concept. Cost per DM, DM → sale rate and CPA are **[need]**. | **Ads structure** |

**Said plainly, as the skill requires:** reasons 1, 2 and 6 are business problems, 3 and 4 are conversion problems, 5 is an offer problem. Only reason 7 is about the ads, and it is last. With a 50–60% margin, a 20 DT ticket and a checkout that closed under 7% of the people who started paying, **no creative and no targeting could have made this profitable.** Relaunching the same ads, or better ads, into the same business would lose money faster.

---

## 4. Relaunch plan

Follows the skill's order. Phases 0–2 cost no ad spend, and the ads should stay off until they are done.

### Phase 0: fix the business (before any ad)

1. **Renegotiate the influencer share.** This is the gate. Options, in order of preference:
   - Pay per piece of content delivered (a flat fee per video), with paid-ad usage rights in writing. They stopped posting; a share of everything is no longer earned.
   - Or a share only on sales that carry their code or come from their content.
   - Or cut the blanket share to **≤ 20%**, which puts COGS under the 25% line.
   - If none of these is possible, the honest answer from the skill is that paid ads cannot scale this business, and it should run on organic and referrals only.
2. **Decide the price ladder** (section 4, phase 1) and make the database match it.
3. **Measure the real cost per user**: AI calls per active user per month × price per call, plus hosting ÷ active users.

### Phase 1: the new cold friendly offer

**A. One mass-market desire: attractiveness.** Sell the body, not the app. "The body you want by [date]", where the date is the one the plan reveal already computes for each visitor. The meal scan moves from the headline to the proof that it is easy.

**B. Value stack: a named transformation, not "access".**

Name: **"تحدّي 90 يوم" (the 90-day challenge)**. Default plan = 3 months, because that is how long a visible result takes, and because the AOV is what sets your target CPA.

| In the stack | Already built? |
|---|---|
| Training program built from your answers (gym or home) | Yes |
| Nutrition plan with Tunisian food, at your budget | Yes |
| Photo meal scan: photograph the plate, get the macros | Yes |
| Weekly review that changes the plan when you stall | Yes |
| A real coach answering in Derja | Yes |
| Bonus: a one-page weekly grocery list for your plan | Small build |
| Bonus: a day-1 to day-90 progress photo tracker | Check-ins exist; small build |

Show the stack with each line's standalone value next to it and the total against the price, so perceived value reads 5–10× the price. Anchor against what a human coach costs for 3 months. I need the real price you would quote for that **[need]**; I will not invent one.

**Price:** stop competing on price. The 49 → 20 DT cut did not fix sales (the funnel numbers above are from the 49 / 129 / 219 era, and your brief reports few sales with the 20 DT ladder too). My recommendation is to relaunch on the repo ladder, with the 3-month plan pre-selected and badged:

| Plan | Price | Role |
|---|---|---|
| 1 month | 49 DT | Decoy / low-commitment entry |
| **3 months: the 90-day challenge** | **129 DT** | **Default** |
| 6 months | 219 DT | Upsell |

This is a recommendation, not a measured result. Test it for free on your existing list first (phase 2, step 6).

**C. Persuasion.**

| Element | What to do | Condition |
|---|---|---|
| Social proof | Get 3 real testimonials from current and past subscribers before launch. Offer a free month for a short video or a screenshot of their progress. Put them in `TESTIMONIALS`. | Real people only, with permission |
| Authority | Name and show the coach who writes the programs and answers questions. | |
| Guarantee | **7-day money back**: "Try it 7 days. If it is not for you, we refund you on D17, no questions." | Your decision; refunds lower the "delivery rate", so track them |
| Scarcity | Real only: limit new members per week to what you can activate and coach by hand, and say the number. | Must be true |
| Urgency | A founding-member price with a real end date, after which the price really goes up. | Must be true |
| Certainty | Promise an activation time you can keep, with hours: for example "activated within 2 hours, 9:00–22:00". | Only once you can hit it |

### Phase 2: fix the funnel

In order of impact:

1. **Send ads to `/start`, not to DMs.** The site already does what the DM conversation was doing, without a human. Keep WhatsApp as the help link only.
2. **Kill the activation wait.** Best: finish the Flouci or Konnect payment API (the webhook is half-built) so payment is confirmed instantly. Interim: open the account the moment a receipt is uploaded, verify afterwards, and revoke if the receipt is fake. The 12-hour lock-out disappears either way.
3. **Chase every unpaid checkout within 2 hours** on WhatsApp. The phone number is already collected at signup.
4. **Show the price range earlier.** One line on the reveal screen ("from X DT a month") so the price is not a surprise at screen 17.
5. **Fill the proof and the guarantee** on `/checkout` (phase 1, part C).
6. **Test the new offer on the warm list for free.** You have 959+ signups and a broadcast script (`scripts/waitlist-broadcast/`). Send them the 90-day offer. This measures the new confirmation rate without spending a dinar on ads. **Gate: do not turn ads on until checkout started → paid is measured on the new flow.**
7. **Build the renewal engine:** an automatic WhatsApp message 7 days and 1 day before a term ends.
8. **Confirm in production:** pixel ID and Conversions API token set, the payment instructions no longer send people to WhatsApp, and the prices match the offer.

I can implement items 2 (interim version), 4, 5 and 7 in this repo if you want them; none are done in this pass.

### Phase 3: target CPA

Use the formulas from section 2.5 once the inputs exist:

- **Target CPA = AOV × 25%**
- **Target platform CPA = target CPA × (checkout started → paid) × (paid → activated and not refunded)**

Worked example, to be replaced with your real rates. If the default plan is 129 DT and the mix gives an AOV of 129 DT: target CPA = 129 × 25% = **32.25 DT ($10.75)** per paying subscriber. If the warm-list test shows 50% of checkout starts pay and 95% of payments stay (no refund): target platform CPA = 32.25 × 0.50 × 0.95 = **15.3 DT ($5.11)** per InitiateCheckout. The 50% and 95% are placeholders to show the arithmetic.

With Purchase reported at activation (which the code does), judge the campaign on **cost per Purchase vs target CPA**, and use the InitiateCheckout number as the early signal.

### Phase 4: campaign structure

| Setting | Value |
|---|---|
| Campaigns | **1 CBO = 1 offer** |
| Name | `CONVERSIONS – HYPE 90J – TUN` |
| Objective | Sales |
| Conversion location | Website (`/start`), with UTMs |
| Performance goal / event | Maximize conversions · **Purchase** |
| Bid strategy | Highest volume |
| Attribution | 7-day click / 1-day view |
| Targeting | Broad, Tunisia |
| Placements | Advantage+ |
| Ad sets | **3, one concept each** |
| Ads per ad set | **3 = the same concept with Hook 1 / 2 / 3**, each with 2–3 primary texts and headlines |

Ad set names:
- `ADSET 1 – VIDEO – MAKLA TOUNSIA` (TOFU, emotional)
- `ADSET 2 – VIDEO – PLAN FI 2 MIN` (MOFU, functional)
- `ADSET 3 – VIDEO – COACH VS HYPE` (BOFU, offer and objections)

Ad names: `AD V1 – MAKLA TOUNSIA – HOOK PROBLEM`, `AD V2 – … – HOOK BEFORE AFTER`, `AD V3 – … – HOOK RESULT`.

**My own adaptation, not Bechir's:** Purchase fires only when a human activates the account, so volume will be low at the start. Launch on Purchase as the skill says. If the campaign produces fewer than about 10 purchases in the first 7 days, switch the optimisation event to AddPaymentInfo (receipt uploaded) and keep judging on real purchases.

**Starting budget [need]:** I need your target CPA (so, your AOV and confirmation rate) and what you can afford to lose on a test. The skill's demo campaign runs at $20/day; treat the first 7–10 days as a minimum viable test, not a launch.

### Phase 5: three creative briefs

One brief = one concept. Hooks follow the skill: Hook 1 = show the problem, Hook 2 = before and after, Hook 3 = desired result. Scripts are in Tunisian Derja. `[PRICE]`, `[DATE]` and names are placeholders for real values.

Rule for all three: **no invented results.** Any "before and after" of a body must be a real customer with permission. Where there is none yet, the before/after is the situation (confused → has a plan), which is true for every user.

Steps 5.1–5.3 of the skill's creative research (ad account audit table, Audience Insight Table from real comments, 3 competitors) need your ad export and DM/comment history **[need]**. The briefs below are built from the app's own blocker question (what to eat, no program, motivation, no time, stalled) and should be re-checked against real comments.

#### Brief 1: `MAKLA TOUNSIA` (TOFU)

- **Hypothesis:** If we create ads that show normal Tunisian plates being scanned and fitting into a fat-loss plan, then cold viewers will click, because the biggest blocker is "I don't know what to eat" and they believe a diet means giving up their food.
- **Format:** UGC video, 9:16, 25–30 s, filmed at a real table, phone in hand.
- **Angle:** you keep eating Tunisian food.
- **Desire:** attractiveness. **Funnel stage:** discovery, emotional.
- **Proof source:** live screen recording of the scan on a real plate.

| | Hook (0–3 s) |
|---|---|
| Hook 1, problem | Visual: a plate of kosksi, a hand hesitating. VO: «تحب تنقص، أما كل نهار نفس السؤال: شنوّة ناكل؟» |
| Hook 2, before/after | Visual: split screen, sad salad box → kosksi being scanned. VO: «قبل: سلاطة وجوع. توّا: ناكل كسكسي وننقص.» |
| Hook 3, result | Visual: phone showing the target date on the plan. VO: «نعرف بالضبط قدّاش ناكل باش نوصل للوزن اللي نحب عليه.» |

**Script (body + CTA, same for the 3 hooks):**

| Time | Visual | Derja |
|---|---|---|
| 0–3 s | Hook 1 / 2 / 3 | (hook line) |
| 3–8 s | Phone over the plate, tap, macros appear | «نصوّر الصحن، والتطبيق يقلّي قدّاش فيه كالوري وبروتين. من غير ما نلوّج ومن غير ما نحسب.» |
| 8–15 s | Scroll through the meal plan: lablabi, makrouna, eggs | «والبرنامج متاعي مبني على ماكلة تونسية، على قدّ الميزانية متاعي. موش دجاج مسلوق وبروكلي.» |
| 15–22 s | The 11 questions flying by, then the reveal screen | «جاوبت على 11 سؤال، وفي دقيقتين عطاني الكالوري، الماكروز، والتاريخ اللي نوصل فيه للهدف.» |
| 22–28 s | Face to camera, link sticker | «البرنامج متاعك تعملو بلاش، من غير حساب ومن غير كارطة. انزل على الليان وجرّب توّا.» |

- **Primary texts:** «شنوّة ناكل اليوم؟ خلّي البرنامج يجاوبك.» · «تنقص وإنت تاكل ماكلة دارك.» · «برنامجك في دقيقتين، بلاش.»
- **Headlines:** «اعمل برنامجك بلاش» · «دقيقتين وبرنامجك حاضر»

#### Brief 2: `PLAN FI 2 MIN` (MOFU)

- **Hypothesis:** If we create ads that show the whole plan being built on screen in real time, then viewers who already want to train will start the questionnaire, because they have no program and the ad proves the first step is free, fast and personal.
- **Format:** screen recording with a face bubble and voice-over, 9:16, 30 s.
- **Angle:** a plan made for your body, not a PDF everyone gets.
- **Desire:** attractiveness. **Funnel stage:** consideration, functional.
- **Proof source:** the real `/start` flow, unedited.

| | Hook (0–3 s) |
|---|---|
| Hook 1, problem | Visual: someone standing lost in a gym. VO: «تمشي للصالة وما تعرفش شنوّة تعمل؟» |
| Hook 2, before/after | Visual: a crumpled generic program → the personalised week on the phone. VO: «قبل: برنامج منقول من يوتيوب. توّا: برنامج معمول على قياسي.» |
| Hook 3, result | Visual: the plan reveal with the date. VO: «في دقيقتين عرفت شنوّة نتمرّن، شنوّة ناكل، ووقتاش نوصل.» |

| Time | Visual | Derja |
|---|---|---|
| 0–3 s | Hook 1 / 2 / 3 | (hook line) |
| 3–9 s | Tapping through the first questions | «يسألك على هدفك، وزنك، قدّاش من نهار تنجّم تتمرّن. 11 سؤال، موش أكثر.» |
| 9–16 s | Building animation, then the reveal | «وبعدها يحسبلك: الكالوري متاعك، البروتين، وأسبوع التمارين متاعك، في الصالة ولا في الدار.» |
| 16–23 s | Exercise video, one-tap swap, weekly review | «كل تمرين عندو فيديو. وكان الميزان وقف، البرنامج يتبدّل وحدو كل أسبوع.» |
| 23–30 s | Face to camera, link sticker | «جرّبها توّا، بلاش، من غير حساب. الليان لوطة.» |

- **Primary texts:** «11 سؤال. دقيقتين. برنامج معمول ليك إنت.» · «ما عادش تخمّم شنوّة تعمل في الصالة.»
- **Headlines:** «شوف برنامجك توّا» · «بلاش ومن غير حساب»

#### Brief 3: `COACH VS HYPE` (BOFU)

- **Hypothesis:** If we create ads that answer the price, trust and payment objections directly with the 90-day offer and a real member, then people who already saw the plan will pay, because what stops them at checkout is sending money to a stranger with no proof and no guarantee.
- **Format:** testimonial or founder to camera plus screen recording of checkout, 9:16, 30–35 s.
- **Angle:** the full coaching for a fraction of a coach's price, with your money back if it does not fit.
- **Desire:** attractiveness. **Funnel stage:** action, functional.
- **Proof sources:** a real member, the real checkout screen, the real guarantee.
- **Blocked until:** the guarantee is decided, the price is final and at least one real testimonial exists.

| | Hook (0–3 s) |
|---|---|
| Hook 1, problem | Visual: a coach's price list. VO: «كوتش خاصّ يكلّف [COACH PRICE] في الشهر. موش الناس الكل تنجّم.» |
| Hook 2, before/after | Visual: a real member's day-1 and today photos (with permission). VO: «هذا [NAME]، [REAL RESULT] في [REAL DURATION].» |
| Hook 3, result | Visual: the 90-day challenge card. VO: «90 يوم، برنامج كامل: تمارين، ماكلة، وكوتش يجاوبك.» |

| Time | Visual | Derja |
|---|---|---|
| 0–3 s | Hook 1 / 2 / 3 | (hook line) |
| 3–10 s | The value stack, line by line | «في تحدّي 90 يوم عندك: برنامج تمارين، برنامج ماكلة تونسية، سكان للصحن بالتصويرة، ومراجعة كل أسبوع.» |
| 10–16 s | The coach, real face | «وكان عندك سؤال، يجاوبك كوتش حقيقي بالدارجة، موش روبو.» |
| 16–24 s | Checkout screen: D17 and Flouci logos, upload, account opens | «تخلّص بـ D17 ولا Flouci، تبعث التصويرة، والحساب يتحلّ في [ACTIVATION TIME].» |
| 24–30 s | Guarantee card | «وكان في 7 أيام ما عجبكش، نرجّعولك فلوسك. من غير أسئلة.» |
| 30–35 s | Price and deadline, link sticker | «[PRICE] للـ 3 شهور، والسوم هذا يوفى نهار [DATE]. الليان لوطة.» |

- **Primary texts:** «90 يوم. برنامج كامل. وكان ما عجبكش، فلوسك ترجعلك.» · «أرخص من كوتش، وأقرب ليك من تطبيق.»
- **Headlines:** «تحدّي 90 يوم» · «ضمان 7 أيام»

### Phase 6: kill / scale / modify

**Weekly routine, on a 7-day window.** Do not touch a new campaign for the first 2–3 days.

1. **Macro before micro.** Read, in this order: cost per Purchase vs target CPA · conversion rate through the funnel (reveal ÷ landed, checkout start ÷ reveal, paid ÷ checkout start, from `funnel_events`) · AOV. CTR, CPC, hook rate (3-second views ÷ impressions) and hold rate (ThruPlays ÷ impressions) only explain a result; they never decide.
2. **Use blended numbers.** Blended CPA = total ad spend ÷ total new paying subscribers from the database, not only what Meta attributes.
3. **Ad Position Analysis per ad set:** spend share, CPM, frequency, CPA.
   - Low CPM + low frequency + most spend = TOFU. Expect a higher CPA and keep it.
   - High CPM + high frequency + least spend = BOFU. Expect the best CPA.
   - Judge each ad set's CPA against its role, not against the others.
4. **Decide:**

| Situation | Decision |
|---|---|
| Blended CPA ≤ target and new subscribers arriving | Leave it alone; go to scaling |
| Ad set CPA < target | **Scale**: raise the campaign budget |
| Two ad sets doing the same job | **Incrementality test**: turn the weaker one off for 2 days, watch blended sales |
| A funnel stage with no ad set covering it | **Modify**: brief and launch a new concept for that stage, as a new ad set in the same CBO |
| An ad set Meta is not spending on | **Leave it on**; it costs nothing |
| A TOFU ad set with a bad attributed CPA | Do not kill on attribution alone; turn it off for a week and watch total sales |
| Strong engagement, weak conversion | Offer or price problem, not a creative problem |
| Clicks land but few reach the reveal | Landing/questionnaire problem; read which question loses them |

5. **My own addition, not from the skill:** kill the *whole test* if, after 7 days and a spend of at least 3× the target CPA per ad set, blended CPA is above 2× target with no trend down. Then go back to the offer and the checkout, not to new ads.

The skill's "landing CVR ≥ 4%" benchmark is for a one-product COD page and does not transfer directly to a paid subscription with a manual transfer. Set your own baseline from the first 7 days and compare against it.

### Phase 7: scaling

Scaling is a decision, not a budget button. Each time:

**Readiness check (7-day window):** spend · CPA (performance) · CPM and daily frequency (demand).

| CPA | CPM | Frequency | Meaning | Action |
|---|---|---|---|---|
| Stable | Stable | Stable | Performance + demand | **Vertical scaling** |
| Stable | Rising | Rising | No more demand | Creative analysis, no more budget |
| Rising | Rising | Rising | Fatigue | Creative analysis |

**Vertical scaling:**
- **Budget increase % = (target CPA − current CPA) ÷ target CPA**
- Apply Monday, Wednesday and Friday, re-checking readiness each time. Safer: once a week.
- Example with a 32.25 DT ($10.75) target: current CPA 26 DT → (32.25 − 26) ÷ 32.25 = **19%** → a 60 DT/day budget becomes 71.5 DT/day. Wednesday, CPA 29 DT → 10% → 78.7 DT/day. Friday, CPA 31.5 DT → 2% → hold.

**Horizontal scaling**, when you cannot scale vertically: 7-day creative analysis → Ad Position Analysis → find the gap (TOFU, MOFU or BOFU) → launch 2 test ad sets for that gap in the same campaign → readiness check again.

**Operational limit specific to Hype:** every sale is activated by hand. Budget cannot grow faster than your ability to activate within the promised time. Automating payment (phase 2, step 2) is a scaling prerequisite, not a nice-to-have.

**If it still does not scale after all of this, it is an offer, conversion or business problem, not the ads.**

---

## 5. Relaunch checklist (gates)

Do not turn ads on until every line is true:

- [ ] Influencer share renegotiated, gross margin ≥ 70% on paper
- [ ] Price ladder decided and live; database matches
- [ ] 3 real testimonials on `/checkout`
- [ ] Guarantee decided and written on the page
- [ ] Activation time measured and the promise matches it
- [ ] Warm-list test run; checkout started → paid measured on the new flow
- [ ] Target CPA and target platform CPA computed from real numbers
- [ ] Pixel and Conversions API confirmed firing in production (a test purchase shows in Events Manager)
- [ ] Unpaid-checkout chase and renewal reminders running

---

## 6. What I did not do

- No Ad Position Analysis, no ad account audit table, no creative-by-creative review: no ad data.
- Unit economics checkpoints 2 and 3 are formulas and ceilings only: no spend, sales or OPEX.
- No Audience Insight Table and no competitor swipe file: no comments, DMs or competitor names.
- Nothing was run against the live app or database; the funnel was audited by reading the code.
- No code was changed. This file is the only change.

---

## 7. Numbers I need from you

I did not guess any of these. With them I can finish sections 2.3, 2.4, 2.5 and 2.6.

**Ads** (an Ads Manager export at ad level, or connect the Hype ad account):
1. Is "cylia ads" the Hype Fitness ad account? If not, which account ran the ads?
2. Total ad spend, and the dates the campaigns ran.
3. Per campaign / ad set / ad: spend, impressions, CPM, frequency, messaging conversations started, cost per conversation.
4. The ad creatives themselves (links or files) and their primary texts.
5. Production costs: UGC, editing, agency or freelancer fees.

**Sales:**
6. Number of DMs received, and number of paid subscribers that came from them.
7. Paid subscribers by plan (1 / 3 / 6 / 12 months) and total revenue, so I can compute AOV.
8. Which prices are live today: 20 / 54 / 96 / 168 or 49 / 129 / 219?
9. Since the checkout redesign (September): how many started checkout, how many uploaded a receipt, how many were activated, how many rejected, how many refunded.
10. Renewals: of the subscribers whose term has ended, how many paid again?

**Costs:**
11. The influencer's exact share, what it is calculated on (gross revenue? after ad spend?), whether it applies to renewals, and for how long.
12. Monthly Gemini / AI bill and hosting bill (Vercel, Supabase), and the number of active users in the same month.
13. Whether you absorb the 1% D17 / Flouci fee.
14. Your monthly OPEX, including a value for your own time on DMs and activations.

**Decisions:**
15. The maximum share of revenue you accept to spend on ads (I used 25%).
16. Whether you will offer a 7-day money-back guarantee.
17. What a human coach charges per month in your market (the value anchor).
18. Whether you have real customer results and written rights to use the influencer's existing content in ads.
19. Bechir's 7-question offer audit worksheet, if you have it.

To give me the data, either commit the files to an `audit-data/` folder on this branch, or connect the Hype Fitness Supabase project and Meta ad account to this session.
