"use client";

import { useState } from "react";
import { Play, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { youtubeEmbedUrl, youtubeThumbnailUrl } from "@/lib/youtube";

/** In-app demo-video modal (YouTube nocookie embed). */
function VideoModal({
  locale,
  name,
  embedUrl,
  onClose,
}: {
  locale: Locale;
  name: string;
  embedUrl: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t(locale, "media.close")}
        onClick={onClose}
        className="absolute inset-0 bg-black/80"
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-hairline bg-bg">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="truncate text-sm font-bold">{name}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(locale, "media.close")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hairline text-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="aspect-video w-full">
          <iframe
            src={`${embedUrl}?rel=0`}
            title={name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}

/** Opens the demo video: YouTube in the in-app modal, anything else in a new tab. */
function useDemoVideo(videoUrl: string | null) {
  const [open, setOpen] = useState(false);
  const embedUrl = youtubeEmbedUrl(videoUrl);

  function launch() {
    if (embedUrl) {
      setOpen(true);
    } else if (videoUrl) {
      window.open(videoUrl, "_blank", "noopener,noreferrer");
    }
  }

  return { open, setOpen, embedUrl, launch };
}

/**
 * Exercise thumbnail + demo-video launcher, fed by the admin CMS
 * (exercises.thumbnail_url / video_url) with generated anatomical
 * illustrations (public/exercise-library) taking priority. Renders nothing
 * when the exercise has no media at all.
 */
export function ExerciseMedia({
  locale,
  name,
  illustrationUrl,
  thumbnailUrl,
  videoUrl,
  size = "md",
}: {
  locale: Locale;
  name: string;
  illustrationUrl?: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  size?: "sm" | "md";
}) {
  const { open, setOpen, embedUrl, launch } = useDemoVideo(videoUrl);
  const preview = illustrationUrl ?? thumbnailUrl ?? youtubeThumbnailUrl(videoUrl);

  if (!preview && !videoUrl) return null;

  // Illustrations are wide two-pose renders; a wider box keeps the start
  // figure readable instead of center-cropping the gap between figures.
  const box = illustrationUrl
    ? size === "sm"
      ? "h-12 w-[4.5rem]"
      : "h-14 w-[5.25rem]"
    : size === "sm"
      ? "h-12 w-12"
      : "h-14 w-14";

  return (
    <>
      <button
        type="button"
        onClick={launch}
        disabled={!videoUrl}
        aria-label={videoUrl ? t(locale, "media.watch_demo") : name}
        className={`relative shrink-0 overflow-hidden rounded-xl border border-hairline bg-[#161616] ${box} ${videoUrl ? "cursor-pointer" : "cursor-default"}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-hosted content URL
          <img src={preview} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center bg-white/5" />
        )}
        {videoUrl && (
          <span className="absolute inset-0 grid place-items-center bg-black/35">
            <Play className="h-5 w-5 fill-white text-white" />
          </span>
        )}
      </button>

      {open && embedUrl && (
        <VideoModal locale={locale} name={name} embedUrl={embedUrl} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/**
 * Full-width illustration banner for the live session card: the two-pose
 * anatomical render (start -> finish) with an optional demo-video pill.
 * The #161616 canvas comes from the generation spec, so the image reads as
 * part of the card rather than a boxed photo.
 */
export function ExerciseIllustrationBanner({
  locale,
  name,
  illustrationUrl,
  videoUrl,
}: {
  locale: Locale;
  name: string;
  illustrationUrl: string;
  videoUrl: string | null;
}) {
  const { open, setOpen, embedUrl, launch } = useDemoVideo(videoUrl);

  return (
    <>
      <div className="relative -mx-4 -mt-4 overflow-hidden rounded-t-2xl border-b border-hairline bg-[#161616]">
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimized local asset */}
        <img
          src={illustrationUrl}
          alt={name}
          loading="lazy"
          className="aspect-[2/1] w-full object-cover"
        />
        {videoUrl && (
          <button
            type="button"
            onClick={launch}
            className="absolute bottom-2 end-2 flex items-center gap-1.5 rounded-full border border-hairline bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-black/80"
          >
            <Play className="h-3.5 w-3.5 fill-white text-white" />
            {t(locale, "media.watch_demo")}
          </button>
        )}
      </div>

      {open && embedUrl && (
        <VideoModal locale={locale} name={name} embedUrl={embedUrl} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
