/**
 * YouTube URL helpers for admin-entered exercise video links. Client-safe.
 * Accepts watch/short/embed/youtu.be URLs; anything unparseable returns null
 * (the UI then falls back to a plain external link).
 */

export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") {
      id = parsed.pathname.slice(1).split("/")[0];
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") id = parsed.searchParams.get("v");
      else if (parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.split("/")[2];
      else if (parsed.pathname.startsWith("/embed/")) id = parsed.pathname.split("/")[2];
    }
    return id && /^[\w-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

/** Fallback preview image straight from YouTube when no thumbnail was uploaded. */
export function youtubeThumbnailUrl(url: string | null | undefined): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
