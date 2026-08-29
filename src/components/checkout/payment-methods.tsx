"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Bitcoin, Check, Copy, Landmark, Plus, Send } from "lucide-react";
import { suggestPaymentMethod } from "@/app/actions/payment";
import { cn } from "@/lib/utils";
import { type Locale, pick, t } from "@/lib/i18n";
import type { Database } from "@/types/db";

type Method = Database["public"]["Tables"]["payment_methods"]["Row"];

/**
 * How you pay, as a thing you recognise rather than a thing you read.
 *
 * The old picker was four identical rows of text with a radio circle, and
 * choosing one unrolled the full eight-step walkthrough of somebody else's app
 * — 380 to 715 characters — between the customer and the button. Nobody reads
 * that at the till. They already know how their own bank app works; what they
 * need is to spot their method, get the number, and go.
 *
 * So: a grid of marks you pick out at a glance, and one panel under it with
 * the number big and copiable and a single line of anything that number does
 * not already say. The full instructions still exist in the database, and can
 * be put back behind a "how does this work" disclosure if the support inbox
 * says people want them — but they are not the default view of this screen.
 */
export function PaymentMethods({
  locale,
  methods,
  selectedKey,
  onSelect,
}: {
  locale: Locale;
  methods: Method[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const active = methods.find((m) => m.key === selectedKey) ?? null;

  async function copyAccount(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the number is on screen and selectable */
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold text-ink">{t(locale, "checkout.choose_method")}</p>

      <div className="grid grid-cols-3 gap-2">
        {methods.map((m) => {
          const selected = m.key === selectedKey;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setCopied(false);
                onSelect(m.key);
              }}
              aria-pressed={selected}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all duration-150",
                selected
                  ? "border-accent bg-accent/5 ring-1 ring-accent"
                  : "border-hairline bg-surface hover:border-white/20",
              )}
            >
              <BrandMark method={m} />
              <span
                className={cn(
                  "line-clamp-1 text-[11px] font-bold",
                  selected ? "text-ink" : "text-muted",
                )}
              >
                {pick(locale, m.label_en, m.label_ar)}
              </span>
            </button>
          );
        })}
      </div>

      {/* One panel, under the grid, for whichever method is chosen. Keeping it
          outside the tiles means picking a different method swaps the contents
          instead of reflowing the whole list under your thumb. */}
      {active && (
        <div className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/[0.04] p-4">
          {active.account_value ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                {t(locale, "co.send_to")}
              </p>
              <button
                type="button"
                onClick={() => copyAccount(active.account_value!)}
                className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-bg px-3 py-3 text-start transition-colors hover:border-accent/50"
              >
                <code
                  dir="ltr"
                  className="min-w-0 flex-1 truncate font-display text-[15px] font-bold text-ink"
                >
                  {active.account_value}
                </code>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors",
                    copied ? "bg-accent text-bg" : "bg-white/10 text-ink",
                  )}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t(locale, "checkout.copied") : t(locale, "checkout.copy")}
                </span>
              </button>
            </>
          ) : (
            // A method switched on before its details were filled in. Better to
            // say so than to show an empty box beside a Copy button.
            <p className="text-sm font-semibold text-amber-400">
              {t(locale, "co.method_no_account")}
            </p>
          )}

          {pick(locale, active.hint_en, active.hint_ar) && (
            <p className="text-[12.5px] leading-relaxed text-muted">
              {pick(locale, active.hint_en, active.hint_ar)}
            </p>
          )}
        </div>
      )}

      <SuggestMethod locale={locale} />
    </div>
  );
}

/**
 * The brand, or a stand-in for it.
 *
 * `logo_url` is the real thing once somebody uploads one. Until then this
 * draws a tile from the method's key — a monogram or a glyph in a colour of
 * its own — so the grid reads as a set of distinct things from the first
 * deploy rather than as six identical grey squares waiting on an asset.
 */
function BrandMark({ method }: { method: Method }) {
  if (method.logo_url) {
    return (
      <span className="relative h-9 w-9 overflow-hidden rounded-xl bg-white/5">
        <Image src={method.logo_url} alt="" fill sizes="36px" className="object-contain p-1" />
      </span>
    );
  }

  const brand = BRANDS[method.key] ?? {
    tint: "#8E9280",
    // Anything an admin adds later gets its first letter rather than nothing.
    text: method.label_en.slice(0, 2).toUpperCase(),
  };

  return (
    <span
      className="grid h-9 w-9 place-items-center rounded-xl"
      style={{ backgroundColor: `${brand.tint}22`, color: brand.tint }}
      aria-hidden
    >
      {brand.icon ? (
        <brand.icon className="h-[18px] w-[18px]" />
      ) : (
        <span className="font-display text-[11px] font-extrabold leading-none tracking-tight">
          {brand.text}
        </span>
      )}
    </span>
  );
}

/**
 * Tints, not trademarks.
 *
 * Each mark is a monogram or a generic glyph in a colour that tells it apart
 * from its neighbours. Deliberately not an attempt to reproduce a brand's
 * actual logo from memory — a nearly-right logo looks worse than an honest
 * placeholder, and `logo_url` is there for the real files.
 */
const BRANDS: Record<
  string,
  { tint: string; text?: string; icon?: typeof Landmark }
> = {
  d17: { tint: "#F5A623", text: "D17" },
  flouci: { tint: "#4C8DFF", text: "FL" },
  bank: { tint: "#9DA18B", icon: Landmark },
  crypto: { tint: "#26A17B", icon: Bitcoin },
  western_union: { tint: "#FFCC00", text: "WU" },
  wafacash: { tint: "#E8622D", text: "WC" },
};

/**
 * "My method isn't here."
 *
 * The list is four options in a country where people pay in a dozen ways, and
 * somebody who cannot find theirs currently has one move: leave. This is the
 * cheapest possible alternative to leaving — it says what they use, we get a
 * ping, and somebody answers them.
 *
 * Filed as an ordinary support ticket in the `payment` category rather than a
 * table of its own: it lands in the queue an admin already reads, it already
 * rings a phone, and it is already a conversation the customer can be answered
 * in. A second inbox nobody checks is worse than no inbox.
 */
function SuggestMethod({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    const body = text.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await suggestPaymentMethod(body);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <p className="flex items-center justify-center gap-1.5 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 text-center text-xs font-bold text-accent">
        <Check className="h-4 w-4 shrink-0" />
        {t(locale, "co.suggest_sent")}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 self-center text-xs font-bold text-muted underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
      >
        <Plus className="h-3.5 w-3.5" />
        {t(locale, "co.suggest_cta")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-3">
      <p className="text-xs font-bold text-ink">{t(locale, "co.suggest_title")}</p>
      <div className="flex items-end gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={120}
          autoFocus
          placeholder={t(locale, "co.suggest_ph")}
          className="h-11 w-full flex-1 rounded-xl border border-hairline bg-bg px-3 text-sm text-ink outline-none placeholder:text-muted/60 focus:border-accent/60"
        />
        <button
          type="button"
          onClick={send}
          disabled={isPending || !text.trim()}
          aria-label={t(locale, "co.suggest_send")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-bg transition-transform active:scale-95 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
      <p className="text-[11px] leading-relaxed text-muted">{t(locale, "co.suggest_note")}</p>
    </div>
  );
}
