import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared artwork for the generated app icons (`icon.tsx` / `apple-icon.tsx`).
 *
 * The raw logo (public/logo.png) is a wide 860×522 mark on transparency — handing
 * that straight to iOS would letterbox it on a black square. Instead we render the
 * mark, at its true aspect ratio, centered on the branded dark tile + green glow,
 * so the home-screen icon matches the in-app LogoMark.
 *
 * fs is read once at module load (build time); only the server-side icon routes
 * import this file, never the client.
 */
const LOGO_ASPECT = 522 / 860;

const logoDataUri = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public/logo.png"),
).toString("base64")}`;

export function brandIcon(logoWidth: number) {
  const logoHeight = Math.round(logoWidth * LOGO_ASPECT);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: "#0b0b0b",
        backgroundImage:
          "radial-gradient(circle at 60% 40%, rgba(93,214,44,0.42), rgba(11,11,11,0) 62%)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoDataUri} width={logoWidth} height={logoHeight} alt="" />
    </div>
  );
}
