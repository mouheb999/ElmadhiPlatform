"use client";

import { useRef, useState, useTransition } from "react";
import { uploadImage } from "@/app/actions/storage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type Locale, t } from "@/lib/i18n";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Admin image picker. Uploads to a public Supabase bucket via the `uploadImage`
 * server action and reports back the resulting public URL.
 */
export function ImageUpload({
  locale,
  bucket,
  value,
  onChange,
}: {
  locale: Locale;
  bucket: "food-images" | "exercise-images";
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(t(locale, "image.too_big"));
      return;
    }
    const fd = new FormData();
    fd.set("bucket", bucket);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadImage(fd);
      if (res.ok) onChange(res.data);
      else setError(res.error);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{t(locale, "image.label")}</Label>
      <div className="flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-16 w-16 rounded-2xl border border-hairline object-cover"
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          {isPending ? t(locale, "image.uploading") : t(locale, "image.upload")}
        </Button>
        {value && !isPending && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange(null)}
          >
            {t(locale, "image.remove")}
          </Button>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
