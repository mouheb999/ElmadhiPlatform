"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t, type Locale } from "@/lib/i18n";
import {
  lookupWorkoutHistory,
  resetWorkoutHistory,
  type ResetResult,
  type WorkoutHistorySummary,
} from "@/app/actions/admin-users";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function AdminUsersClient({ locale }: { locale: Locale }) {
  const [email, setEmail] = useState("");
  const [summary, setSummary] = useState<WorkoutHistorySummary | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ResetResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function lookup() {
    setError(null);
    setDone(null);
    setSummary(null);
    setConfirmEmail("");
    startTransition(async () => {
      const result = await lookupWorkoutHistory(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary(result.data);
    });
  }

  function reset() {
    if (!summary) return;
    setError(null);
    startTransition(async () => {
      const result = await resetWorkoutHistory(summary.userId, confirmEmail);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result.data);
      setSummary(null);
      setConfirmEmail("");
    });
  }

  const confirmed =
    summary !== null &&
    confirmEmail.trim().toLowerCase() === summary.email.trim().toLowerCase();
  const nothingToReset = summary !== null && summary.sessionCount === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && email.trim()) lookup();
          }}
          placeholder={t(locale, "admin.users_email_placeholder")}
          className="sm:flex-1"
        />
        <Button onClick={lookup} disabled={isPending || !email.trim()}>
          <Search />
          {t(locale, "admin.users_lookup")}
        </Button>
      </div>

      {error && (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {done && (
        <div className="flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <div className="font-bold">{t(locale, "admin.users_reset_done")}</div>
            <div className="text-muted">
              {done.sessionsDeleted} {t(locale, "admin.users_sessions")} ·{" "}
              {done.setsDeleted} {t(locale, "admin.users_sets")} · {done.eventsDeleted}{" "}
              {t(locale, "admin.users_events")}
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-4">
          <div>
            <div className="font-bold">{summary.fullName ?? summary.email}</div>
            <div className="text-xs text-muted" dir="ltr">
              {summary.email}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t(locale, "admin.users_sessions"), value: summary.sessionCount },
              { label: t(locale, "admin.users_sets"), value: summary.setCount },
              { label: t(locale, "admin.users_events"), value: summary.completionEventCount },
              { label: t(locale, "admin.users_open"), value: summary.openSessionCount },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-hairline px-3 py-2 text-center"
              >
                <div className="text-xl font-extrabold">{stat.value}</div>
                <div className="text-xs text-muted">{stat.label}</div>
              </div>
            ))}
          </div>

          <p className="rounded-2xl border border-hairline px-4 py-3 text-xs text-muted">
            {t(locale, "admin.users_plan_safe")}{" "}
            <span className="font-bold text-ink">
              {summary.activeProgramName ?? t(locale, "admin.users_no_program")}
            </span>
          </p>

          {summary.sessions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-start text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="px-2 py-2 text-start font-bold">
                      {t(locale, "admin.users_day")}
                    </th>
                    <th className="px-2 py-2 text-start font-bold">
                      {t(locale, "admin.users_started")}
                    </th>
                    <th className="px-2 py-2 text-start font-bold">
                      {t(locale, "admin.users_finished")}
                    </th>
                    <th className="px-2 py-2 text-start font-bold">
                      {t(locale, "admin.users_sets")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.sessions.map((s) => (
                    <tr key={s.id} className="border-t border-hairline">
                      <td className="px-2 py-2 font-bold">{s.dayName ?? "—"}</td>
                      <td className="px-2 py-2 text-muted" dir="ltr">
                        {formatDate(s.startedAt)}
                      </td>
                      <td className="px-2 py-2 text-muted" dir="ltr">
                        {s.completedAt
                          ? formatDate(s.completedAt)
                          : t(locale, "admin.users_in_progress")}
                      </td>
                      <td className="px-2 py-2">{s.setCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {nothingToReset ? (
            <p className="text-sm text-muted">{t(locale, "admin.users_nothing")}</p>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-500/40 bg-red-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <p className="text-sm text-muted">{t(locale, "admin.users_warning")}</p>
              </div>
              <Input
                dir="ltr"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={summary.email}
                aria-label={t(locale, "admin.users_confirm_label")}
              />
              <Button
                variant="secondary"
                onClick={reset}
                disabled={isPending || !confirmed}
                className="border-red-500/40 text-red-400 hover:bg-red-500/10"
              >
                {t(locale, "admin.users_reset")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
