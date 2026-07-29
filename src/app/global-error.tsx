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
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>
          ELMADHI hit a snag
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: "22rem",
            fontSize: "0.9rem",
            color: "rgba(248,248,248,0.65)",
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
            background: "#5dd62c",
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
