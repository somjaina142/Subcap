import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      {/* Nav */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          background: "rgba(10,15,20,0.85)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0.75rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <a
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              textDecoration: "none",
            }}
          >
            <img
              src="/subcap-logo-white.png"
              alt="SubCap"
              style={{
                height: 44,
                width: "auto",
                display: "block",
              }}
            />
          </a>
          <Link
            href="/studio"
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: "0.9rem",
              fontWeight: 600,
              transition: "background var(--transition-fast), border-color var(--transition-fast)",
            }}
          >
            Open Studio
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          padding: "var(--space-3xl) 1.25rem",
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-2xl)",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "clamp(2rem, 4vw, 3.5rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.04em",
              fontWeight: 800,
              color: "var(--text)",
              marginBottom: "var(--space-lg)",
            }}
          >
            Subtitles that keep viewers watching.
          </h1>
          <p
            style={{
              fontSize: "clamp(1rem, 1.5vw, 1.15rem)",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: "var(--space-xl)",
              maxWidth: 480,
            }}
          >
            Upload any video. Auto-transcribe. Style with kinetic, minimal, neon, or corporate looks. Preview on real frames. Export SRT, VTT, or burn-in MP4. Built for creators who care about every second of watch time.
          </p>
          <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
            <Link
              href="/studio"
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "var(--radius)",
                background: "var(--accent)",
                color: "var(--bg)",
                fontWeight: 700,
                fontSize: "1rem",
                transition: "filter var(--transition-fast)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              Start creating →
            </Link>
            <span
              style={{
                padding: "0.75rem 1.25rem",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                fontSize: "0.95rem",
              }}
            >
              No account needed
            </span>
          </div>
        </div>

        {/* Abstract visual composition */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 320,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              aspectRatio: "16/10",
              borderRadius: "var(--radius)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Fake video frame */}
            <div
              style={{
                flex: 1,
                background: "linear-gradient(135deg, #0d1b2a 0%, #1b2838 100%)",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  border: "3px solid var(--accent)",
                  borderTopColor: "transparent",
                  animation: "spin 1.2s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
            {/* Fake subtitle bar */}
            <div
              style={{
                padding: "0.6rem 1rem",
                background: "rgba(0,0,0,0.65)",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              <div
                style={{
                  height: 10,
                  width: "70%",
                  borderRadius: 4,
                  background: "var(--accent)",
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  height: 10,
                  width: "45%",
                  borderRadius: 4,
                  background: "var(--accent)",
                  opacity: 0.55,
                }}
              />
            </div>
          </div>
          {/* Floating style badges */}
          <div
            style={{
              position: "absolute",
              top: -12,
              right: -12,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "0.35rem 0.6rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--accent)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            Kinetic
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: -16,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "0.35rem 0.6rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--accent-2)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            Neon Glow
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section style={{ padding: "var(--space-2xl) 1.25rem", borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--accent)",
              marginBottom: "var(--space-lg)",
            }}
          >
            How it works
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "var(--space-xl)",
            }}
          >
            {[
              {
                num: "01",
                title: "Upload",
                body: "Drag and drop any video file. MP4, MOV, WebM — up to 100MB. No upload limits, no watermarks.",
              },
              {
                num: "02",
                title: "Transcribe",
                body: "Pollinations Whisper auto-transcribes speech to timed segments in seconds. Handles accents, filler words, and multi-speaker tracks.",
              },
              {
                num: "03",
                title: "Style",
                body: "Pick from kinetic, minimal, neon, or corporate presets. Adjust font, color, position, shadow, and animation per segment.",
              },
              {
                num: "04",
                title: "Export",
                body: "Download SRT, VTT, or ASS for editing suites. Burn-in MP4 for direct upload to YouTube, TikTok, or Instagram.",
              },
            ].map((s) => (
              <div key={s.num}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "var(--muted)",
                    marginBottom: "var(--space-sm)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {s.num}
                </div>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    marginBottom: "var(--space-sm)",
                    color: "var(--text)",
                  }}
                >
                  {s.title}
                </h3>
                <p style={{ fontSize: "0.92rem", lineHeight: 1.55, color: "var(--text-secondary)" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section style={{ padding: "var(--space-2xl) 1.25rem", borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--accent)",
              marginBottom: "var(--space-lg)",
            }}
          >
            Built for pros
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "var(--space-lg)",
            }}
          >
            {[
              {
                title: "Auto-transcribe",
                body: "Whisper-powered speech-to-text with per-word timing. No manual typing. No external tools.",
              },
              {
                title: "Style presets",
                body: "Kinetic bold, minimal clean, neon glow, corporate serif — each tuned for a platform and audience.",
              },
              {
                title: "Live preview",
                body: "See subtitles rendered on real video frames before you export. No surprises, no re-renders.",
              },
              {
                title: "Timing editor",
                body: "Shift start and end times, merge short segments, split long lines. Full control over pacing.",
              },
              {
                title: "Multi-format export",
                body: "SRT for Premiere. VTT for web players. ASS for advanced styling. Burn-in MP4 for direct upload.",
              },
              {
                title: "BYOP auth",
                body: "Connect your Pollinations wallet once, keep spend on your own account, and come back to the studio ready to transcribe.",
              },
            ].map((f) => (
              <div
                key={f.title}
                style={{
                  padding: "var(--space-lg)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <h4
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    marginBottom: "var(--space-xs)",
                    color: "var(--text)",
                  }}
                >
                  {f.title}
                </h4>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.5, color: "var(--text-secondary)" }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          padding: "var(--space-3xl) 1.25rem",
          borderTop: "1px solid var(--border)",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: "var(--space-md)",
            color: "var(--text)",
          }}
        >
          Ready to caption your content?
        </h2>
        <p
          style={{
            color: "var(--text-secondary)",
            maxWidth: 520,
            margin: "0 auto var(--space-xl)",
            lineHeight: 1.6,
          }}
        >
          Upload your first video and see styled subtitles in under a minute. No account, no setup, no subscription.
        </p>
        <Link
          href="/studio"
          style={{
            padding: "0.85rem 2rem",
            borderRadius: "var(--radius)",
            background: "var(--accent)",
            color: "var(--bg)",
            fontWeight: 700,
            fontSize: "1.05rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "filter var(--transition-fast)",
          }}
        >
          Open SubCap Studio →
        </Link>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "var(--space-lg) 1.25rem",
          textAlign: "center",
          color: "var(--muted)",
          fontSize: "0.8rem",
        }}
      >
        Built on Pollinations. SubCap — pro subtitles for creators.
      </footer>

      {/* Responsive */}
      <style>{`
        @media (max-width: 960px) {
          section[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
          section[style*="grid-template-columns: repeat(4, 1fr)"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          section[style*="grid-template-columns: repeat(4, 1fr)"] { grid-template-columns: 1fr !important; }
          section[style*="grid-template-columns: repeat(3, 1fr)"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
