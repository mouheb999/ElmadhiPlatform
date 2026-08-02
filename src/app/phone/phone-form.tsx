"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePhone } from "@/app/actions/profile";
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
import { isValidPhone } from "@/lib/phone";

export function PhoneForm({ locale, next }: { locale: Locale; next: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Same check the Server Function runs, just without the round-trip.
    if (!isValidPhone(phone)) {
      setError(t(locale, "phone.invalid"));
      return;
    }

    startTransition(async () => {
      const res = await savePhone(phone);
      if (!res.ok) {
        setError(
          res.error === "invalid" ? t(locale, "phone.invalid") : res.error,
        );
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Logo />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t(locale, "phone.title")}</CardTitle>
          <CardDescription>{t(locale, "phone.sub")}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">{t(locale, "phone.label")}</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                // Numbers are always LTR, even when the page is RTL.
                dir="ltr"
                required
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t(locale, "login.phone_ph")}
              />
              <p className="text-xs text-muted">{t(locale, "phone.why")}</p>
            </div>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? t(locale, "phone.saving") : t(locale, "phone.save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
