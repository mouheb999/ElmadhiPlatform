"use client";

import { useState } from "react";
import { Play, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { youtubeEmbedUrl, youtubeThumbnailUrl } from "@/lib/youtube";

/**
 * Exercise thumbnail + demo-video launcher, fed by the admin CMS
 * (exercises.thumbnail_url / video_url). Renders nothing when the exercise
 * has no media. YouTube links open in an in-app modal (nocookie embed);
 * non-YouTube links open in a new tab.
 */
export function ExerciseMedia({
  locale,
  name,
  thumbnailUrl,
  videoUrl,
  size = "md",
}: {
  locale: Locale;
  name: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const embedUrl = youtubeEmbedUrl(videoUrl);
  const preview = thumbnailUrl ?? youtubeThumbnailUrl(videoUrl);

  if (!preview && !videoUrl) return null;

  const box = size === "sm" ? "h-12 w-12" : "h-14 w-14";

  function onClick() {
    if (embedUrl) {
      setOpen(true);
    } else if (videoUrl) {
      window.open(videoUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={!videoUrl}
        aria-label={videoUrl ? t(locale, "media.watch_demo") : name}
        className={`relative shrink-0 overflow-hidden rounded-xl border border-hairline ${box} ${videoUrl ? "cursor-pointer" : "cursor-default"}`}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t(locale, "media.close")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/80"
          />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-hairline bg-bg">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="truncate text-sm font-bold">{name}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
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
      )}
    </>
  );
}
