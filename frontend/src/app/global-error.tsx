"use client";

/**
 * Last-resort screen when the root layout itself fails. It can't use translations or the
 * theme, so it shows both languages in plain markup.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{ fontFamily: "system-ui, sans-serif", background: "#f7f7f7", color: "#1f1a24" }}
      >
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 16, textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>حصلت مشكلة · Something went wrong</h1>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              height: 48,
              padding: "0 20px",
              borderRadius: 8,
              border: 0,
              background: "#58286e",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            جرّب تاني · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
