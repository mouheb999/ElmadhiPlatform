"use client";

/**
 * Last line of defence: a failure in the root layout itself, where no app CSS
 * or provider is guaranteed to have loaded. Everything here is inline so this
 * screen cannot fail for the same reason the page did.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "2rem",
          textAlign: "center",
          background: "#0f0f0f",
          color: "#f8f8f8",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* No heading, and no brand name in it: naming the product in a failure
            makes the product look like the thing that broke, on a screen that
            fires for a network blip as readily as for a real fault. What is
            left is the only part that helps — what to do next. */}
        <p
          style={{
            margin: 0,
            maxWidth: "22rem",
            fontSize: "1rem",
            fontWeight: 600,
          }}
        >
          Reload to pick up where you left off.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: "none",
            borderRadius: "9999px",
            background: "#c0da1b",
            color: "#0f0f0f",
            fontWeight: 700,
            fontSize: "1rem",
            padding: "0.9rem 2rem",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
        {error.digest && (
          <code style={{ fontSize: "0.7rem", color: "rgba(248,248,248,0.35)" }}>
            {error.digest}
          </code>
        )}
      </body>
    </html>
  );
}
