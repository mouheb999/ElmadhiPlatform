import { ImageResponse } from "next/og";
import { brandIcon } from "@/lib/brand-icon";

// Browser-tab / PWA icon. 512 also serves as the manifest icon source.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(brandIcon(340), { ...size });
}
