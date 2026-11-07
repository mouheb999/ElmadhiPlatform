import type { MetadataRoute } from "next";

/**
 * PWA manifest. iOS uses the `apple-icon` convention + `appleWebApp` metadata for
 * the home-screen icon; this manifest gives Android/desktop the installable icon
 * and makes the app launch standalone (no browser chrome).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HYPE FITNESS",
    short_name: "HYPE",
    description: "Your personal diet and training coach.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0F0F0F",
    theme_color: "#0F0F0F",
    icons: [
      /**
       * Chrome's install criteria want a 192px icon and a 512px one. We only
       * ever declared 512 and 180, so the 192 requirement was met by nothing —
       * which did not matter while the app was only ever added to a home
       * screen by hand, and does now that a Trusted Web Activity is judged
       * against the same bar.
       *
       * `/icon` renders at 512 and the browser downscales; declaring it at
       * both sizes is honest about that, and avoids a second route generating
       * the same artwork a second time.
       */
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png" },
      // `purpose: "maskable"` so Android can crop to the launcher's shape
      // rather than letterboxing the square into a circle.
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
