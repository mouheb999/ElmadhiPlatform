import type { MetadataRoute } from "next";

/**
 * PWA manifest. iOS uses the `apple-icon` convention + `appleWebApp` metadata for
 * the home-screen icon; this manifest gives Android/desktop the installable icon
 * and makes the app launch standalone (no browser chrome).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ELMADHI",
    short_name: "ELMADHI",
    description: "Your personal diet and training coach.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0F0F0F",
    theme_color: "#0F0F0F",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
