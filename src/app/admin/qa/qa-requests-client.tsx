"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { pick, t, type Locale } from "@/lib/i18n";
import { publishQaRequest, dismissQaRequest } from "@/app/actions/qa";

export type TriageRequest = {
  id: string;
  questionText: string;
  email: string | null;
  createdAt: string | null;
};

export type TriageCategory = {
  id: string;
  nameEn: string | null;
  nameAr: string | null;
};

const TEXTAREA_CLASS =
  "min-h-24 w-full rounded-2xl border border-hairline bg-surface px-4 py-3 text-base text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

type FormState = {
  categoryId: string;
  questionEn: string;
  questionAr: string;
  answerShortEn: string;
  answerShortAr: string;
  answerLongEn: string;
  answerLongAr: string;
};

export function QaRequestsClient({
  locale,
  requests,
  categories,
}: {
  locale: Locale;
  requests: TriageRequest[];
  categories: TriageCategory[];
}) {
  const [items, setItems] = useState(requests);
  const [openId, setOpenId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function formFor(request: TriageRequest): FormState {
    return (
      forms[request.id] ?? {
        categoryId: categories[0]?.id ?? "",
        questionEn: request.questionText,
        questionAr: request.questionText,
        answerShortEn: "",
        answerShortAr: "",
        answerLongEn: "",
        answerLongAr: "",
      }
    );
  }

  function patchForm(id: string, request: TriageRequest, patch: Partial<FormState>) {
    setForms((prev) => ({ ...prev, [id]: { ...formFor(request), ...prev[id], ...patch } }));
  }

  function publish(request: TriageRequest) {
    const form = formFor(request);
    setError(null);
    startTransition(async () => {
      const result = await publishQaRequest(request.id, {
        categoryId: form.categoryId || null,
        questionEn: form.questionEn,
        questionAr: form.questionAr,
        answerShortEn: form.answerShortEn,
        answerShortAr: form.answerShortAr,
        answerLongEn: form.answerLongEn,
        answerLongAr: form.answerLongAr,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((r) => r.id !== request.id));
    });
  }

  function dismiss(request: TriageRequest) {
    setError(null);
    startTransition(async () => {
      const result = await dismissQaRequest(request.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((r) => r.id !== request.id));
    });
  }

  if (items.length === 0) {
    return <p className="py-8 text-center text-muted">{t(locale, "admin.qa_empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">{error}</p>
      )}
      {items.map((request) => {
        const open = openId === request.id;
        const form = formFor(request);
        return (
          <div key={request.id} className="overflow-hidden rounded-2xl border border-hairline bg-surface">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : request.id)}
              className="flex w-full items-center justify-between gap-3 p-4 text-start"
            >
              <div>
                <div className="font-bold">{request.questionText}</div>
                <div className="text-xs text-muted">
                  {t(locale, "admin.qa_from")}: {request.email ?? "—"}
                  {request.createdAt ? ` · ${new Date(request.createdAt).toLocaleDateString()}` : ""}
                </div>
              </div>
              <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted transition-transform", open && "rotate-180")} />
            </button>

            {open && (
              <div className="flex flex-col gap-3 border-t border-hairline p-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-muted">{t(locale, "admin.qa_category")}</span>
                  <select
                    value={form.categoryId}
                    onChange={(e) => patchForm(request.id, request, { categoryId: e.target.value })}
                    className="h-12 rounded-2xl border border-hairline bg-surface px-4 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {pick(locale, c.nameEn, c.nameAr)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-muted">{t(locale, "admin.qa_question_en")}</span>
                    <Input
                      value={form.questionEn}
                      onChange={(e) => patchForm(request.id, request, { questionEn: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-muted">{t(locale, "admin.qa_question_ar")}</span>
                    <Input
                      dir="rtl"
                      value={form.questionAr}
                      onChange={(e) => patchForm(request.id, request, { questionAr: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-muted">{t(locale, "admin.qa_answer_short_en")}</span>
                    <Input
                      value={form.answerShortEn}
                      onChange={(e) => patchForm(request.id, request, { answerShortEn: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-muted">{t(locale, "admin.qa_answer_short_ar")}</span>
                    <Input
                      dir="rtl"
                      value={form.answerShortAr}
                      onChange={(e) => patchForm(request.id, request, { answerShortAr: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-muted">{t(locale, "admin.qa_answer_long_en")}</span>
                    <textarea
                      className={TEXTAREA_CLASS}
                      value={form.answerLongEn}
                      onChange={(e) => patchForm(request.id, request, { answerLongEn: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-muted">{t(locale, "admin.qa_answer_long_ar")}</span>
                    <textarea
                      dir="rtl"
                      className={TEXTAREA_CLASS}
                      value={form.answerLongAr}
                      onChange={(e) => patchForm(request.id, request, { answerLongAr: e.target.value })}
                    />
                  </label>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => publish(request)} disabled={isPending || !form.answerShortEn.trim()}>
                    {t(locale, "admin.qa_publish")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => dismiss(request)} disabled={isPending}>
                    {t(locale, "admin.qa_dismiss")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
