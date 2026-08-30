"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecimalInput, Input } from "@/components/ui/input";
import { cn, parseDecimal } from "@/lib/utils";
import { t, type Locale, type StringKey } from "@/lib/i18n";
import { estimateMealAction, logEstimate } from "@/app/actions/ai-estimate";
import { clamp } from "@/lib/ai/estimate-shape";
import {
  MAX_VALUE,
  toDraftItem,
  toLoggedItem,
  withNutrient,
  withQuantity,
  type DraftItem,
  type NutrientKey,
} from "@/lib/ai/estimate-editing";
import type { MealSlot } from "@/app/actions/meal-logs";

const SLOTS: { key: MealSlot; en: string; ar: string }[] = [
  { key: "breakfast", en: "Breakfast", ar: "الفطور" },
  { key: "lunch", en: "Lunch", ar: "الغدا" },
  { key: "dinner", en: "Dinner", ar: "العشا" },
  { key: "snack", en: "Snack", ar: "وجبة خفيفة" },
];

const MAX_EDGE = 1024;

/** What one tap of the −/+ portion stepper moves. */
const QUANTITY_STEP_G = 10;

type Photo = {
  base64: string;
  mediaType: "image/jpeg";
  previewUrl: string;
  /** Where it came from, so "retake" reopens the same input. */
  source: "camera" | "file";
};

function canvasToPhoto(canvas: HTMLCanvasElement, source: Photo["source"]): Photo {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1], mediaType: "image/jpeg", previewUrl: dataUrl, source };
}

/**
 * Snapshot ONLY the part of the stream the user can actually see.
 *
 * The viewfinder renders the video with `object-cover`, which centre-crops it
 * to the shape of its box. The old capture drew the whole frame —
 * `drawImage(video, 0, 0, w, h)` — so everything the crop had hidden was still
 * sent to the model. That is not a cosmetic mismatch: users reported the
 * estimate listing food that was on the table but not in the picture, because
 * from the model's point of view it WAS in the picture.
 *
 * So the source rectangle is recomputed here with the same maths the browser
 * used to paint it: cover scales by the larger of the two ratios, and centres
 * whatever overflows. What you framed is what gets analysed.
 */
function captureVisibleRegion(video: HTMLVideoElement): Photo {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  // Fall back to the full frame if the element has not been laid out — better
  // a wider photo than no photo.
  const cw = video.clientWidth || vw;
  const ch = video.clientHeight || vh;

  const coverScale = Math.max(cw / vw, ch / vh);
  const sWidth = Math.min(vw, cw / coverScale);
  const sHeight = Math.min(vh, ch / coverScale);
  const sx = (vw - sWidth) / 2;
  const sy = (vh - sHeight) / 2;

  const outScale = Math.min(1, MAX_EDGE / Math.max(sWidth, sHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sWidth * outScale));
  canvas.height = Math.max(1, Math.round(sHeight * outScale));
  canvas
    .getContext("2d")!
    .drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
  return canvasToPhoto(canvas, "camera");
}

/** Downscale a picked file to ≤1024px JPEG (camera-permission fallback path). */
async function fileToPhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvasToPhoto(canvas, "file");
}

/**
 * Camera-first AI calorie calculator. The photo is captured inside the app
 * (live camera → canvas snapshot) and lives only in memory — it is never
 * saved to the device gallery or stored on the server; only the resulting
 * nutrition estimate is logged.
 */
/** Maps a getUserMedia rejection to something the user can act on. */
export function cameraErrorKey(error: unknown): StringKey {
  const name = (error as DOMException | undefined)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "ai.camera_denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "ai.camera_missing";
  if (name === "NotReadableError" || name === "AbortError") return "ai.camera_busy";
  return "ai.camera_error";
}

type CameraState = "idle" | "starting" | "live";

export function CalorieAiClient({ locale }: { locale: Locale }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [camera, setCamera] = useState<CameraState>("idle");
  /** True once the stream reports real dimensions — capture needs them. */
  const [videoReady, setVideoReady] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[] | null>(null);
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
    setCamera("idle");
    setVideoReady(false);
  }

  // Never leave the camera running when navigating away. Touches only the ref,
  // so it can't set state on an unmounted component.
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  /**
   * Attach the stream once the <video> is actually in the DOM.
   *
   * This used to run in a requestAnimationFrame right after setState, which is
   * a race: React may commit after the frame callback, leaving videoRef null,
   * and the old code silently skipped the assignment. The camera then showed a
   * permanently black frame after the user granted permission. An effect keyed
   * on the state runs after commit, so the ref is always populated.
   */
  useEffect(() => {
    if (camera !== "live") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    // Safari (and iOS in particular) does not always autoplay a stream that
    // was assigned after mount. Rejection is harmless — muted+playsInline
    // means the browser will start it on its own.
    void video.play().catch(() => {});
  }, [camera]);

  async function openCamera() {
    setError(null);
    setPhoto(null);
    setVideoReady(false);

    // getUserMedia only exists in a secure context. Over plain http on a LAN
    // address — the usual way of testing on a real phone — mediaDevices is
    // undefined, which previously failed silently.
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t(locale, window.isSecureContext ? "ai.camera_error" : "ai.camera_insecure"));
      return;
    }

    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamera("live");
    } catch (cameraError) {
      streamRef.current = null;
      setCamera("idle");
      // Say what went wrong instead of silently opening the file picker — a
      // programmatic click after an await is blocked by most browsers anyway,
      // so the old fallback usually did nothing at all.
      setError(t(locale, cameraErrorKey(cameraError)));
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setPhoto(captureVisibleRegion(video));
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
    const cameFromFile = photo?.source === "file";
    setPhoto(null);
    setItems(null);
    // Reopen whichever input produced the photo, so a user without a working
    // camera isn't bounced back into a permission error every retake.
    if (cameFromFile) fileRef.current?.click();
    else void openCamera();
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
      setItems(result.data.items.map(toDraftItem));
      setSimulated(result.data.simulated);
    });
  }

  function updateItem(id: string, update: (item: DraftItem) => DraftItem) {
    setItems((prev) => prev?.map((item) => (item.id === id ? update(item) : item)) ?? null);
  }

  /** The portion is the master control — the four nutrients follow it. */
  function setQuantity(id: string, quantityG: number) {
    updateItem(id, (item) => withQuantity(item, quantityG));
  }

  /**
   * Moves the portion by one step. The delta is applied inside the updater
   * rather than computed from the rendered value: two taps in the same frame
   * would otherwise both read the same stale quantity and count as one.
   */
  function stepQuantity(id: string, deltaG: number) {
    updateItem(id, (item) =>
      withQuantity(item, clamp(Math.round(item.quantityG) + deltaG, 1, MAX_VALUE.quantityG)),
    );
  }

  function setNutrient(id: string, key: NutrientKey, value: number) {
    updateItem(id, (item) => withNutrient(item, key, value));
  }

  function removeItem(id: string) {
    setItems((prev) => prev?.filter((item) => item.id !== id) ?? null);
  }

  function log() {
    if (!items) return;
    setError(null);
    startTransition(async () => {
      const result = await logEstimate({ slot, fromImage: true, items: items.map(toLoggedItem) });
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

  const showIdleState = !photo && camera === "idle";

  const totals = (items ?? []).reduce(
    (acc, i) => ({
      calories: acc.calories + (i.calories || 0),
      proteinG: acc.proteinG + (i.proteinG || 0),
      carbsG: acc.carbsG + (i.carbsG || 0),
      fatG: acc.fatG + (i.fatG || 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  // Macros are named in full everywhere. "P / C / F" reads as an initialism
  // only in English, and in Arabic it decodes to nothing at all.
  const macroFields = [
    { key: "proteinG", label: t(locale, "diary.macro_protein") },
    { key: "carbsG", label: t(locale, "diary.macro_carbs") },
    { key: "fatG", label: t(locale, "diary.macro_fat") },
  ] as const;

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
          <Link href="/diet?view=today">{t(locale, "ai.open_diary")}</Link>
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
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-hairline bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element -- in-memory data URL, never persisted */}
            <img src={photo.previewUrl} alt="Meal" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={retake}
              className="absolute bottom-3 end-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3.5 py-2 text-xs font-bold text-white backdrop-blur transition-colors hover:bg-black/85"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t(locale, "ai.retake")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openCamera}
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-accent/40 bg-gradient-to-b from-accent/10 to-accent/[0.02] py-12 transition-colors hover:border-accent/70 hover:from-accent/15"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-accent/15 text-accent transition-transform group-hover:scale-105">
              <Camera className="h-8 w-8" />
            </span>
            <span className="font-bold text-accent">{t(locale, "ai.open_camera")}</span>
            <span className="max-w-[16rem] text-center text-xs text-muted">
              {t(locale, "ai.no_save_note")}
            </span>
          </button>
        )}

        {showIdleState && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-muted transition-colors hover:bg-white/5 hover:text-ink"
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

        {error && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-sm">{error}</p>
              {showIdleState && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openCamera}
                    className="rounded-full border border-hairline px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/5"
                  >
                    {t(locale, "ai.camera_retry")}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-full border border-hairline px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/5"
                  >
                    {t(locale, "ai.pick_instead")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <Button onClick={estimate} disabled={isPending || !photo}>
          {isPending && !items ? t(locale, "ai.estimating") : t(locale, "ai.estimate_cta")}
        </Button>
      </div>

      {/* ---- Results ---- */}
      {items && (
        <div className="flex flex-col gap-3">
          {/* The answer, before the working. The total used to sit under the
              item list, so the one number the user opened the camera for was
              the last thing they reached. */}
          <div className="flex flex-col gap-4 rounded-3xl border border-accent/25 bg-gradient-to-b from-accent/[0.10] to-accent/[0.02] p-5">
            <div className="flex items-center gap-4">
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element -- in-memory data URL
                <img
                  src={photo.previewUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-2xl border border-white/10 object-cover"
                />
              )}
              <div className="flex min-w-0 flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  {t(locale, "ai.total")}
                </span>
                <span className="flex items-baseline gap-1.5 tabular-nums">
                  <span className="font-display text-4xl font-extrabold leading-none text-accent">
                    {Math.round(totals.calories)}
                  </span>
                  <span className="text-sm font-bold text-muted">kcal</span>
                </span>
                <span className="mt-1 text-xs text-muted">
                  {items.length === 1
                    ? t(locale, "ai.one_item_found")
                    : t(locale, "ai.items_found").replace("{n}", String(items.length))}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {macroFields.map((macro) => (
                <div
                  key={macro.key}
                  className="flex flex-col items-center gap-0.5 rounded-2xl bg-black/25 px-2 py-2.5"
                >
                  <span className="text-center text-[10px] font-bold uppercase tracking-wide text-muted">
                    {macro.label}
                  </span>
                  <span className="text-sm font-extrabold tabular-nums">
                    {Math.round(totals[macro.key])} {t(locale, "ai.grams")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-bold">{t(locale, "ai.results_title")}</h2>
            {/* Says out loud what the portion field now does, so nobody edits
                the grams and wonders why the macros "didn't listen". */}
            <p className="mt-0.5 text-xs text-muted">{t(locale, "ai.qty_sync_hint")}</p>
          </div>

          {simulated && (
            <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              {t(locale, "ai.simulated_note")}
            </p>
          )}

          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-4">
              <div className="flex items-center gap-2">
                <Input
                  value={item.name}
                  onChange={(e) =>
                    updateItem(item.id, (current) => ({ ...current, name: e.target.value }))
                  }
                  className="h-11 flex-1 text-sm font-semibold"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={t(locale, "ai.remove_item")}
                  title={t(locale, "ai.remove_item")}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hairline text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Portion — the one control everything else follows. */}
              <div className="flex flex-col gap-2 rounded-xl border border-accent/25 bg-accent/[0.06] p-3">
                <span className="text-[11px] font-bold text-muted">{t(locale, "ai.quantity")}</span>
                <div className="flex items-center gap-2">
                  <StepButton
                    icon="minus"
                    label={t(locale, "ai.decrease")}
                    disabled={item.quantityG <= 1}
                    onClick={() => stepQuantity(item.id, -QUANTITY_STEP_G)}
                  />
                  <NumberField
                    value={item.quantityG}
                    max={MAX_VALUE.quantityG}
                    unit={t(locale, "ai.grams")}
                    onValue={(value) => setQuantity(item.id, value)}
                    className="h-11 flex-1 text-center text-base font-bold"
                  />
                  <StepButton
                    icon="plus"
                    label={t(locale, "ai.increase")}
                    disabled={item.quantityG >= MAX_VALUE.quantityG}
                    onClick={() => stepQuantity(item.id, QUANTITY_STEP_G)}
                  />
                </div>
              </div>

              {/* Calories, then the three macros — each named in full. */}
              <div className="flex flex-col gap-2">
                <FieldBox label={t(locale, "diary.quick_calories")}>
                  <NumberField
                    value={item.calories}
                    max={MAX_VALUE.calories}
                    unit="kcal"
                    onValue={(value) => setNutrient(item.id, "calories", value)}
                    className="h-11 font-bold"
                  />
                </FieldBox>

                <div className="grid grid-cols-3 gap-2">
                  {macroFields.map((macro) => (
                    <FieldBox key={macro.key} label={macro.label}>
                      <NumberField
                        value={item[macro.key]}
                        max={MAX_VALUE[macro.key]}
                        unit={t(locale, "ai.grams")}
                        onValue={(value) => setNutrient(item.id, macro.key, value)}
                        className="h-11"
                      />
                    </FieldBox>
                  ))}
                </div>
              </div>

              {/* A bare "62% confidence" tells nobody what to do about it.
                  The word says whether to trust the number or check it; the
                  bar keeps the detail for anyone who wants it. */}
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      item.confidence >= 0.7 ? "bg-accent" : item.confidence >= 0.4 ? "bg-amber-400" : "bg-red-400",
                    )}
                    style={{ width: `${Math.round(item.confidence * 100)}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "text-[11px] font-bold",
                    item.confidence >= 0.7
                      ? "text-muted"
                      : item.confidence >= 0.4
                        ? "text-amber-300"
                        : "text-red-300",
                  )}
                >
                  {t(
                    locale,
                    item.confidence >= 0.7
                      ? "ai.conf_high"
                      : item.confidence >= 0.4
                        ? "ai.conf_medium"
                        : "ai.conf_low",
                  )}
                </span>
              </div>
            </div>
          ))}

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

      {/* The viewfinder is full-screen and lives outside the page flow. A
          camera inside a 4:3 card showed a slice of the sensor while the
          capture sent all of it; now the frame the user composes IS the
          frame, and it fills the phone the way a camera should. */}
      {camera !== "idle" && (
        <CameraOverlay
          locale={locale}
          videoRef={videoRef}
          videoReady={videoReady}
          onReady={() => setVideoReady(true)}
          onCapture={capture}
          onClose={stopCamera}
          onPickFile={() => fileRef.current?.click()}
        />
      )}

      {isPending && !items && photo && (
        <AnalysisOverlay locale={locale} previewUrl={photo.previewUrl} />
      )}
    </div>
  );
}

/**
 * The camera, full-bleed.
 *
 * `object-cover` still crops — a phone viewport is never exactly the sensor's
 * aspect ratio — which is precisely why `captureVisibleRegion` exists. Going
 * full-screen just makes that crop small and the framing honest, instead of
 * hiding most of the sensor behind a postcard.
 */
function CameraOverlay({
  locale,
  videoRef,
  videoReady,
  onReady,
  onCapture,
  onClose,
  onPickFile,
}: {
  locale: Locale;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoReady: boolean;
  onReady: () => void;
  onCapture: () => void;
  onClose: () => void;
  onPickFile: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={onReady}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
          videoReady ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Vignette — keeps the white controls legible over a bright plate. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)]"
      />

      {!videoReady && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-white/80">
            <Loader2 className="h-7 w-7 animate-spin" />
            <span className="text-sm font-bold">{t(locale, "ai.camera_starting")}</span>
          </div>
        </div>
      )}

      {videoReady && (
        <>
          {/* Framing brackets, sized off the short edge so they stay square. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[76vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2"
          >
            {[
              "left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-2xl",
              "right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-2xl",
              "left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-2xl",
              "right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-2xl",
            ].map((corner) => (
              <span key={corner} className={cn("absolute h-10 w-10 border-white/85", corner)} />
            ))}
          </div>

          <p className="pointer-events-none absolute inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top))] mx-auto max-w-[17rem] text-center text-xs font-semibold leading-relaxed text-white/85 drop-shadow">
            {t(locale, "ai.frame_hint")}
          </p>
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label={t(locale, "ai.close_camera")}
        className="absolute end-4 top-[calc(1rem+env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/70"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Gallery on one side, shutter centred, an empty cell on the other so
          the shutter sits on the true centre line rather than near it. */}
      <div className="absolute inset-x-0 bottom-[calc(2rem+env(safe-area-inset-bottom))] grid grid-cols-3 items-center px-8">
        <button
          type="button"
          onClick={onPickFile}
          aria-label={t(locale, "ai.gallery")}
          className="grid h-12 w-12 place-items-center justify-self-start rounded-2xl bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25"
        >
          <ImageIcon className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onCapture}
          disabled={!videoReady}
          aria-label={t(locale, "ai.capture")}
          className={cn(
            "grid h-20 w-20 place-items-center justify-self-center rounded-full ring-4 ring-white/90 transition-transform",
            videoReady ? "active:scale-90" : "cursor-not-allowed opacity-40",
          )}
        >
          <span className="h-[3.75rem] w-[3.75rem] rounded-full bg-white shadow-[0_0_28px_rgba(255,255,255,0.45)]" />
        </button>

        <span aria-hidden />
      </div>
    </div>
  );
}

/** The four phases the progress bar narrates while the model is thinking. */
const ANALYSIS_STAGES: StringKey[] = [
  "ai.analyzing_1",
  "ai.analyzing_2",
  "ai.analyzing_3",
  "ai.analyzing_4",
];

/**
 * The waiting screen.
 *
 * The estimate takes 5–33 seconds and the server reports nothing while it
 * runs, so there is no true percentage to show. A bare spinner for half a
 * minute reads as a hang, though, so this does what it honestly can: a bar
 * that eases toward 92 % and stops there, with stage labels naming what is
 * actually happening, in order. It only completes when the answer does — it
 * never claims to be finished ahead of the work.
 */
function AnalysisOverlay({ locale, previewUrl }: { locale: Locale; previewUrl: string }) {
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    // Ease out: big early steps, ever-smaller ones near the ceiling, so it
    // keeps moving without ever pretending to be done.
    const id = setInterval(() => {
      setProgress((current) =>
        current >= 92 ? current : current + Math.max(0.4, (92 - current) * 0.045),
      );
    }, 220);
    return () => clearInterval(id);
  }, []);

  const stage = ANALYSIS_STAGES[Math.min(ANALYSIS_STAGES.length - 1, Math.floor(progress / 24))];

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-bg">
      {/* eslint-disable-next-line @next/next/no-img-element -- in-memory data URL */}
      <img
        src={previewUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/85 to-bg" />

      <div className="relative flex h-full flex-col items-center justify-center gap-7 px-8">
        <div className="relative">
          <span aria-hidden className="absolute inset-0 animate-ping rounded-3xl bg-accent/20" />
          {/* eslint-disable-next-line @next/next/no-img-element -- in-memory data URL */}
          <img
            src={previewUrl}
            alt=""
            className="relative h-28 w-28 rounded-3xl border border-white/10 object-cover shadow-2xl"
          />
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <Sparkles className="h-5 w-5 text-accent" />
            {t(locale, "ai.analyzing_title")}
          </h2>
          <p className="text-sm text-muted">{t(locale, stage)}</p>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-2">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-accent shadow-[0_0_16px_rgba(192,218,27,0.5)] transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-center text-[11px] font-bold tabular-nums text-muted">
            {Math.round(progress)}%
          </span>
        </div>

        <p className="max-w-[15rem] text-center text-[11px] leading-relaxed text-muted">
          {t(locale, "ai.analyzing_note")}
        </p>
      </div>
    </div>
  );
}

/** A labelled slot around one editable number. */
function FieldBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-muted">{label}</span>
      {children}
    </label>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: "minus" | "plus";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = icon === "minus" ? Minus : Plus;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hairline bg-surface text-ink transition-colors hover:border-accent/60 hover:text-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/**
 * A number field with the unit printed inside it.
 *
 * It holds the raw text the user is typing so that clearing the field doesn't
 * snap to "0" and leave them typing "0150" — an empty field simply reports no
 * value. The draft is dropped as soon as the value moves for a reason other
 * than this field's own edit, which is the whole point here: re-portioning an
 * item rewrites the nutrient fields underneath, and a half-typed number must
 * not sit there contradicting the figure that will actually be logged.
 *
 * Built on DecimalInput, so an Arabic keyboard's "٫" and Arabic-Indic digits
 * parse too.
 */
function NumberField({
  value,
  max,
  unit,
  onValue,
  className,
}: {
  value: number;
  max: number;
  unit: string;
  onValue: (value: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  /** The rounded value this field last put into state, to tell its own edits
   *  apart from one that came from the portion being rescaled. */
  const ownValue = useRef<number | null>(null);

  const rounded = Math.round(value);

  useEffect(() => {
    if (ownValue.current !== null && ownValue.current !== rounded) {
      setDraft(null);
      ownValue.current = null;
    }
  }, [rounded]);

  return (
    <span className="relative flex items-center">
      <DecimalInput
        value={draft ?? String(rounded)}
        onValueChange={(raw) => {
          const parsed = parseDecimal(raw);
          if (parsed === null) {
            // Still typing (an empty field, or just "."). Leave the last good
            // value in state, but keep watching it for an outside change.
            setDraft(raw);
            ownValue.current = rounded;
            return;
          }
          const next = clamp(parsed, 0, max);
          // Show the cap immediately rather than letting the field claim a
          // number that was never accepted.
          setDraft(next === parsed ? raw : null);
          ownValue.current = Math.round(next);
          onValue(next);
        }}
        onBlur={() => {
          setDraft(null);
          ownValue.current = null;
        }}
        className={cn(
          "w-full ps-3 text-sm tabular-nums",
          // Just enough room for the unit sitting inside the field: "kcal"
          // needs more than "g" / "غ", and the macro columns are narrow.
          unit.length > 2 ? "pe-11" : "pe-8",
          className,
        )}
      />
      <span className="pointer-events-none absolute end-3 text-[11px] font-bold text-muted">
        {unit}
      </span>
    </span>
  );
}
