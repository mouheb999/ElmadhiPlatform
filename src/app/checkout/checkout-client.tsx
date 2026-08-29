"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, ImageUp, Lock, Send, Sparkles } from "lucide-react";
import {
  attachPaymentProof,
  isAccountActive,
  markPaymentThreadSeen,
  sendPaymentMessage,
  startPaymentRequest,
} from "@/app/actions/payment";
import { AppPreview } from "@/components/checkout/app-preview";
import { PaymentMethods } from "@/components/checkout/payment-methods";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type Locale, dir, t, type StringKey } from "@/lib/i18n";
import { REVERSE_TRIAL, type LockedFeature } from "@/lib/access";
import type { Database } from "@/types/db";

type Settings = Database["public"]["Tables"]["payment_settings"]["Row"];
type Method = Database["public"]["Tables"]["payment_methods"]["Row"];
type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];

type Tier = "standard" | "premium";

const TIER_FEATURES: Record<Tier, StringKey[]> = {
  standard: ["plans.f_std_1", "plans.f_std_2", "plans.f_std_3", "plans.f_std_4"],
  premium: ["plans.f_prem_all", "plans.f_prem_1", "plans.f_prem_2", "plans.f_prem_3"],
};

/** Which locked control sent them here, so the page can open by naming it. */
const FROM_REASON: Record<LockedFeature, StringKey> = {
  session: "lock.session",
  meal_log: "lock.meal_log",
  checkin: "lock.checkin",
  progress: "lock.progress",
  ai: "lock.ai",
  qa: "lock.qa",
};

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/**
 * What the file input offers. Matches the server's allow-list — `image/*` also
 * accepted SVG, which the server now refuses, and an accept filter that lets a
 * user choose a file we will reject is worse than no filter.
 */
const PROOF_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

/**
 * How often a waiting customer asks whether they have been let in.
 *
 * Six seconds is chosen against the human on the other side, not the server:
 * an admin confirms a payment while the customer is watching the screen and
 * telling them it went through, so the gap between the tap and the screen
 * changing is the whole experience. Cheap enough to leave running — one
 * primary-key read, only for people parked on this page, and it stops the
 * moment they are activated.
 */
const ACTIVATION_POLL_MS = 6000;

export type PaymentThreadMessage = {
  id: string;
  sender: "user" | "admin";
  body: string;
  createdAt: string | null;
};

export type PaymentThread = {
  ticketId: string;
  hasUnreadReply: boolean;
  messages: PaymentThreadMessage[];
};

type Props = {
  locale: Locale;
  /** False for a visitor who has not made an account yet. */
  signedIn: boolean;
  /** A plan chosen before signing up, carried back through `?plan=`. */
  initialPlanId: string | null;
  email: string;
  paymentStatus: string;
  planExpiresAt: string | null;
  isRenewal: boolean;
  hasProof: boolean;
  /** There is an open request: they have said they transferred the money. */
  hasOpenRequest: boolean;
  /** Their last attempt was turned down, and they have not started another. */
  wasRejected: boolean;
  /** The conversation attached to the open request, once a receipt exists. */
  thread: PaymentThread | null;
  from: string | null;
  settings: Settings | null;
  methods: Method[];
  plans: Plan[];
};

/**
 * Checkout, as three steps instead of one wall.
 *
 * The old page put the tier grid, the duration list, every payment method and
 * a "confirm on WhatsApp" button on one screen, then sent the customer out of
 * the app to send a screenshot to a human. Nine hundred accounts saw it and
 * almost none finished. Splitting it means only one decision is on screen at a
 * time, and the receipt now arrives attached to the request instead of in a
 * separate chat, so nobody has to leave to finish paying.
 *
 * WhatsApp is still here, demoted to a "something wrong?" link — the escape
 * hatch for a customer who is stuck, not the mechanism.
 */
export function CheckoutClient({
  locale,
  signedIn,
  initialPlanId,
  paymentStatus,
  planExpiresAt,
  isRenewal,
  hasProof,
  hasOpenRequest,
  wasRejected,
  thread,
  from,
  settings,
  methods,
  plans,
}: Props) {
  const router = useRouter();
  const direction = dir(locale);

  /**
   * What they were looking at before the form.
   *
   * Somebody who picked Premium / 6 months, made an account and came back to
   * Premium / 3 months would reasonably conclude the page had changed its mind
   * about what they were buying. `?plan=` carries the choice through signup;
   * the defaults below are for everyone else. Resolved against the real plans,
   * so a stale or mistyped id falls back rather than pretending.
   */
  const chosen = initialPlanId ? plans.find((p) => p.id === initialPlanId) : undefined;
  const [tier, setTier] = useState<Tier>(
    chosen?.tier === "standard" ? "standard" : "premium",
  );
  // Psychological default: the middle option, not the cheapest.
  const [months, setMonths] = useState<number>(chosen?.months ?? 3);

  /**
   * Where a returning customer picks up. Two ways to open on step 2:
   *
   * An **open request with no receipt** — an order saved and nothing proving
   * it, which is the state every open request in production is in. Starting
   * them at step 1 put them back on the plan grid with nothing saying what was
   * outstanding.
   *
   * A **signed-in visitor carrying a resolved `?plan=`** — somebody who chose
   * a plan, was sent to make an account, and has just come back. They already
   * made this decision; showing them the grid again and asking them to press
   * Continue a second time is asking them to make it twice.
   *
   * "← Back" is one tap from the plans either way, for anyone who wants to
   * change their mind.
   */
  const [step, setStep] = useState(
    (hasOpenRequest && !hasProof) || (signedIn && !!chosen) ? 2 : 1,
  );
  const [methodKey, setMethodKey] = useState<string | null>(methods[0]?.key ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const plansRef = useRef<HTMLDivElement>(null);

  /** The only way out of the preview's wall, and its skip link. */
  function scrollToPlans() {
    plansRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /**
   * Step 1 → step 2, with the account collected in between if there isn't one.
   *
   * This is where the account is asked for: after the preview, after the
   * plans, at the point the visitor has decided what they want and not one
   * screen earlier. The chosen plan rides along in `?plan=` so signing up does
   * not quietly reset the choice they just made, and `next` brings them back
   * here rather than to a dashboard they cannot reach yet.
   */
  function continueWithPlan() {
    if (!selectedPlan) return;
    if (signedIn) {
      setStep(2);
      return;
    }
    const plan = encodeURIComponent(selectedPlan.id);
    const next = encodeURIComponent(`/checkout?plan=${plan}`);
    // `plan` twice on purpose: once for the sign-up screen, which shows what
    // they are buying above the form, and once inside `next`, which is where
    // they land afterwards.
    router.push(`/login?mode=signup&plan=${plan}&next=${next}`);
  }

  const whatsappNumber = (settings?.whatsapp_number ?? "").replace(/[^\d]/g, "");

  const tierPlans = useMemo(
    () => plans.filter((p) => p.tier === tier).sort((a, b) => a.months - b.months),
    [plans, tier],
  );
  const selectedPlan = tierPlans.find((p) => p.months === months) ?? tierPlans[0] ?? null;
  const monthlyBase = tierPlans.find((p) => p.months === 1)?.price_tnd ?? null;
  const activeMethod = useMemo(
    () => methods.find((m) => m.key === methodKey) ?? null,
    [methods, methodKey],
  );

  /**
   * Is anybody actually being waited on?
   *
   * `payment_status` is 'pending' from the moment a request row exists. Anyone
   * else on this screen is reading prices, and the poll below was running for
   * them too: a Server Function POST every six seconds, per visitor, asking a
   * question whose answer cannot change until they have done something.
   */
  const awaitingReview = paymentStatus === "pending";

  /**
   * Wait for the admin, without making the customer reload.
   *
   * Activation happens in somebody else's browser, so this tab has no way to
   * find out on its own. While the account is not active this asks every few
   * seconds; the moment it flips, `router.refresh()` re-renders the page from
   * the server and the "you're in" card replaces whatever step they were on.
   *
   * Paused while the tab is hidden — a phone in a pocket with the app open
   * should not be asking a question nobody is there to read the answer to, and
   * `visibilitychange` fires on the way back, which makes returning to the tab
   * itself a check. That is the moment a waiting customer looks, so it is the
   * moment that most needs to be right.
   */
  useEffect(() => {
    if (paymentStatus === "active" || !awaitingReview) return;

    let stopped = false;
    async function check() {
      if (stopped || document.hidden) return;
      if (await isAccountActive()) {
        stopped = true;
        router.refresh();
      }
    }

    const timer = setInterval(check, ACTIVATION_POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [paymentStatus, awaitingReview, router]);

  const activeMonths = selectedPlan?.months ?? months;
  // Plain arithmetic over six rows; the compiler memoizes it. The hand-written
  // useMemo that used to be here could no longer be preserved once the plan
  // preselection landed above, and a `useMemo` the compiler bails out of makes
  // the whole component opt out of optimisation.
  const premiumUpgradePerMonth = ((): number | null => {
    const std = plans.find((p) => p.tier === "standard" && p.months === activeMonths);
    const prem = plans.find((p) => p.tier === "premium" && p.months === activeMonths);
    if (!std || !prem) return null;
    const delta = (prem.price_tnd - std.price_tnd) / activeMonths;
    return delta > 0 ? delta : null;
  })();

  function savingsPct(plan: Plan): number | null {
    if (!monthlyBase || plan.months === 1) return null;
    const pct = Math.round((1 - plan.price_tnd / (monthlyBase * plan.months)) * 100);
    return pct > 0 ? pct : null;
  }

  /** One decimal at most, no trailing ".0" — 36.5 stays 36.5, 43.0 becomes 43. */
  function dt(value: number): string {
    return String(Math.round(value * 10) / 10);
  }

  function monthsLabel(m: number): string {
    if (m === 1) return t(locale, "plans.month_1");
    if (m === 3) return t(locale, "plans.months_3");
    return t(locale, "plans.months_6");
  }

  function tierLabel(value: Tier): string {
    return value === "premium" ? t(locale, "plans.premium") : t(locale, "plans.standard");
  }


  function pickFile(next: File | null) {
    setError(null);
    if (!next) return;
    // Same allow-list the server enforces, so a rejected file is caught before
    // the upload rather than after it.
    if (!PROOF_ACCEPT.split(",").includes(next.type)) {
      setError(t(locale, "co.file_not_image"));
      return;
    }
    if (next.size > MAX_PROOF_BYTES) {
      setError(t(locale, "co.file_too_big"));
      return;
    }
    setFile(next);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(next);
    });
  }

  /**
   * The whole commit, in one tap: log the request, attach the receipt.
   *
   * These were two screens and two decisions. The first was free — "I've sent
   * it" created a request, flipped the account to pending and pinged an admin,
   * before any money was evidenced — and it sat exactly where a Next button
   * sits. The second asked for the hard part, a screenshot from the bank app,
   * at the moment of least motivation: the customer had already done the thing
   * they think of as paying. 102 people tapped the first; 5 finished the
   * second.
   *
   * Now the receipt is attached on the same screen as the account number, and
   * this button needs it. The request is still logged first, so the lead
   * survives an upload that fails — the admin queue gets somebody to chase
   * rather than nothing at all.
   */
  function payAndSend() {
    if (!activeMethod || !selectedPlan || !file) return;
    setError(null);
    startTransition(async () => {
      const started = await startPaymentRequest(activeMethod.key, selectedPlan.id);
      if (!started.ok) {
        setError(started.error);
        return;
      }

      const formData = new FormData();
      formData.set("file", file);
      if (note.trim()) formData.set("note", note.trim());
      const attached = await attachPaymentProof(formData);
      if (!attached.ok) {
        // The request exists; only the upload failed. Refresh so the screen
        // comes back in the "order saved, receipt still needed" state rather
        // than looking like nothing happened.
        setError(attached.error);
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  /**
   * For the customer who has not made the transfer yet and is going to open
   * their bank app. Logs the request so they are reachable, and comes back to
   * this same screen saying what is still outstanding — the honest version of
   * the review screen that used to claim we were checking a payment nobody had
   * evidence of.
   */
  function saveForLater() {
    if (!activeMethod || !selectedPlan) return;
    setError(null);
    startTransition(async () => {
      const res = await startPaymentRequest(activeMethod.key, selectedPlan.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  /** Attaching a receipt to an order that was saved earlier. */
  function sendProof() {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    if (note.trim()) formData.set("note", note.trim());
    startTransition(async () => {
      const res = await attachPaymentProof(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const helpLink = whatsappNumber ? (
    <a
      href={`https://wa.me/${whatsappNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-center text-xs font-bold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
    >
      {t(locale, "co.need_help")}
    </a>
  ) : (
    <Link
      href="/support"
      className="text-center text-xs font-bold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
    >
      {t(locale, "co.need_help")}
    </Link>
  );

  // ---- Already active ----
  if (paymentStatus === "active") {
    const until = planExpiresAt
      ? new Date(planExpiresAt).toLocaleDateString(locale === "tn" ? "ar-TN" : "en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;
    return (
      <Shell direction={direction}>
        <Card className="w-full max-w-sm text-center">
          <CardContent className="flex flex-col gap-4 p-6">
            <h1 className="text-xl font-extrabold">{t(locale, "checkout.active_title")}</h1>
            <p className="text-sm text-muted">
              {t(locale, "checkout.active_body")}
              {until && (
                <>
                  <br />
                  {t(locale, "checkout.active_until")} {until}
                </>
              )}
            </p>
            <Button asChild className="w-full">
              <Link href="/dashboard">{t(locale, "checkout.go_dashboard")}</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // ---- Under review ----
  //
  // Only once a receipt actually exists. `payment_status` goes to 'pending' the
  // moment a request row is inserted — a database trigger does it — and that
  // insert happens when the user taps "I've paid" at step 2, before any proof
  // is uploaded. Keyed on the status alone, this screen therefore captured
  // anybody who tapped that button once and then backed out: every later visit
  // showed "we're checking your payment" for a payment that was never made,
  // with no route back to the plans. With the paywall on and /checkout the only
  // page an unpaid account can reach, that was the whole product for them.
  //
  // So the flow below renders instead, and startPaymentRequest updates the
  // existing row rather than inserting a second one (migration 041 makes
  // one-pending-per-user an invariant), which is what makes re-walking the
  // steps safe.
  if (paymentStatus === "pending" && hasProof) {
    return (
      <Shell direction={direction}>
        <div className="flex w-full max-w-sm flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4 p-6 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/15">
                <Clock className="h-6 w-6 text-accent" />
              </span>
              <h1 className="text-xl font-extrabold">{t(locale, "co.review_title")}</h1>
              <p className="text-sm text-muted">{t(locale, "co.review_body")}</p>

              {/* This screen is only reached with a receipt on file — the
                  no-receipt branch that used to live here was unreachable, and
                  a customer in that state now opens on step 3 instead, which
                  is the screen that actually asks for the thing. */}
              <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-accent">
                <Check className="h-4 w-4" />
                {t(locale, "co.review_have_proof")}
              </p>
              <p className="text-xs text-muted">{t(locale, "pt.reply_soon")}</p>
            </CardContent>
          </Card>

          {thread && <PaymentThreadPanel locale={locale} thread={thread} />}

          {/* The point of the trial: waiting on review is not being locked
              out, and the plan they just built is still readable.

              Hidden while REVERSE_TRIAL is off, for the same reason "stay on
              the free plan" is hidden at step 1: /dashboard is paywalled in
              that mode, so this button bounced the customer straight back to
              this screen. Offering someone who has just paid a way out of the
              waiting room that returns them to the waiting room reads as the
              app being broken at the worst possible moment. */}
          {REVERSE_TRIAL && (
            <>
              <p className="text-center text-xs text-muted">{t(locale, "co.meanwhile")}</p>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/dashboard">{t(locale, "checkout.go_dashboard")}</Link>
              </Button>
            </>
          )}
          {helpLink}
        </div>
      </Shell>
    );
  }

  // ---- The two steps ----
  const fromFeature =
    from && from in FROM_REASON ? (from as LockedFeature) : null;

  return (
    <Shell direction={direction}>
      <div className="flex w-full max-w-md flex-col gap-4">
        <StepBar locale={locale} step={step} />

        {step === 1 && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "co.s1")}</h1>
              {fromFeature ? (
                <p className="mt-1 text-sm text-muted">{t(locale, FROM_REASON[fromFeature])}</p>
              ) : (
                <p className="mt-1 text-sm text-muted">{t(locale, "checkout.subtitle")}</p>
              )}
            </div>

            {wasRejected && (
              <div className="flex flex-col gap-1 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                <p className="text-sm font-bold">{t(locale, "co.rejected_title")}</p>
                <p className="text-xs leading-relaxed text-muted">
                  {t(locale, "co.rejected_body")}
                </p>
              </div>
            )}

            {isRenewal && (
              <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm font-semibold">
                {t(locale, "checkout.renewal_banner")}
              </p>
            )}

            {/* Says out loud that not paying is a real option. Without this the
                page still reads as "pay or leave", which is what it used to.
                Hidden while REVERSE_TRIAL is off, because then it *is* "pay or
                leave" and promising a free tier that no longer exists is worse
                than the blunt version. */}
            {REVERSE_TRIAL && (
              <p className="rounded-2xl border border-hairline bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
                {t(locale, "co.free_line")}
              </p>
            )}

            {/* The product, before the price. With the trial off this is the
                only thing on the page that can answer "what am I buying?" —
                the tier bullets describe features to somebody who already
                knows what the app is, and a stranger here does not. */}
            <AppPreview locale={locale} onPickPlan={scrollToPlans} />

            {plans.length === 0 ? (
              <p className="rounded-2xl border border-hairline bg-surface px-4 py-3 text-center text-sm text-muted">
                {t(locale, "checkout.no_plans")}
              </p>
            ) : (
              <>
                <div ref={plansRef} className="grid grid-cols-2 gap-3">
                  {(["standard", "premium"] as Tier[]).map((value) => {
                    const selected = tier === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTier(value)}
                        className={cn(
                          "relative flex flex-col gap-2 rounded-2xl border p-4 text-start transition-colors",
                          selected
                            ? "border-accent bg-accent/5 ring-1 ring-accent"
                            : "border-hairline bg-surface hover:bg-white/5",
                        )}
                      >
                        {value === "premium" && (
                          <span className="absolute -top-2.5 start-3 flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bg">
                            <Sparkles className="h-3 w-3" />
                            {t(locale, "plans.most_popular")}
                          </span>
                        )}
                        <span className="pt-1 font-extrabold">{tierLabel(value)}</span>
                        <span className="min-h-[1.125rem] text-xs text-muted">
                          {value === "premium" && premiumUpgradePerMonth !== null ? (
                            <>
                              <bdi className="font-extrabold text-accent tabular-nums">
                                +{dt(premiumUpgradePerMonth)} DT
                              </bdi>
                              {t(locale, "plans.per_month")} {t(locale, "plans.vs_standard")}
                            </>
                          ) : value === "standard" ? (
                            t(locale, "plans.base_price")
                          ) : null}
                        </span>
                        <ul className="mt-1 flex flex-col gap-1">
                          {TIER_FEATURES[value].map((key) => (
                            <li
                              key={key}
                              className="flex items-start gap-1.5 text-[11px] leading-snug text-muted"
                            >
                              <Check className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                              {t(locale, key)}
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2">
                  <p className="px-1 text-xs font-bold uppercase tracking-wide text-muted">
                    {t(locale, "plans.duration")} · {tierLabel(tier)}
                  </p>
                  {tierPlans.map((plan) => {
                    const selected = selectedPlan?.id === plan.id;
                    const save = savingsPct(plan);
                    const perMonth = Math.round((plan.price_tnd / plan.months) * 10) / 10;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setMonths(plan.months)}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start transition-colors",
                          selected
                            ? "border-accent bg-accent/5 ring-1 ring-accent"
                            : "border-hairline bg-surface hover:bg-white/5",
                        )}
                      >
                        <span className="flex flex-col">
                          <span className="flex items-center gap-2 font-bold">
                            {monthsLabel(plan.months)}
                            {plan.months === 6 && (
                              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                                {t(locale, "plans.best_value")}
                              </span>
                            )}
                          </span>
                          {save !== null && monthlyBase !== null && (
                            <span className="text-xs text-muted">
                              <span className="line-through">{dt(monthlyBase * plan.months)} DT</span>{" "}
                              <span className="font-bold text-accent">
                                {t(locale, "plans.save")} {save}%
                              </span>
                            </span>
                          )}
                        </span>
                        <span className="text-end tabular-nums">
                          <span className="text-lg font-extrabold">{dt(perMonth)}</span>
                          <span className="text-xs text-muted"> DT{t(locale, "plans.per_month")}</span>
                          {plan.months > 1 && (
                            <span className="block text-[11px] text-muted">
                              {dt(plan.price_tnd)} DT {t(locale, "plans.billed_every")}{" "}
                              {monthsLabel(plan.months)}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* The pulsing "Limited-time offer" pill used to sit here. It
                    was permanent, had no deadline, and was attached to no
                    discount — the real savings (12% at three months, 25% at
                    six) are already on the rows above and are true. A standing
                    urgency badge beside honest numbers costs credibility with
                    exactly the sceptical buyer this page has to convince.

                    `payment_settings.offer_label_*` still exists and is still
                    editable in /admin; nothing renders it until it means
                    something, and a real offer needs a deadline rather than a
                    label. */}

                <Button
                  onClick={continueWithPlan}
                  disabled={!selectedPlan}
                  size="lg"
                  className="w-full"
                >
                  {signedIn ? t(locale, "co.next") : t(locale, "co.next_signup")}
                  {selectedPlan && ` · ${dt(selectedPlan.price_tnd)} DT`}
                </Button>

                {/* Names the form before it arrives. Somebody who taps a button
                    that says "continue" and gets an account form instead reads
                    that as a bait; the button says what happens, and this says
                    why it is needed at all. */}
                {!signedIn && (
                  <p className="-mt-1 text-center text-xs leading-relaxed text-muted">
                    {t(locale, "co.next_signup_why")}
                  </p>
                )}

                {/* With the trial off this is a trapdoor: /dashboard is gated,
                    so "keep using the free plan" would bounce straight back
                    here. An unpaid account leaves via Settings → sign out. */}
                {REVERSE_TRIAL && (
                  <Link
                    href="/dashboard"
                    className="text-center text-xs font-bold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
                  >
                    {t(locale, "co.stay_free")}
                  </Link>
                )}
              </>
            )}
          </>
        )}

        {step === 2 && selectedPlan && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "co.s2")}</h1>
            </div>

            {/* Coming back to an order that was saved and never proved. Says
                what is outstanding, rather than the old review screen's claim
                that a payment nobody had evidence of was being checked. */}
            {hasOpenRequest && !hasProof && (
              <div className="flex flex-col gap-1 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                <p className="text-sm font-bold">{t(locale, "co.saved_title")}</p>
                <p className="text-xs leading-relaxed text-muted">{t(locale, "co.saved_body")}</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3">
              <span className="flex flex-col">
                <span className="text-xs text-muted">{t(locale, "plans.your_choice")}</span>
                <span className="font-bold text-ink">
                  {tierLabel(tier)} · {monthsLabel(selectedPlan.months)}
                </span>
              </span>
              <span className="flex flex-col text-end">
                <span className="text-xs text-muted">{t(locale, "co.you_pay")}</span>
                <span className="text-xl font-extrabold tabular-nums text-ink">
                  {dt(selectedPlan.price_tnd)} DT
                </span>
              </span>
            </div>

            <Card>
              <CardContent className="p-4">
                <PaymentMethods
                  locale={locale}
                  methods={methods}
                  selectedKey={methodKey}
                  onSelect={setMethodKey}
                />
              </CardContent>
            </Card>

            {/* The receipt, on the same screen as the account number it is a
                receipt for. This is the whole point of the merge: the customer
                is looking at the transfer details while they attach proof of
                the transfer, instead of being sent to a second screen after
                the only part they think of as paying is already done. */}
            <Card>
              <CardContent className="flex flex-col gap-4 p-4">
                <p className="text-sm font-bold text-ink">{t(locale, "co.attach_receipt")}</p>
                <ProofPicker
                  locale={locale}
                  file={file}
                  previewUrl={previewUrl}
                  note={note}
                  setNote={setNote}
                  onPick={pickFile}
                  inputRef={fileInput}
                />
              </CardContent>
            </Card>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}

            <Button
              onClick={hasOpenRequest ? sendProof : payAndSend}
              disabled={isPending || !activeMethod || !file}
              size="lg"
              className="w-full"
            >
              {isPending ? t(locale, "co.sending") : t(locale, "co.pay_and_send")}
            </Button>

            {/* Said here, where the decision is, instead of on the screen
                after it — which is where the only mention of timing used to
                live, i.e. after the customer had already committed. */}
            <p className="text-center text-xs leading-relaxed text-muted">
              {t(locale, "co.promise")}
            </p>

            {/* For somebody who has not opened their bank app yet. It logs the
                request so they are reachable and comes back here, rather than
                leaving them no option but to abandon the screen entirely. */}
            {!hasOpenRequest && (
              <button
                type="button"
                onClick={saveForLater}
                disabled={isPending || !activeMethod}
                className="text-center text-xs font-bold text-muted underline decoration-dotted underline-offset-4 hover:text-ink disabled:opacity-50"
              >
                {t(locale, "co.later")}
              </button>
            )}

            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-center text-xs font-bold text-muted hover:text-ink"
            >
              ← {t(locale, "co.back")}
            </button>
            {helpLink}
          </>
        )}

      </div>
    </Shell>
  );
}

/**
 * The conversation attached to an open payment.
 *
 * The one screen in the flow where the customer has already parted with money
 * and cannot do anything but wait. Before this, "the transfer didn't come
 * through" or "the screenshot is unreadable" had no way to reach them and no
 * way for them to answer — the request was simply rejected and they landed back
 * at step one with no idea why.
 *
 * Deliberately in place on the review card rather than a link to /support: a
 * customer mid-payment should not have to discover a separate reporting flow
 * and describe from memory which payment they mean.
 */
function PaymentThreadPanel({
  locale,
  thread,
}: {
  locale: Locale;
  thread: PaymentThread;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { ticketId, hasUnreadReply } = thread;

  // Opening the page is reading it. The dot exists to bring them back here; once
  // they are here it has done its job.
  useEffect(() => {
    if (!hasUnreadReply) return;
    void markPaymentThreadSeen(ticketId);
  }, [hasUnreadReply, ticketId]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const res = await sendPaymentMessage(text);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="font-display font-bold">{t(locale, "pt.title")}</p>
        <p className="text-xs leading-relaxed text-muted">{t(locale, "pt.opened")}</p>

        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {thread.messages.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted">{t(locale, "pt.empty")}</p>
          ) : (
            thread.messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2",
                  message.sender === "admin"
                    ? "self-start bg-white/5"
                    : "self-end bg-accent/10 text-ink",
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  {message.sender === "admin" ? t(locale, "pt.from_us") : t(locale, "pt.from_you")}
                </p>
                <p className="whitespace-pre-line text-sm">{message.body}</p>
              </div>
            ))
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={t(locale, "pt.placeholder")}
            className="w-full flex-1 resize-none rounded-2xl border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/60 focus:border-accent/60"
          />
          <Button
            size="icon"
            onClick={send}
            disabled={isPending || !draft.trim()}
            aria-label={t(locale, "pt.send")}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Two dots and a label — enough to say "this ends", which one screen never did. */
function StepBar({ locale, step }: { locale: Locale; step: number }) {
  const labels: StringKey[] = ["co.s1", "co.s2"];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">
        {t(locale, "co.step")} {step} {t(locale, "co.of")} 2 · {t(locale, labels[step - 1])}
      </p>
      <div className="flex gap-1.5">
        {[1, 2].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              n <= step ? "bg-accent" : "bg-white/10",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function ProofPicker({
  locale,
  file,
  previewUrl,
  note,
  setNote,
  onPick,
  inputRef,
}: {
  locale: Locale;
  file: File | null;
  previewUrl: string | null;
  note: string;
  setNote: (v: string) => void;
  onPick: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={PROOF_ACCEPT}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />

      {previewUrl ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative overflow-hidden rounded-2xl border border-accent/40"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="max-h-56 w-full object-contain bg-black/40" />
          <span className="block bg-surface px-3 py-2 text-center text-xs font-bold text-accent">
            {t(locale, "co.change_file")}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline bg-surface px-4 py-8 text-muted transition-colors hover:border-accent/50 hover:text-ink"
        >
          <ImageUp className="h-7 w-7" />
          <span className="font-display text-sm font-bold">{t(locale, "co.choose_file")}</span>
        </button>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-muted">{t(locale, "co.note_label")}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={t(locale, "co.note_ph")}
          className="w-full resize-none rounded-2xl border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/60 focus:border-accent/60"
        />
      </label>

      {file && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Lock className="h-3 w-3" />
          {file.name}
        </p>
      )}
    </div>
  );
}

function Shell({
  direction,
  children,
}: {
  direction: "rtl" | "ltr";
  children: React.ReactNode;
}) {
  return (
    <main
      dir={direction}
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
    >
      <div className="mb-8">
        <Logo />
      </div>
      {children}
    </main>
  );
}
