"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, ImageIcon, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { estimateMealAction, logEstimate } from "@/app/actions/ai-estimate";
import type { EstimatedItem } from "@/lib/ai/meal-estimator";
import type { MealSlot } from "@/app/actions/meal-logs";

const SLOTS: { key: MealSlot; en: string; ar: string }[] = [
  { key: "breakfast", en: "Breakfast", ar: "الفطور" },
  { key: "lunch", en: "Lunch", ar: "الغدا" },
  { key: "dinner", en: "Dinner", ar: "العشا" },
  { key: "snack", en: "Snack", ar: "وجبة خفيفة" },
];

const MAX_EDGE = 1024;

type Photo = { base64: string; mediaType: "image/jpeg"; previewUrl: string };

function canvasToPhoto(canvas: HTMLCanvasElement): Photo {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1], mediaType: "image/jpeg", previewUrl: dataUrl };
}

/** Downscale a picked file to ≤1024px JPEG (camera-permission fallback path). */
async function fileToPhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvasToPhoto(canvas);
}

/**
 * Camera-first AI calorie calculator. The photo is captured inside the app
 * (live camera → canvas snapshot) and lives only in memory — it is never
 * saved to the device gallery or stored on the server; only the resulting
 * nutrition estimate is logged.
 */
export function CalorieAiClient({ locale }: { locale: Locale }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<EstimatedItem[] | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [slot, setSlot] = useState<MealSlot>("lunch");
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  // Never leave the camera running when navigating away.
  useEffect(() => stopCamera, []);

  async function openCamera() {
    setError(null);
    setPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      // The <video> mounts on the state flip; attach on the next frame.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setCameraFailed(true);
      fileRef.current?.click();
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvasToPhoto(canvas));
    stopCamera();
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setPhoto(await fileToPhoto(file));
    } catch {
      setError(t(locale, "ai.camera_error"));
    }
  }

  function retake() {
    setPhoto(null);
    setItems(null);
    if (cameraFailed) fileRef.current?.click();
    else openCamera();
  }

  function estimate() {
    if (!photo) return;
    setError(null);
    startTransition(async () => {
      const result = await estimateMealAction({
        description: notes,
        imageBase64: photo.base64,
        imageMediaType: photo.mediaType,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems(result.data.items);
      setSimulated(result.data.simulated);
    });
  }

  function patchItem(index: number, patch: Partial<EstimatedItem>) {
    setItems((prev) => prev?.map((item, i) => (i === index ? { ...item, ...patch } : item)) ?? null);
  }

  function removeItem(index: number) {
    setItems((prev) => prev?.filter((_, i) => i !== index) ?? null);
  }

  function log() {
    if (!items) return;
    setError(null);
    startTransition(async () => {
      const result = await logEstimate({ slot, fromImage: true, items });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLogged(true);
    });
  }

  function reset() {
    stopCamera();
    setPhoto(null);
    setNotes("");
    setItems(null);
    setSimulated(false);
    setLogged(false);
    setError(null);
  }

  const totals = (items ?? []).reduce(
    (acc, i) => ({
      calories: acc.calories + (i.calories || 0),
      proteinG: acc.proteinG + (i.proteinG || 0),
    }),
    { calories: 0, proteinG: 0 },
  );

  // ---- Logged screen ----
  if (logged) {
    return (
      <div className="flex flex-col items-center gap-6 py-10 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/15">
          <CheckCircle2 className="h-10 w-10 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">{t(locale, "ai.logged_title")}</h1>
          <p className="mt-1 text-muted">{t(locale, "ai.logged_sub")}</p>
        </div>
        <Button asChild className="w-full max-w-sm">
          <Link href="/diet/log">{t(locale, "ai.open_diary")}</Link>
        </Button>
        <button type="button" onClick={reset} className="text-sm font-bold text-accent hover:underline">
          {t(locale, "ai.again")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Sparkles className="h-6 w-6 text-accent" />
          {t(locale, "ai.title")}
        </h1>
        <p className="text-muted">{t(locale, "ai.subtitle")}</p>
      </div>

      {/* ---- Camera / photo ---- */}
      <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />

        {photo ? (
          <div className="relative overflow-hidden rounded-2xl border border-hairline">
            {/* eslint-disable-next-line @next/next/no-img-element -- in-memory data URL, never persisted */}
            <img src={photo.previewUrl} alt="Meal" className="max-h-72 w-full object-cover" />
            <button
              type="button"
              onClick={retake}
              className="absolute bottom-2 end-2 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t(locale, "ai.retake")}
            </button>
          </div>
        ) : cameraOn ? (
          <div className="relative overflow-hidden rounded-2xl border border-hairline">
            <video ref={videoRef} autoPlay playsInline muted className="max-h-72 w-full object-cover" />
            <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={capture}
                aria-label={t(locale, "ai.capture")}
                className="grid h-14 w-14 place-items-center rounded-full border-4 border-white bg-white/30 backdrop-blur"
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
              <button
                type="button"
                onClick={stopCamera}
                aria-label={t(locale, "media.close")}
                className="absolute end-4 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openCamera}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/50 bg-accent/5 py-10 text-accent hover:bg-accent/10"
          >
            <Camera className="h-9 w-9" />
            <span className="font-bold">{t(locale, "ai.open_camera")}</span>
            <span className="text-xs text-muted">{t(locale, "ai.no_save_note")}</span>
          </button>
        )}

        {!photo && !cameraOn && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted hover:text-ink"
          >
            <ImageIcon className="h-4 w-4" />
            {t(locale, "ai.pick_instead")}
          </button>
        )}

        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t(locale, "ai.notes_ph")}
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button onClick={estimate} disabled={isPending || !photo}>
          {isPending && !items ? t(locale, "ai.estimating") : t(locale, "ai.estimate_cta")}
        </Button>
      </div>

      {/* ---- Results ---- */}
      {items && (
        <div className="flex flex-col gap-3">
          <h2 className="font-bold">{t(locale, "ai.results_title")}</h2>

          {simulated && (
            <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              {t(locale, "ai.simulated_note")}
            </p>
          )}

          {items.map((item, index) => (
            <div key={index} className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-4">
              <div className="flex items-center gap-2">
                <Input
                  value={item.name}
                  onChange={(e) => patchItem(index, { name: e.target.value })}
                  className="h-11 flex-1 text-sm font-semibold"
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  aria-label="Remove item"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hairline text-muted hover:text-ink"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2 text-center">
                {(
                  [
                    { label: t(locale, "ai.grams"), key: "quantityG" },
                    { label: "kcal", key: "calories" },
                    { label: "P", key: "proteinG" },
                    { label: "C", key: "carbsG" },
                    { label: "F", key: "fatG" },
                  ] as const
                ).map((field) => (
                  <label key={field.key} className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase text-muted">{field.label}</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={String(Math.round(item[field.key] as number))}
                      onChange={(e) => patchItem(index, { [field.key]: parseFloat(e.target.value) || 0 })}
                      className="h-10 px-1 text-center text-sm"
                    />
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      item.confidence >= 0.7 ? "bg-accent" : item.confidence >= 0.4 ? "bg-amber-400" : "bg-red-400",
                    )}
                    style={{ width: `${Math.round(item.confidence * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums text-muted">
                  {Math.round(item.confidence * 100)}% {t(locale, "ai.confidence")}
                </span>
              </div>
            </div>
          ))}

          <div className="flex items-baseline justify-between rounded-2xl border border-hairline bg-surface px-4 py-3">
            <span className="text-sm font-bold">{t(locale, "ai.total")}</span>
            <span className="tabular-nums">
              <span className="text-lg font-extrabold">{Math.round(totals.calories)}</span>
              <span className="text-xs text-muted"> kcal · P {Math.round(totals.proteinG)}g</span>
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-muted">{t(locale, "ai.slot_label")}</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {SLOTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSlot(s.key)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors",
                    slot === s.key ? "bg-accent text-bg" : "border border-hairline text-muted hover:text-ink",
                  )}
                >
                  {locale === "tn" ? s.ar : s.en}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={log} disabled={isPending || items.length === 0}>
            {isPending ? t(locale, "ai.logging") : t(locale, "ai.log_cta")}
          </Button>
        </div>
      )}
    </div>
  );
}
