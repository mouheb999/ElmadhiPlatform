"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t, type Locale } from "@/lib/i18n";
import { setQaMonthlyLimit } from "@/app/actions/qa";

export type QuotaRow = {
  userId: string;
  email: string | null;
  used: number;
  pending: number;
  published: number;
  lastAskedAt: string | null;
};

/** Admin view of the monthly ask allowance: the limit, and who spent it. */
export function QaQuotaClient({
  locale,
  limit,
  rows,
  monthLabel,
}: {
  locale: Locale;
  limit: number;
  rows: QuotaRow[];
  monthLabel: string;
}) {
  const [value, setValue] = useState(String(limit));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setQaMonthlyLimit(Number(value));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-5">
      <div>
        <h2 className="font-bold">{t(locale, "admin.qa_quota_title")}</h2>
        <p className="text-sm text-muted">{t(locale, "admin.qa_quota_sub")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">{t(locale, "admin.qa_quota_limit")}</span>
          <Input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-28"
          />
        </label>
        <Button size="sm" onClick={save} disabled={isPending || value === "" || Number(value) === limit}>
          {t(locale, "admin.qa_quota_save")}
        </Button>
        {saved && <span className="text-sm text-accent">{t(locale, "admin.qa_quota_saved")}</span>}
        {error && <span className="text-sm text-red-300">{error}</span>}
      </div>

      <div>
        <div className="mb-2 text-xs font-bold text-muted">
          {t(locale, "admin.qa_quota_usage")} · {monthLabel}
        </div>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted">{t(locale, "admin.qa_quota_none")}</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-start text-xs text-muted">
                  <th className="py-2 text-start font-bold">{t(locale, "admin.qa_quota_user")}</th>
                  <th className="py-2 text-start font-bold">{t(locale, "admin.qa_quota_used")}</th>
                  <th className="py-2 text-start font-bold">{t(locale, "admin.qa_quota_pending")}</th>
                  <th className="py-2 text-start font-bold">{t(locale, "admin.qa_quota_published")}</th>
                  <th className="py-2 text-start font-bold">{t(locale, "admin.qa_quota_last")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId} className="border-t border-hairline">
                    <td className="py-2 pe-3">{row.email ?? row.userId.slice(0, 8)}</td>
                    <td className={row.used >= limit ? "py-2 pe-3 font-bold text-amber-300" : "py-2 pe-3"}>
                      {row.used} / {limit}
                    </td>
                    <td className="py-2 pe-3">{row.pending}</td>
                    <td className="py-2 pe-3">{row.published}</td>
                    <td className="py-2 text-muted">
                      {row.lastAskedAt ? new Date(row.lastAskedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
