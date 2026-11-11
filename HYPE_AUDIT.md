# Hype Fitness: audit and relaunch plan

Date: 2026-11-11. Method: `tunisia-ecom-media-buying` skill (Scalini / Bechir), in its order of operations: **Offer → unit economics → structure → creative → read the data → scale.**

## 0. Read this first

**Verdict: this is a conversion problem first, a business problem second and an offer problem third. It is not an ads problem, because the ads were never really tested: total ad spend was $25.68 (about 77 DT) over 7 days.**

Three things the data shows that the brief did not:

1. **The live prices are 49 / 129 / 219 DT**, not 20 / 54 / 96 / 168. The 20 DT ladder was live only from about 6 to 22 September, which is when the ads ran. The 12-month plan is off sale.
2. **Seven payment requests have a receipt uploaded, were opened by an admin, and were never confirmed or rejected.** Total 410 DT. Four of them are dated 20 September, in the middle of the Sales campaign. If those transfers were real, the ads did produce sales and the customers were never let in. Please check these first (admin → payments, pending with a receipt).
3. **99 payment requests are still open, worth 7,839 DT. You have collected 1,769 DT in total.** The unfinished payments are 4.4 times your all-time revenue.

**Sources.**

| Source | Status |
|---|---|
| `audit-data/` | Does not exist in the repo. Not used. |
| Hype Supabase project (`lufhyjqpjbwamblraicn`) | Read on 2026-11-11, aggregate counts only, no personal data. |
| Meta ad account | Your screenshot only: three campaigns at campaign level. No CPM, frequency or ad-level data. |
| Repo | Fully read. |

Labels used below: **[db]** live database, **[ads]** your screenshot, **[you]** your brief, **[need]** a number I still do not have (listed in section 7; none were guessed).

Still not possible: a real **Ad Position Analysis** (it needs spend, CPM and frequency per ad set) and unit economics checkpoint 3 (needs OPEX).

Currency: 3 DT ≈ $1, the same rate the skill uses.

---

## 1. Repo audit: every step and every drop-off point

### 1.1 The path a cold visitor walks

This is the path the code builds today, with an ad pointed at `/start`. The last column is the share of visitors still there, measured on 1,940 visits since 2026-09-17 **[db]**.

| # | Screen | What the user must do | Still there |
|---|---|---|---|
| 0 | `/` home (only if the link points here) | Read a one-line hero, tap "Start" | not tracked |
| 1 | `/start` Q1 goal | Tap 1 of 4 | 100% landed, 93% answer |
| 2–6 | Gender, age, height, weight, target weight | 1 tap, 4 typed numbers | 85–88% |
| 7 | Interstitial "gap" | Read + Next | 85% |
| 8–9 | Training days, activity | 2 taps | 85% |
| 10 | Interstitial "mechanism" | Read + Next | 85% |
| 11–13 | Experience, meals, blocker | 3 taps | 84–89% |
| 14–15 | Interstitial + "building" animation | Read, wait | 86% |
| 16 | Plan reveal | Read, tap "Unlock my plan" | **86%** |
| 17 | `/checkout` step 1: first time a price is seen | Scroll, pick a term, tap "Create my account" | 61% see it, **10.7% tap** |
| 18 | `/login?mode=signup` | 4 fields: name, phone, email, password | **2.8%** finish |
| 19 | `/checkout` step 2 | Pick a payment method | 3.6% reach it, 1.7% pick a method |
| 20 | **Leave the app** | Open D17 / Flouci, make the transfer | |
| 21 | Screenshot | | |
| 22 | Come back, attach it, send | | **0.26%** upload a receipt |
| 23 | Wait for a human | | 0.2% activated |
| 24–26 | Dashboard, diet questionnaire, workout questionnaire | | |
| 27 | First real use | | |

**Count:** 16 screens before a price, about 26 taps and typed fields before money moves, a forced exit from the app to pay, then a human, then 2 more questionnaires. **27 steps from click to first use**, about 32 with a DM in front.

**The questionnaire is not the problem.** 86% of people who land finish all 11 questions and see their plan. That is excellent. Everything is lost in the four steps after it.

### 1.2 What the code gets right (keep it)

- `/start` opens on a question and gives a real computed plan before asking for anything. 86% completion proves it works.
- No account until the price. Answers are never asked twice.
- Receipt upload sits on the same screen as the account number.
- Full funnel tracking in `funnel_events` (this is what made section 1.1 measurable).
- Meta is wired for a Sales campaign: Lead, InitiateCheckout, AddPaymentInfo in the browser, and a server-side **Purchase** through the Conversions API at activation.

### 1.3 What is broken or missing

| # | Finding | Evidence |
|---|---|---|
| 1 | **Receipts are left unprocessed.** 7 pending requests with a receipt, all seen by an admin, none resolved. Of 20 receipts ever uploaded: 8 activated, 5 rejected, 7 left hanging. | **[db]** |
| 2 | **Nobody chases unfinished payments.** 99 open requests, 7,839 DT, 77 with a phone number. 80 of them date from August. | **[db]** |
| 3 | **Zero testimonials** on a page that asks for a bank transfer. | `src/lib/social-proof.ts`: `TESTIMONIALS = []` |
| 4 | **Payment is manual and off-site.** The Konnect/Flouci webhook is an unfinished TODO. | `src/app/api/webhook/payment/route.ts` |
| 5 | **No trial.** `REVERSE_TRIAL = false`. | `src/lib/access.ts:48` |
| 6 | **The guarantee is not a risk reversal.** "We rebuild your plan", no money back. "Cancel anytime" means nothing on a prepaid plan. | `co.guarantee_*`, `co.cancel_*` |
| 7 | **No real urgency or scarcity.** | `checkout-client.tsx` |
| 8 | **No renewal engine.** No auto-renew, no automatic reminder. 1 of about 20 ended terms was renewed. | `faq.a_auto`, **[db]** |
| 9 | **The Purchase event has almost never fired**, because it fires at activation and ad-driven receipts were not activated. Meta has nothing to learn from. | finding 1 + `lib/meta/capi.ts` |

Not verifiable from here: whether the Conversions API token is set in production, and whether the payment instructions still tell people to send the receipt on WhatsApp (`docs/payment-method-instructions.md`).

### 1.4 The business in numbers **[db]**

| | |
|---|---|
| Accounts created | 1,235 |
| Signups by month | Jul 56 · **Aug 959** · Sep 185 · Oct 29 · Nov 5 |
| Customers who ever paid | **23** (1.9% of accounts) |
| Confirmed payments | 24 |
| Total revenue | **1,769 DT ($590)** |
| Subscribers active today | **3** (one expires today) |
| Customers who paid a second time | **1** |
| Payment requests started | 133 → 24 confirmed (18%), 10 rejected, 99 still open |
| Activation time, confirmed requests | median 0.1 h, average 4.9 h |
| Paying customers who logged a meal / trained a session | at most 12 / at most 9 |

Sales by plan: 1 month at 49 DT × 11 · 3 months at 129 DT × 5 · 6 months at 219 DT × 2 · 1 month at 20 DT × 3 · old Standard at 29 DT × 3.

---

## 2. The data audit

### 2.1 How the skill's terms map to a subscription

| Skill term (COD) | Hype Fitness | Value |
|---|---|---|
| AOV | Average confirmed payment | **73.7 DT ($24.57)** = 1,769 ÷ 24 **[db]** |
| COGS | Influencer share + AI + hosting per user | 40–50% **[you]** + **[need]** |
| Returns | Refunds and rejected payments | refunds **[need]** |
| Confirmation rate | Checkout started → paid | **18%** all time (24 of 133 requests); 25% since 17 Sept (4 of 16) **[db]** |
| Delivery rate | Receipt uploaded → activated, not refunded | **40%** (8 of 20 receipts; 7 never processed) **[db]** |
| Repeat purchases | Renewal rate | **about 5%** (1 of about 20 ended terms) **[db]** |
| Platform event | What Meta counted in your Sales campaign | Website completed registration **[ads]** |
| Registration → paid | | 1.9% all time (23 of 1,235); **3.1%** since 17 Sept (3 of 98) **[db]** |

### 2.2 Checkpoint 1: gross margin (target 70–80%+)

**Formula:** gross margin = (AOV − COGS − fees − refunds) ÷ AOV

| Influencer share **[you]** | Share per sale (AOV 73.7 DT) | Gross profit per sale | Gross margin | vs 70% |
|---|---|---|---|---|
| 40% | 29.5 DT ($9.83) | 44.2 DT ($14.74) | 60% | fails by 10 points |
| 45% | 33.2 DT ($11.06) | 40.5 DT ($13.51) | 55% | fails by 15 points |
| 50% | 36.9 DT ($12.28) | 36.9 DT ($12.28) | 50% | fails by 20 points |

AI, hosting and refunds **[need]** push it lower.

**Result: FAIL.** COGS is 40–50% of price, which is Bechir's "COGS ≈ 50% → won't scale" line (the scalable zone is under 25%). To pass, the share must be ≤ 30% minus your AI and hosting cost, and ≤ about 20% to reach the scalable zone.

**The share is really an acquisition cost.** At 29.5–36.9 DT per sale it is 1.6 to 2 times the target CPA of 18.4 DT (section 2.5). You are paying a double-priced CPA to a channel whose traffic went from 959 signups in August to 29 in October.

### 2.3 Checkpoint 2: LTGP : Marketing CAC (target 2.0+)

**Formula:** marketing CAC = (ad spend + production + UGC + agency) ÷ paying customers. LTGP:CAC = lifetime gross profit per customer ÷ marketing CAC.

Lifetime revenue per customer = 1,769 ÷ 23 = **76.9 DT**, barely above one order, because almost nobody renews. LTGP = 38.5–46.1 DT ($12.82–15.38).

| View | Marketing CAC | LTGP:CAC | Reading |
|---|---|---|---|
| Blended, all time: 77 DT ads ÷ 23 customers | 3.3 DT ($1.12) | 11.5–13.8 | Meaningless: 20+ of the 23 came from the influencer, whose cost sits in COGS |
| Ads only, confirmed sales: 77 DT ÷ 0 | undefined | 0 | No ad-attributed sale was ever activated |
| Ads only, **if** the 4 receipts of 20 Sept were real: 52 DT site spend ÷ 4 | 13 DT ($4.34) | 1.5–1.8 at the 20 DT ladder (39 DT average order) | Just under 2.0, on 4 sales |

**Result: cannot be passed or failed on this data.** $25.68 of spend is not a test. Production costs are **[need]**.

**Max CAC for a 2.0 ratio at today's numbers: 19.3–23.0 DT ($6.42–7.69) per paying customer.**

### 2.4 Checkpoint 3: net profit (target 25%+ net)

**Cannot be computed: OPEX is [need].** What the totals show: 1,769 DT revenue − 708 to 885 DT influencer share − 77 DT ads = **807 to 984 DT ($269–328) left over about 4.5 months**, before AI, hosting and your time.

### 2.5 Target CPA and target platform CPA

**Formulas:**
- Target CPA = AOV × max ad spend %
- Target platform CPA = target CPA × confirmation rate × delivery rate

**Target CPA** (cost per paying customer), AOV 73.7 DT:

| Max ad spend | Target CPA |
|---|---|
| 15% | 11.1 DT ($3.69) |
| **25%** | **18.4 DT ($6.14)** ← use this one |
| 30% | 22.1 DT ($7.37) |

With a 40–50% share, 25% on ads leaves 25–35% for AI, hosting, your time and profit. It is the highest I would go.

**Target platform CPA.** Your Sales campaign reported registrations, so that is the number you read in Ads Manager. Registration → paid already combines confirmation and delivery:

Target cost per registration = 18.4 DT × 3.1% = **0.57 DT ≈ $0.19**

Your actual cost per registration was **$0.24 [ads]**. That is 26% over target: close, not a disaster. Implied CPA = $0.24 ÷ 3.1% = **$7.74 (23.2 DT)** against a 18.4 DT target.

**The gate this gives you:** at $0.24 per registration, ads hit the target as soon as **registration → paid reaches 3.9%** (0.72 DT ÷ 18.4 DT). You are at 3.1%. A small checkout improvement makes the ads work; a large one makes them comfortable:

| Registration → paid | Target cost per registration | vs actual $0.24 |
|---|---|---|
| 1.9% (all time) | 0.35 DT ($0.12) | 2× too expensive |
| 3.1% (since 17 Sept) | 0.57 DT ($0.19) | 26% too expensive |
| 3.9% | 0.72 DT ($0.24) | on target |
| 10% | 1.84 DT ($0.61) | 2.5× headroom |

All of this rests on 32 registrations and 3 paying accounts. It is a direction, not a result.

### 2.6 Ad Position Analysis

**Only partly possible.** Your screenshot has no CPM or frequency, so I cannot assign TOFU / MOFU / BOFU roles by Bechir's rules. What the campaign level shows:

| Campaign | Objective | Spend | Result | Cost per result | What reached the site **[db]** | Paid |
|---|---|---|---|---|---|---|
| New messages campaign | Engagement (DM) | $8.32 | 159 conversations | $0.05 | not tracked | **[need]** |
| New Sales Campaign | Sales | $7.54 | 32 registrations | $0.24 | likely campaign …6205: 19–23 Sept, 328 visits, 25 accounts, 3 receipts uploaded | 0 activated |
| New Traffic Campaign | Traffic | $9.82 | 596 landing page views | $0.02 | likely campaign …5771: 17–19 Sept, 76 tracked visits, 2 accounts | 0 |
| **Total** | | **$25.68 (77 DT)** | | | | **0 confirmed** |

(The mapping of campaign IDs to names is my inference from dates and volumes; confirm it in Ads Manager.)

Readings:
- **Three objectives, three campaigns, about $8 each.** The skill's structure is one Sales CBO per offer. Splitting $25 three ways gave no campaign enough data to learn anything.
- **Traffic bought the wrong people.** 596 landing page views at $0.02, 2 accounts. Meta delivered clicks, as asked.
- **Messages bought conversations.** 159 DMs at $0.05. Sales from them are **[need]**; the database shows none tied to it.
- **The Sales campaign was the only one doing the right job**, and its cost per registration is near target. Its 25 accounts produced 3 receipts in 5 days, and none were activated. That is a delivery failure, not an ad failure.
- **Spend share, by Bechir's rule 2:** Traffic took the most spend (38%) and Messages 32%. 70% of the budget went to the two objectives that cannot produce a purchase signal.

Send an ad-set-level export (spend, CPM, frequency, results) and I will complete the role analysis.

### 2.7 The 7-question offer audit

The skill states the rule ("under 4 Strong answers → fix the offer before touching the ads") but does not list the seven questions word for word. I built them from the three components of a cold friendly offer that it does define. If you have Bechir's worksheet, send it and I will re-score.

| # | Question | Score | Evidence |
|---|---|---|---|
| 1 | Does it sell ONE mass-market desire? | **Weak** | Ads sold a feature (meal scan). Hero sells "a coach without a coach". |
| 2 | Is perceived value 5–10× the price, without competing on price? | **Weak** | The lever pulled was price: 49 → 20 DT, then back. No value anchor. |
| 3 | Is it framed as a complete solution? | **Medium** | The product is complete, but sold as "full access, choose how long". |
| 4 | Real social proof and authority? | **Weak** | 0 testimonials. The influencer has stopped posting. |
| 5 | A guarantee that removes the risk? | **Weak** | "We rebuild your plan." No money back. |
| 6 | Real scarcity or urgency? | **Weak** | None. |
| 7 | Certainty (what happens, how fast)? | **Medium** | Steps are explained; activation is fast when it happens (median 0.1 h) but 7 receipts were never answered. |

**Strong answers: 0 of 7.** Under 4 → fix the offer before touching the ads.

Supporting number: 61% of visitors see the price page and only 10.7% tap a plan. The page that carries the offer loses 5 of every 6 people who read it.

---

## 3. Diagnosis: why it is not profitable, ranked

| Rank | Reason | The number that proves it | Type |
|---|---|---|---|
| 1 | **Checkout does not close, and paid customers are left waiting.** | 1,940 visits → 4 payments (0.21%). 208 picked a plan → 54 made an account (26%) → 5 uploaded a receipt. 99 open requests worth 7,839 DT against 1,769 DT collected. 7 receipts (410 DT) never processed; delivery rate 40%. | **Conversion** |
| 2 | **Nobody renews.** | 1 repeat payer out of about 20 ended terms (about 5%). 3 active subscribers today. Lifetime revenue per customer 76.9 DT, against an average order of 73.7 DT. | **Business** |
| 3 | **The influencer share is a CPA twice the target.** | 29.5–36.9 DT per sale against a 18.4 DT target CPA. Gross margin 50–60% against a 70% minimum. | **Business** |
| 4 | **There is no traffic engine.** | Signups: 959 in August → 185 → 29 → 5. Everything came from one person's posts. | **Business** |
| 5 | **The offer does not close a stranger.** | 0 of 7 Strong. 0 testimonials. 61% see the price, 10.7% act. | **Offer** |
| 6 | **The ads were never tested.** | $25.68 total, 7 days, split across 3 objectives. 70% went to Traffic and Messages. 0 confirmed sales, but cost per registration ($0.24) was within 26% of target. | **Ads structure** |

**Said plainly, as the skill requires:** reason 1 is a conversion problem, 2 to 4 are business problems, 5 is an offer problem. The ads are last, and on the little data that exists they were the healthiest part: the Sales campaign delivered registrations near the target cost and its buyers uploaded receipts that nobody activated.

Total revenue of 1,769 DT in five months means the real issue is not ad profitability. It is that 1,235 people made an account, 133 tried to pay, 24 payments got through, and one person came back.

**On price:** the week the 20 DT ladder was live, 28% of people who saw the price page tapped a plan (96 of 345). In the following weeks at 49 DT it was 11–21%. So the lower price roughly doubled the tap rate, but each sale was worth 2.45 times less, and the traffic mix was different (ads versus organic). Price is not what is broken.

---

## 4. Relaunch plan

Follows the skill's order. Phases 0–2 cost no ad spend, and the ads should stay off until they are done.

### This week, before anything else

1. **Resolve the 7 pending requests that have a receipt** (410 DT). Activate the real ones and apologise; reject the rest with a reason.
2. **Message the 77 people with an open request and a phone number.** 7,839 DT is waiting there. Even 10% recovered is 780 DT, almost half of everything collected so far.
3. **Message the 20 past customers** with a renewal offer, and ask each for a testimonial.

### Phase 0: fix the business (before any ad)

1. **Renegotiate the influencer share.** This is the gate. Options, in order of preference:
   - Pay per piece of content delivered (a flat fee per video), with paid-ad usage rights in writing. They stopped posting; a share of everything is no longer earned.
   - Or a share only on sales that carry their code or come from their content.
   - Or cut the blanket share to **≤ 20%**, which puts COGS under the 25% line.
   - If none of these is possible, the honest answer from the skill is that paid ads cannot scale this business, and it should run on organic and referrals only.
2. **Make the 3-month plan the default** (phase 1). Prices stay as they are.
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

**Price:** keep the live ladder (49 / 129 / 219 DT) and stop competing on price. The 20 DT test did not fix sales (section 3). Change what is pre-selected: today the 6-month plan is badged, but 11 of 24 buyers chose 1 month and only 2 chose 6. Make the 3-month "90-day challenge" the default and badged plan:

| Plan | Price | Role |
|---|---|---|
| 1 month | 49 DT | Low-commitment entry |
| **3 months: the 90-day challenge** | **129 DT** | **Default** |
| 6 months | 219 DT | Upsell |

Every buyer moved from 1 month to 3 months raises the AOV, and with it the target CPA. This is a recommendation, not a measured result; test it on your list first (phase 2, step 6).

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
2. **Kill the activation wait.** Best: finish the Flouci or Konnect payment API (the webhook is half-built) so payment is confirmed instantly. Interim: open the account the moment a receipt is uploaded, verify afterwards, and revoke if the receipt is fake. No receipt can be left hanging either way, which is what happened to 7 of the 20 uploaded so far.
3. **Chase every unpaid checkout within 2 hours** on WhatsApp. The phone number is already collected at signup.
   - Also shorten the account form: 74% of people who pick a plan do not finish it (208 → 54). Phone and password are enough to start; name and email can wait.
4. **Show the price range earlier.** One line on the reveal screen ("from X DT a month") so the price is not a surprise at screen 17.
5. **Fill the proof and the guarantee** on `/checkout` (phase 1, part C).
6. **Test the new offer on the warm list for free.** You have 1,235 accounts (832 with a phone number) and a broadcast script (`scripts/waitlist-broadcast/`). Send them the 90-day offer. This measures the new confirmation rate without spending a dinar on ads. **Gate: do not turn ads on until registration → paid is at 3.9% or better** (it is 3.1% today; see section 2.5).
7. **Build the renewal engine:** an automatic WhatsApp message 7 days and 1 day before a term ends.
8. **Confirm in production:** pixel ID and Conversions API token set, and the payment instructions no longer send people to WhatsApp.

I can implement items 2 (interim version), 4, 5 and 7 in this repo if you want them; none are done in this pass.

### Phase 3: target CPA

From section 2.5, with today's numbers:

- **Target CPA = 73.7 DT × 25% = 18.4 DT ($6.14)** per paying customer.
- **Target platform CPA = 18.4 DT × 3.1% = 0.57 DT ($0.19)** per registration.

Recompute both after the warm-list test. Each improvement moves the target:
- AOV to 100 DT (more 3-month buyers) → target CPA 25 DT ($8.33).
- Registration → paid to 10% → target cost per registration 1.84 DT ($0.61).

Judge the campaign on **cost per Purchase vs 18.4 DT**, and use cost per registration as the early signal. This only works if every real payment is activated the same day, because Purchase is sent to Meta at activation.

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

**Starting budget (my sizing, not from the skill):** one campaign, not three. A minimum test is 3 ad sets × 3 × the target CPA ≈ 9 × $6.14 ≈ **$55**. I would run **$10/day for 10 days ($100, about 300 DT)**. That is four times everything spent so far, and it is the smallest amount that can show a cost per Purchase. Treat it as a minimum viable test, not a launch.

### Phase 5: three creative briefs

One brief = one concept. Hooks follow the skill: Hook 1 = show the problem, Hook 2 = before and after, Hook 3 = desired result. Scripts are in Tunisian Derja. `[PRICE]`, `[DATE]` and names are placeholders for real values.

Rule for all three: **no invented results.** Any "before and after" of a body must be a real customer with permission. Where there is none yet, the before/after is the situation (confused → has a plan), which is true for every user.

The skill's creative research (ad account audit table, Audience Insight Table from real comments, 3 competitors) needs your ad-level export and the 159 DM conversations **[need]**. Those DMs are the best audience research you own: export them and I will build the table. The briefs below are built from the app's own blocker question (what to eat, no program, motivation, no time, stalled) and should be re-checked against real comments.

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
- Example with the 18.4 DT ($6.14) target: Monday, CPA 15 DT → (18.4 − 15) ÷ 18.4 = **18%** → $10/day becomes $11.85/day. Wednesday, CPA 16.5 DT → 10% → $13.07/day. Friday, CPA 18 DT → 2% → hold.

**Horizontal scaling**, when you cannot scale vertically: 7-day creative analysis → Ad Position Analysis → find the gap (TOFU, MOFU or BOFU) → launch 2 test ad sets for that gap in the same campaign → readiness check again.

**Operational limit specific to Hype:** every sale is activated by hand. Budget cannot grow faster than your ability to activate within the promised time. Automating payment (phase 2, step 2) is a scaling prerequisite, not a nice-to-have.

**If it still does not scale after all of this, it is an offer, conversion or business problem, not the ads.**

---

## 5. Relaunch checklist (gates)

Do not turn ads on until every line is true:

- [ ] Influencer share renegotiated, gross margin ≥ 70% on paper
- [ ] The 7 pending receipts resolved, and the 77 open requests contacted
- [ ] 3-month plan set as the default
- [ ] 3 real testimonials on `/checkout`
- [ ] Guarantee decided and written on the page
- [ ] Every receipt answered the same day
- [ ] Warm-list test run; registration → paid at 3.9% or better
- [ ] Target CPA and target platform CPA computed from real numbers
- [ ] Pixel and Conversions API confirmed firing in production (a test purchase shows in Events Manager)
- [ ] Unpaid-checkout chase and renewal reminders running

---

## 6. What I did not do

- No full Ad Position Analysis and no creative-by-creative review: the screenshot has no CPM, frequency or ad-level data.
- Unit economics checkpoint 3 is totals only: no OPEX.
- No Audience Insight Table and no competitor swipe file: no comments, DMs or competitor names.
- I did not look at the 7 receipts or any customer's details; only counts and amounts were read. Whether those transfers were real is for you to check.
- The funnel was audited by reading the code and the database, not by walking the live site.
- No code and no data were changed. This file is the only change.

---

## 7. Numbers I still need

None of these were guessed.

**Ads:**
1. An ad-set and ad-level export: spend, impressions, CPM, frequency, results. And the creatives with their texts.
2. How many of the 159 DM conversations paid, and the conversations themselves for audience research.
3. Confirmation of which campaign is which ID (…6205 and …5771).
4. Production costs: UGC, editing, freelancers.

**Sales:**
5. Were the 7 pending receipts real transfers?
6. Any refunds given.

**Costs:**
7. The influencer's exact share, what it is calculated on, whether it applies to renewals, and for how long.
8. Monthly AI bill and hosting bill (Vercel, Supabase). The database shows 455 AI scan events from 15 users in total.
9. Whether you absorb the 1% D17 / Flouci fee.
10. Monthly OPEX, including a value for your own time.

**Decisions:**
11. The maximum share of revenue you accept to spend on ads (I used 25%).
12. Whether you will offer a 7-day money-back guarantee.
13. What a human coach charges per month in your market (the value anchor).
14. Whether you have written rights to use the influencer's content in ads.
15. Bechir's 7-question offer audit worksheet, if you have it.
