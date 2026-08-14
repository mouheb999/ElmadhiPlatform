"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, ImageUp, Lock, Sparkles } from "lucide-react";
import { attachPaymentProof, startPaymentRequest } from "@/app/actions/payment";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type Locale, dir, pick, t, type StringKey } from "@/lib/i18n";
import { type LockedFeature } from "@/lib/access";
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

type Props = {
  locale: Locale;
  email: string;
  paymentStatus: string;
  planExpiresAt: string | null;
  isRenewal: boolean;
  hasProof: boolean;
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
  paymentStatus,
  planExpiresAt,
  isRenewal,
  hasProof,
  from,
  settings,
  methods,
  plans,
}: Props) {
  const router = useRouter();
  const direction = dir(locale);

  const [step, setStep] = useState(1);
  const [tier, setTier] = useState<Tier>("premium");
  // Psychological default: the middle option, not the cheapest.
  const [months, setMonths] = useState<number>(3);
  const [methodKey, setMethodKey] = useState<string | null>(methods[0]?.key ?? null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const offerLabel = pick(locale, settings?.offer_label_en, settings?.offer_label_ar);
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

  const activeMonths = selectedPlan?.months ?? months;
  const premiumUpgradePerMonth = useMemo(() => {
    const std = plans.find((p) => p.tier === "standard" && p.months === activeMonths);
    const prem = plans.find((p) => p.tier === "premium" && p.months === activeMonths);
    if (!std || !prem) return null;
    const delta = (prem.price_tnd - std.price_tnd) / activeMonths;
    return delta > 0 ? delta : null;
  }, [plans, activeMonths]);

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

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      /* clipboard not available */
    }
  }

  function pickFile(next: File | null) {
    setError(null);
    if (!next) return;
    if (!next.type.startsWith("image/")) {
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
   * Logs the request before the receipt exists. Somebody who transfers the
   * money and then closes the app still shows up in the admin queue, which is
   * the case the old flow lost entirely.
   */
  function confirmTransfer() {
    if (!activeMethod || !selectedPlan) return;
    setError(null);
    startTransition(async () => {
      const res = await startPaymentRequest(activeMethod.key, selectedPlan.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStep(3);
    });
  }

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
  if (paymentStatus === "pending") {
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

              {hasProof ? (
                <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-accent">
                  <Check className="h-4 w-4" />
                  {t(locale, "co.review_have_proof")}
                </p>
              ) : (
                <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                  <p className="text-sm font-semibold">{t(locale, "co.review_no_proof")}</p>
                  <ProofPicker
                    locale={locale}
                    file={file}
                    previewUrl={previewUrl}
                    note={note}
                    setNote={setNote}
                    onPick={pickFile}
                    inputRef={fileInput}
                  />
                  {error && (
                    <p className="text-sm text-red-500" role="alert">
                      {error}
                    </p>
                  )}
                  <Button onClick={sendProof} disabled={isPending || !file} className="w-full">
                    {isPending ? t(locale, "co.sending") : t(locale, "co.submit")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* The point of the whole rebuild: waiting on review is not being
              locked out. The plan they just built is still readable. */}
          <p className="text-center text-xs text-muted">{t(locale, "co.meanwhile")}</p>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/dashboard">{t(locale, "checkout.go_dashboard")}</Link>
          </Button>
          {helpLink}
        </div>
      </Shell>
    );
  }

  // ---- The three steps ----
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

            {isRenewal && (
              <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm font-semibold">
                {t(locale, "checkout.renewal_banner")}
              </p>
            )}

            {plans.length === 0 ? (
              <p className="rounded-2xl border border-hairline bg-surface px-4 py-3 text-center text-sm text-muted">
                {t(locale, "checkout.no_plans")}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
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

                {offerLabel && (
                  <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                    </span>
                    {offerLabel}
                  </div>
                )}

                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedPlan}
                  size="lg"
                  className="w-full"
                >
                  {t(locale, "co.next")}
                  {selectedPlan && ` · ${dt(selectedPlan.price_tnd)} DT`}
                </Button>
              </>
            )}
          </>
        )}

        {step === 2 && selectedPlan && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "co.s2")}</h1>
            </div>

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
              <CardContent className="flex flex-col gap-3 p-4">
                <p className="text-sm font-bold text-ink">{t(locale, "checkout.choose_method")}</p>
                {methods.map((m) => {
                  const label = pick(locale, m.label_en, m.label_ar);
                  const instructions = pick(locale, m.instructions_en, m.instructions_ar);
                  const isOpen = methodKey === m.key;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "overflow-hidden rounded-2xl border transition-colors",
                        isOpen ? "border-accent/50 bg-white/5" : "border-hairline",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setMethodKey(m.key)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
                      >
                        <span className="font-bold text-ink">{label}</span>
                        <span
                          className={cn(
                            "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                            isOpen ? "border-accent bg-accent text-bg" : "border-hairline",
                          )}
                          aria-hidden
                        >
                          {isOpen && <Check className="h-3 w-3" />}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="flex flex-col gap-3 border-t border-hairline px-4 py-3">
                          {instructions && (
                            <p className="whitespace-pre-line text-sm text-muted">{instructions}</p>
                          )}
                          {m.account_value && (
                            <>
                              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                                {t(locale, "co.send_to")}
                              </p>
                              <div className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-surface px-3 py-2">
                                <code className="truncate text-sm text-ink" dir="ltr">
                                  {m.account_value}
                                </code>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => copy(m.account_value!, m.key)}
                                >
                                  {copiedKey === m.key
                                    ? t(locale, "checkout.copied")
                                    : t(locale, "checkout.copy")}
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {error && (
                  <p className="text-sm text-red-500" role="alert">
                    {error}
                  </p>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={confirmTransfer}
              disabled={isPending || !activeMethod}
              size="lg"
              className="w-full"
            >
              {isPending ? "…" : t(locale, "co.transfer_done")}
            </Button>
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

        {step === 3 && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-extrabold tracking-tight">{t(locale, "co.upload_title")}</h1>
              <p className="mt-1 text-sm text-muted">{t(locale, "co.upload_body")}</p>
            </div>

            <Card>
              <CardContent className="flex flex-col gap-4 p-4">
                <ProofPicker
                  locale={locale}
                  file={file}
                  previewUrl={previewUrl}
                  note={note}
                  setNote={setNote}
                  onPick={pickFile}
                  inputRef={fileInput}
                />
                {error && (
                  <p className="text-sm text-red-500" role="alert">
                    {error}
                  </p>
                )}
                <Button onClick={sendProof} disabled={isPending || !file} size="lg" className="w-full">
                  {isPending ? t(locale, "co.sending") : t(locale, "co.submit")}
                </Button>
              </CardContent>
            </Card>
            {helpLink}
          </>
        )}
      </div>
    </Shell>
  );
}

/** Three dots and a label — enough to say "this ends", which one screen never did. */
function StepBar({ locale, step }: { locale: Locale; step: number }) {
  const labels: StringKey[] = ["co.s1", "co.s2", "co.s3"];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">
        {t(locale, "co.step")} {step} {t(locale, "co.of")} 3 · {t(locale, labels[step - 1])}
      </p>
      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
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
        accept="image/*"
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
