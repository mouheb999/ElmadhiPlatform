import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared artwork for the generated app icons (`icon.tsx` / `apple-icon.tsx`).
 *
 * public/brand-tile.png is the square HYPE FITNESS plate exactly as it was drawn —
 * dark ground, glow and rounded corners already in the artwork — so the icon routes
 * render it full-bleed rather than recompositing a mark onto a tile. Its corners are
 * black on black, which survives the squircle mask iOS applies on top.
 *
 * fs is read once at module load (build time); only the server-side icon routes
 * import this file, never the client.
 */
const tileDataUri = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public/brand-tile.png"),
).toString("base64")}`;

export function brandIcon() {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: "#000000",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={tileDataUri} alt="" style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
