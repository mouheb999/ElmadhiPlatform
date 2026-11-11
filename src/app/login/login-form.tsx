"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogle,
} from "@/app/actions/auth";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type Locale, monthsLabel, t, type StringKey } from "@/lib/i18n";
import { safeNextPath } from "@/lib/safe-redirect";
import { isValidPhone } from "@/lib/phone";
import { trackMeta } from "@/lib/meta/pixel";
import { TRIAL_DAYS } from "@/lib/subscription";
import { SIGNUP_DONE, trackStep } from "@/lib/funnel/track";

type Mode = "signin" | "signup";

/**
 * The codes `actions/auth.ts` returns, in the reader's own language.
 *
 * The form used to print whatever came back from the auth server. That is
 * English in an Arabic UI at best, and at worst a JavaScript parse error shown
 * to somebody halfway through creating an account. Anything not in this map
 * falls back to the generic line rather than being displayed raw.
 */
const AUTH_ERRORS: Record<string, StringKey> = {
  auth_bad_credentials: "login.err_bad_credentials",
  auth_email_taken: "login.err_email_taken",
  auth_weak_password: "login.err_weak_password",
  auth_email_unconfirmed: "login.err_email_unconfirmed",
  auth_rate_limited: "login.err_rate_limited",
  auth_unavailable: "login.err_unavailable",
  auth_phone_taken: "login.err_phone_taken",
  invalid_phone: "phone.invalid",
};

export function LoginForm({
  locale,
  plan,
}: {
  locale: Locale;
  /** The plan they picked before being sent here, if they came from checkout. */
  plan?: { tier: string; months: number; price_tnd: number } | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  // Narrowed to a same-origin path: `?next=` is attacker-controlled, and
  // router.push() will happily leave the site for an absolute URL. Sending a
  // user somewhere else the instant they hand over a real password is the
  // single best moment to phish them.
  const next = safeNextPath(params.get("next"));

  // ?mode=signup opens on the signup form. The landing site's "Join us" button
  // sets it: everyone arriving from there is new by definition, and dropping
  // them on "Sign in" makes them hunt for the small "create one" link before
  // they can do the thing they just clicked. Anything else falls back to
  // sign-in, which is the right default for someone who typed the URL.
  const [mode, setMode] = useState<Mode>(
    params.get("mode") === "signup" ? "signup" : "signin",
  );
  // One field for sign-in: a phone number or an email. Sign-up only ever asks
  // for the number — see `phoneLoginEmail` in lib/phone.ts.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") ? t(locale, "login.failed") : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdminChoice, setShowAdminChoice] = useState(false);
  const [isPending, startTransition] = useTransition();

  /** A code from the auth actions, localised; anything else, the generic line. */
  function authMessage(code: string): string {
    const key = AUTH_ERRORS[code];
    return key ? t(locale, key) : t(locale, "login.failed");
  }

  function goTo(path: string) {
    startTransition(() => {
      router.push(path);
      router.refresh();
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    startTransition(async () => {
      if (mode === "signin") {
        const res = await signInWithPassword(identifier, password);
        if (!res.ok) {
          setError(authMessage(res.error));
          return;
        }
        // Identify the user in PostHog and capture sign-in event.
        if (res.data.userId) {
          posthog.identify(res.data.userId);
          posthog.capture("user_signed_in", {
            method: identifier.includes("@") ? "email" : "phone",
          });
        }
        // Admins pick a destination; regular users go straight in.
        if (res.data.isAdmin) {
          setShowAdminChoice(true);
          return;
        }
        router.push(next);
        router.refresh();
      } else {
        if (!isValidPhone(phone)) {
          setError(t(locale, "phone.invalid"));
          return;
        }
        const res = await signUpWithPassword(phone, password);
        if (!res.ok) {
          setError(authMessage(res.error));
          return;
        }
        // Signed up and signed in, which is the configured behaviour: straight
        // in, no inbox to check.
        //
        // A new account goes to `next`, which is /dashboard unless they came
        // from checkout with a plan chosen. Every new account has three days
        // of the whole product (migration 058), so the dashboard is a real
        // destination: the first screen after signing up is the app, with
        // their own numbers in it, rather than a price.
        // Browser half of CompleteRegistration; same id as the server's.
        if (res.data.registrationEventId) {
          trackMeta("CompleteRegistration", undefined, res.data.registrationEventId);
        }
        if (res.data.signedIn) {
          // The step the funnel could never see: everything before this was
          // measured on /start and everything after it on /checkout, with the
          // account form — the single biggest ask in the flow — a gap between
          // two reports.
          trackStep(SIGNUP_DONE, locale);
          // Identify the new user in PostHog and capture sign-up event.
          if (res.data.userId) {
            posthog.identify(res.data.userId);
            posthog.capture("user_signed_up", { method: "phone" });
          }
          router.push(next);
          router.refresh();
          return;
        }
        setNotice(t(locale, "login.check_inbox"));
        setMode("signin");
      }
    });
  }

  function handleGoogle() {
    setError(null);
    startTransition(async () => {
      const res = await signInWithGoogle();
      if (!res.ok) {
        setError(authMessage(res.error));
        return;
      }
      window.location.href = res.data;
    });
  }

  if (showAdminChoice) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
        <div className="mb-8">
          <Logo />
        </div>

        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{t(locale, "login.choose_title")}</CardTitle>
            <CardDescription>{t(locale, "login.choose_sub")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              type="button"
              disabled={isPending}
              onClick={() => goTo("/admin")}
              className="w-full"
            >
              {t(locale, "login.go_admin")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => goTo(next)}
              className="w-full"
            >
              {t(locale, "login.go_app")}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  /*
   * The sign-in screen, drawn the way a native app draws one: the brand at the
   * top, a large title, the fields on the page itself — not boxed into a card,
   * which is a web-form convention — then the primary action in lime and
   * Google as the white button under it.
   *
   * The logo is the one thing deliberately unchanged: the redesign reframes
   * the brand, it does not touch it.
   */
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <div className="mb-10">
        <Logo />
      </div>

      <div className="w-full max-w-sm">
        {/* The purchase, restated above the form, so this reads as the next
            step in something they already decided rather than a gate. */}
        {plan && mode === "signup" && (
          <div className="mb-7 flex items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-4">
            <span className="flex flex-col">
              <span className="text-xs text-muted">{t(locale, "plans.your_choice")}</span>
              {/* One offer now, so the term is the whole description of what
                  they are buying — and the twelve-month term the tier grid
                  never had is named rather than called "6 months" by a chain
                  of ternaries that ran out of branches. */}
              <span className="font-bold text-ink">
                {t(locale, "plans.full_access")} · {monthsLabel(locale, plan.months)}
              </span>
            </span>
            <span className="text-lg font-extrabold tabular-nums text-ink">
              <bdi dir="ltr">{Math.round(plan.price_tnd * 10) / 10} DT</bdi>
            </span>
          </div>
        )}
        <div className="mb-7">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.025em]">
            {mode === "signin"
              ? t(locale, "login.signin_title")
              : plan
                ? t(locale, "login.signup_title")
                : t(locale, "login.trial_title").replace("{days}", String(TRIAL_DAYS))}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted">
            {mode === "signin"
              ? t(locale, "login.signin_sub")
              : plan
                ? t(locale, "login.signup_sub")
                : t(locale, "login.trial_sub")}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "signup" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">{t(locale, "login.phone")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  // Numbers read LTR even when the rest of the page is RTL.
                  dir="ltr"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t(locale, "login.phone_ph")}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="identifier">{t(locale, "login.identifier")}</Label>
                <Input
                  id="identifier"
                  // `text`, not `tel` or `email`: this field takes either, and
                  // a typed keyboard would lock out half the accounts.
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  dir="ltr"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={t(locale, "login.identifier_ph")}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t(locale, "login.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                dir="ltr"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="text-sm text-accent" role="status">
                {notice}
              </p>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending
                ? t(locale, "login.please_wait")
                : mode === "signin"
                  ? t(locale, "login.sign_in")
                  : plan
                    ? t(locale, "login.create_account")
                    : t(locale, "login.trial_cta").replace("{days}", String(TRIAL_DAYS))}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <span className="h-[0.5px] flex-1 bg-white/[0.12]" />
            <span className="text-[13px] text-subtle">{t(locale, "login.or")}</span>
            <span className="h-[0.5px] flex-1 bg-white/[0.12]" />
          </div>

          {/* White, the way native apps present a third-party sign-in. A filled
              grey would read as a lesser option; this is an equal one. */}
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={handleGoogle}
            className="w-full bg-ink text-bg hover:bg-white"
          >
            {t(locale, "login.google")}
          </Button>

          <p className="text-center text-sm text-muted">
            {mode === "signin" ? (
              <>
                {t(locale, "login.no_account")}{" "}
                <button
                  type="button"
                  className="font-bold text-ink"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setNotice(null);
                  }}
                >
                  {t(locale, "login.create_one")}
                </button>
              </>
            ) : (
              <>
                {t(locale, "login.have_account")}{" "}
                <button
                  type="button"
                  className="font-bold text-ink"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setNotice(null);
                  }}
                >
                  {t(locale, "login.sign_in_link")}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
