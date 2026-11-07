"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { deleteMyAccount } from "@/app/actions/account";
import { DELETE_CONFIRMATION, type DeleteAccountError } from "@/lib/account-deletion";
import { BottomSheet } from "@/components/shared/bottom-sheet";

/**
 * The red button and its confirm sheet. Two deliberate taps, nothing typed:
 * enough that a stray tap deletes nothing, without turning a right the stores
 * require into an obstacle course.
 *
 * On success the action redirects to the signed-out confirmation page, so
 * this component only ever has to show the failure cases.
 */
export function DeleteAccountButton({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<DeleteAccountError | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteMyAccount(DELETE_CONFIRMATION);
      // A redirect never returns here; anything that does is a refusal.
      if (result && !result.ok) {
        setError(result.error === "admin" ? "admin" : "failed");
        setOpen(false);
      }
    });
  }

  return (
    <>
      {error && (
        <p role="alert" className="rounded-2xl bg-danger/[0.12] px-4 py-3.5 text-[15px]">
          {t(locale, error === "admin" ? "account.delete_admin" : "account.delete_failed")}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press flex h-14 items-center justify-center gap-2 rounded-full bg-danger text-[17px] font-semibold text-white"
      >
        <Trash2 className="h-5 w-5" />
        {t(locale, "account.delete_button")}
      </button>

      <BottomSheet
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title={t(locale, "account.delete_confirm_title")}
        cancelLabel={t(locale, "home.cancel")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-[15px] text-muted">{t(locale, "account.delete_confirm_body")}</p>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="press flex h-14 items-center justify-center rounded-full bg-danger text-[17px] font-semibold text-white disabled:opacity-60"
          >
            {pending ? t(locale, "account.deleting") : t(locale, "account.delete_confirm_yes")}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
