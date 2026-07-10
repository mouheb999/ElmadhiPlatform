import { ImageResponse } from "next/og";
import { brandIcon } from "@/lib/brand-icon";

// 180×180 is the size iOS uses for the home-screen "Add to Home Screen" icon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(brandIcon(120), { ...size });
}
