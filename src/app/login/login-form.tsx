"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { type Locale, t } from "@/lib/i18n";

type Mode = "signin" | "signup";

export function LoginForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") ? t(locale, "login.failed") : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    startTransition(async () => {
      if (mode === "signin") {
        const res = await signInWithPassword(email, password);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(next);
        router.refresh();
      } else {
        const res = await signUpWithPassword(email, password, fullName);
        if (!res.ok) {
          setError(res.error);
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
        setError(res.error);
        return;
      }
      window.location.href = res.data;
    });
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Logo />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {mode === "signin"
              ? t(locale, "login.signin_title")
              : t(locale, "login.signup_title")}
          </CardTitle>
          <CardDescription>
            {mode === "signin"
              ? t(locale, "login.signin_sub")
              : t(locale, "login.signup_sub")}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "signup" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fullName">{t(locale, "login.full_name")}</Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t(locale, "login.full_name_ph")}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t(locale, "login.email")}</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

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
              <p className="text-sm text-red-500" role="alert">
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
                  : t(locale, "login.create_account")}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-hairline" />
            <span className="text-xs text-muted">{t(locale, "login.or")}</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={handleGoogle}
            className="w-full"
          >
            {t(locale, "login.google")}
          </Button>

          <p className="text-center text-sm text-muted">
            {mode === "signin" ? (
              <>
                {t(locale, "login.no_account")}{" "}
                <button
                  type="button"
                  className="font-semibold text-accent"
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
                  className="font-semibold text-accent"
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
        </CardContent>
      </Card>
    </main>
  );
}
