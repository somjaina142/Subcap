"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { SubtitleSegment, SubtitleStyle, MediaFile, TranscriptionResult } from "@/lib/types";
import { DEFAULT_STYLES, type ExportFormat } from "@/lib/types";
import { exportSubtitles, downloadFile, applyStyleToSegmentCanvas } from "@/lib/subtitle";
import { exportBurnIn, downloadBlob } from "@/lib/burnin";
import { mockTranscribe } from "@/lib/mock";
import { generateDemoVideo } from "@/lib/demo";
import { DEFAULT_POLLINATIONS_STT_MODEL, POLLINATIONS_STT_MODELS, type SttModelOption } from "@/lib/stt-models";
import {
  isPollinationsApiKey,
  buildPollinationsAuthorizeUrl,
  parsePollinationsAuthorizeHash,
  maskPollinationsApiKey,
  POLLINATIONS_USER_KEY_STORAGE_KEY,
  POLLINATIONS_AUTH_STATE_KEY,
} from "@/lib/pollinations-auth";

interface RuntimeConfig {
  appKey: string | null;
  appKeyPresent: boolean;
  appKeyPrefix: string | null;
  mockEnabled: boolean;
  defaultAudioModel: string;
  sttModels: SttModelOption[];
}

const DEV_MANUAL_KEY_ENTRY_ENABLED = process.env.NODE_ENV !== "production";
const STT_MODEL_STORAGE_KEY = "pollinations_stt_model";

/* ─── Pollen cost estimate helper ─── */
function estimatePollenCost(minutes: number, operation: "transcribe" | "burnin"): string {
  // Pollinations Whisper: ~$0.006 per minute (based on OpenAI Whisper pricing)
  const base = operation === "transcribe" ? minutes * 0.006 : minutes * 0.012;
  return `~$${base.toFixed(3)}`;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

/* ─── Skeleton shimmer ─── */
function Skeleton({ width = "100%", height = "1.5rem" }: { width?: string; height?: string }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: "var(--radius-sm)",
        background: "linear-gradient(90deg, var(--surface) 25%, var(--bg-2) 50%, var(--surface) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s ease-in-out infinite",
      }}
    />
  );
}

/* ─── Transcription skeleton ─── */
function TranscriptionSkeleton() {
  return (
    <div
      style={{
        padding: "var(--space-lg)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
        <div
          style={{
            width: 14, height: 14, borderRadius: "50%",
            border: "2px solid var(--accent)", borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--accent)" }}>Transcribing audio…</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        <Skeleton height="2.2rem" />
        <Skeleton height="2.2rem" width="92%" />
        <Skeleton height="2.2rem" width="85%" />
        <Skeleton height="2.2rem" width="78%" />
        <Skeleton height="2.2rem" width="70%" />
      </div>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

/* ─── Error banner ─── */
function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      style={{
        padding: "0.75rem 1rem",
        borderRadius: "var(--radius-sm)",
        background: "rgba(255,90,90,0.12)",
        border: "1px solid rgba(255,90,90,0.35)",
        color: "var(--error)",
        fontSize: "0.9rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-md)",
      }}
    >
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: "var(--radius-sm)",
            background: "rgba(255,90,90,0.15)",
            border: "1px solid rgba(255,90,90,0.3)",
            color: "var(--error)",
            fontSize: "0.82rem",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

/* ─── Empty state for no video ─── */
function UploadEmptyState({
  onFile,
}: {
  onFile: (file: File) => void;
}) {
  const dropRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);

  return (
    <div
      ref={dropRef}
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith("video/")) onFile(f);
      }}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "video/*";
        input.onchange = (ev) => {
          const f = (ev.target as HTMLInputElement).files?.[0];
          if (f) onFile(f);
        };
        input.click();
      }}
      style={{
        border: `2px dashed ${hover ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "var(--space-3xl) var(--space-xl)",
        textAlign: "center",
        cursor: "pointer",
        transition: "border-color var(--transition-fast), background var(--transition-fast)",
        background: hover ? "var(--bg-2)" : "transparent",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto var(--space-md)",
          fontSize: "1.5rem",
          color: "var(--muted)",
        }}
      >
        ▲
      </div>
      <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "var(--space-sm)", color: "var(--text)" }}>
        Drop a video to get started
      </h2>
      <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.5, maxWidth: 400, margin: "0 auto" }}>
        MP4, MOV, or WebM — up to 100MB. SubCap will transcribe, style, and help you export pro subtitles in minutes.
      </p>
    </div>
  );
}

/* ─── Empty state for no segments ─── */
function SegmentsEmptyState() {
  return (
    <div
      style={{
        padding: "var(--space-xl)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        No subtitles yet. Hit <strong style={{ color: "var(--accent)" }}>Transcribe video</strong> to generate timed subtitle segments from your video audio.
      </p>
    </div>
  );
}

/* ─── Style customizer ─── */
function StyleCustomizer({
  style,
  onChange,
}: {
  style: SubtitleStyle;
  onChange: (partial: Partial<SubtitleStyle>) => void;
}) {
  return (
    <div
      style={{
        padding: "var(--space-lg)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "var(--space-md)", letterSpacing: "-0.01em" }}>
        Customize style
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        {/* Font size */}
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-xs)" }}>
            Size
          </label>
          <input
            type="range"
            min={0.02}
            max={0.12}
            step={0.005}
            value={style.fontSize}
            onChange={(e) => onChange({ fontSize: parseFloat(e.target.value) })}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
          <div style={{ fontSize: "0.78rem", color: "var(--muted)", textAlign: "right", fontFamily: "var(--font-mono)" }}>
            {(style.fontSize * 100).toFixed(1)}%
          </div>
        </div>

        {/* Position */}
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-xs)" }}>
            Position
          </label>
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            {(["top", "center", "bottom"] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => onChange({ position: pos })}
                style={{
                  flex: 1,
                  padding: "0.4rem 0.6rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: style.position === pos ? "rgba(0,229,255,0.12)" : "var(--bg-2)",
                  color: style.position === pos ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Alignment */}
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-xs)" }}>
            Alignment
          </label>
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                onClick={() => onChange({ alignment: a })}
                style={{
                  flex: 1,
                  padding: "0.4rem 0.6rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: style.alignment === a ? "rgba(0,229,255,0.12)" : "var(--bg-2)",
                  color: style.alignment === a ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Color + Outline */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-xs)" }}>
              Color
            </label>
            <input
              type="color"
              value={style.color}
              onChange={(e) => onChange({ color: e.target.value })}
              style={{ width: "100%", height: 32, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-2)", cursor: "pointer" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-xs)" }}>
              Outline
            </label>
            <input
              type="color"
              value={style.outlineColor || "#000000"}
              onChange={(e) => onChange({ outlineColor: e.target.value })}
              style={{ width: "100%", height: 32, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-2)", cursor: "pointer" }}
            />
          </div>
        </div>

        {/* Outline width */}
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-xs)" }}>
            Outline width
          </label>
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={style.outlineWidth ?? 0}
            onChange={(e) => onChange({ outlineWidth: parseInt(e.target.value, 10) })}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
        </div>

        {/* Background */}
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-xs)" }}>
            Background
          </label>
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <button
              onClick={() => onChange({ backgroundColor: undefined })}
              style={{
                flex: 1,
                padding: "0.4rem 0.6rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: !style.backgroundColor ? "rgba(0,229,255,0.12)" : "var(--bg-2)",
                color: !style.backgroundColor ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              None
            </button>
            <button
              onClick={() => onChange({ backgroundColor: "rgba(0,0,0,0.5)" })}
              style={{
                flex: 1,
                padding: "0.4rem 0.6rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: style.backgroundColor === "rgba(0,0,0,0.5)" ? "rgba(0,229,255,0.12)" : "var(--bg-2)",
                color: style.backgroundColor === "rgba(0,0,0,0.5)" ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              Dark
            </button>
            <button
              onClick={() => onChange({ backgroundColor: "rgba(255,255,255,0.2)" })}
              style={{
                flex: 1,
                padding: "0.4rem 0.6rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: style.backgroundColor === "rgba(255,255,255,0.2)" ? "rgba(0,229,255,0.12)" : "var(--bg-2)",
                color: style.backgroundColor === "rgba(255,255,255,0.2)" ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              Light
            </button>
          </div>
        </div>

        {/* Uppercase / Bold toggles */}
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <button
            onClick={() => onChange({ uppercase: !style.uppercase })}
            style={{
              flex: 1,
              padding: "0.4rem 0.6rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: style.uppercase ? "rgba(0,229,255,0.12)" : "var(--bg-2)",
              color: style.uppercase ? "var(--accent)" : "var(--text-secondary)",
              fontSize: "0.82rem",
              fontWeight: 600,
            }}
          >
            Aa → AA
          </button>
          <button
            onClick={() => onChange({ bold: !style.bold })}
            style={{
              flex: 1,
              padding: "0.4rem 0.6rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: style.bold ? "rgba(0,229,255,0.12)" : "var(--bg-2)",
              color: style.bold ? "var(--accent)" : "var(--text-secondary)",
              fontSize: "0.82rem",
              fontWeight: 600,
            }}
          >
            Bold
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main studio page ─── */
export default function StudioPage() {
  const [video, setVideo] = useState<MediaFile | null>(null);
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [activeStyle, setActiveStyle] = useState<SubtitleStyle>(DEFAULT_STYLES[0]);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showManualKeyEntry, setShowManualKeyEntry] = useState(false);
  const [manualKeyInput, setManualKeyInput] = useState("");
  const [selectedSttModel, setSelectedSttModel] = useState(DEFAULT_POLLINATIONS_STT_MODEL);
  const [maxWordsPerLine, setMaxWordsPerLine] = useState(8);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [userKey, setUserKey] = useState<string | null>(null);
  const [burnInProgress, setBurnInProgress] = useState(0);
  const [isBurning, setIsBurning] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>({
    appKey: null,
    appKeyPresent: false,
    appKeyPrefix: null,
    mockEnabled: true,
    defaultAudioModel: DEFAULT_POLLINATIONS_STT_MODEL,
    sttModels: POLLINATIONS_STT_MODELS,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load key from localStorage + handle OAuth callback on mount
  useEffect(() => {
    // Check for OAuth callback hash first
    if (typeof window !== "undefined" && window.location.hash) {
      const { apiKey, state } = parsePollinationsAuthorizeHash(window.location.hash);
      const savedState = localStorage.getItem(POLLINATIONS_AUTH_STATE_KEY);
      if (apiKey && state && savedState && state === savedState) {
        localStorage.setItem(POLLINATIONS_USER_KEY_STORAGE_KEY, apiKey);
        localStorage.removeItem(POLLINATIONS_AUTH_STATE_KEY);
        setUserKey(apiKey);
        setManualKeyInput(apiKey);
        // Clean the hash from the URL
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } else if (apiKey || state) {
        // Invalid state — clean up
        localStorage.removeItem(POLLINATIONS_AUTH_STATE_KEY);
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }

    // Load existing key
    const existingKey = localStorage.getItem(POLLINATIONS_USER_KEY_STORAGE_KEY);
    if (existingKey && isPollinationsApiKey(existingKey)) {
      setUserKey(existingKey);
      setManualKeyInput(existingKey);
    }

    void fetch("/api/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((config: RuntimeConfig | null) => {
        if (config) {
          setRuntimeConfig(config);
          const storedModel = localStorage.getItem(STT_MODEL_STORAGE_KEY);
          const availableIds = new Set(config.sttModels.map((option) => option.id));
          if (storedModel && availableIds.has(storedModel)) {
            setSelectedSttModel(storedModel);
          } else if (availableIds.has(config.defaultAudioModel)) {
            setSelectedSttModel(config.defaultAudioModel);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedSttModel) {
      localStorage.setItem(STT_MODEL_STORAGE_KEY, selectedSttModel);
    }
  }, [selectedSttModel]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setSegments([]);
    setSelectedSegmentId(null);
    const url = URL.createObjectURL(file);
    let duration = 0;
    try {
      duration = await new Promise<number>((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => resolve(v.duration || 60);
        v.onerror = () => resolve(60);
        v.src = url;
      });
    } catch {
      duration = 60;
    }
    setVideo({
      id: Math.random().toString(36).slice(2),
      name: file.name,
      size: file.size,
      type: file.type,
      duration,
      url,
      file,
      kind: file.type.startsWith("audio/") ? "audio" : "video",
    });
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (!video) return;
    setIsTranscribing(true);
    setError(null);
    try {
      // If user has a key, try the server API route
      if (userKey) {
        // Send the original file directly. Client-side audio extraction
        // via MediaRecorder + AudioContext produces silent/empty audio on
        // many browsers. Let Pollinations extract audio server-side.
        const formData = new FormData();
        formData.append("file", video.file, video.name || "upload");
        formData.append("clientKey", userKey);
        formData.append("durationSec", String(video.duration || 0));
        formData.append("model", selectedSttModel);
        formData.append("maxWordsPerLine", String(maxWordsPerLine));

        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Server error" }));
          throw new Error(errData.error || `Server error ${res.status}`);
        }

        const result: TranscriptionResult = await res.json();
        if (result.segments.length === 0) {
          throw new Error("Transcription returned no segments. The video may not have audible speech.");
        }
        setSegments(result.segments);
        return;
      }

      // Mock fallback (no key)
      await new Promise((r) => setTimeout(r, 1200));
      const result = mockTranscribe(video.duration || 60);
      setSegments(result.segments);
    } catch (apiErr: any) {
      // Server route failed — fall back to mock with warning
      console.warn("Server transcription failed, falling back to mock:", apiErr.message);
      setError(`Live transcription failed: ${apiErr.message}. Showing mock data for preview.`);
      await new Promise((r) => setTimeout(r, 800));
      const result = mockTranscribe(video.duration || 60);
      setSegments(result.segments);
    } finally {
      setIsTranscribing(false);
    }
  }, [selectedSttModel, video, userKey, maxWordsPerLine]);

  const handleExport = useCallback((format: ExportFormat) => {
    if (!segments.length) return;
    const content = exportSubtitles(segments, format);
    const ext = format === "ass" ? "ass" : format;
    const mime =
      format === "srt"
        ? "text/srt"
        : format === "vtt"
        ? "text/vtt"
        : format === "ass"
        ? "text/x-ssa"
        : "application/json";
    downloadFile(content, `subcap-export.${ext}`, mime);
  }, [segments]);

  const handleBurnIn = useCallback(async () => {
    if (!video || !segments.length) return;
    setIsBurning(true);
    setBurnInProgress(0);
    setError(null);
    try {
      const result = await exportBurnIn({
        videoUrl: video.url,
        segments,
        style: activeStyle,
        onProgress: (pct) => setBurnInProgress(Math.round(pct * 100)),
      });
      downloadBlob(result.blob, `subcap-burnin.${result.extension}`);
    } catch (e: any) {
      setError(`Burn-in export failed: ${e?.message || "Unknown error"}`);
    } finally {
      setIsBurning(false);
      setBurnInProgress(0);
    }
  }, [video, segments, activeStyle]);

  // Render preview canvas — sync with video playback using rAF
  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const videoEl = videoRef.current;
    if (!canvas || !videoEl || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 360;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(videoEl, 0, 0, w, h);
    const currentTime = videoEl.currentTime;

    // During playback: show only the segment at current time.
    // When paused + a segment is selected in the list: show that segment
    // for editing preview. Never fall back to segments[0] — that causes
    // a flash of the first subtitle in gaps between segments.
    const segAtTime = segments.find((s) => currentTime >= s.start && currentTime <= s.end);
    const seg =
      segAtTime ??
      (videoEl.paused && selectedSegmentId
        ? segments.find((s) => s.id === selectedSegmentId)
        : undefined);
    if (seg) {
      applyStyleToSegmentCanvas(ctx, activeStyle, seg.text, w, h);
    }
  }, [video, segments, activeStyle, selectedSegmentId]);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      renderPreview();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [renderPreview]);

  const handleStyleChange = (style: SubtitleStyle) => {
    setActiveStyle(style);
    setShowCustomizer(false);
  };
  const handleStylePartial = (partial: Partial<SubtitleStyle>) => {
    setActiveStyle((prev) => ({ ...prev, ...partial }));
  };

  const handleEditSegment = (id: string, field: "start" | "end" | "text", value: string | number) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleMerge = (id: string) => {
    const idx = segments.findIndex((s) => s.id === id);
    if (idx <= 0) return;
    const prev = segments[idx - 1];
    const cur = segments[idx];
    const merged: SubtitleSegment = {
      id: prev.id,
      start: prev.start,
      end: cur.end,
      text: prev.text + " " + cur.text,
    };
    setSegments((seg) => {
      const copy = [...seg];
      copy.splice(idx - 1, 2, merged);
      return copy;
    });
  };

  const handleSplit = (id: string) => {
    const idx = segments.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const cur = segments[idx];
    const mid = (cur.start + cur.end) / 2;
    const words = cur.text.split(" ");
    const half = Math.ceil(words.length / 2);
    const left: SubtitleSegment = {
      id: cur.id + "-a",
      start: cur.start,
      end: mid,
      text: words.slice(0, half).join(" "),
    };
    const right: SubtitleSegment = {
      id: cur.id + "-b",
      start: mid,
      end: cur.end,
      text: words.slice(half).join(" "),
    };
    setSegments((seg) => {
      const copy = [...seg];
      copy.splice(idx, 1, left, right);
      return copy;
    });
  };

  const handleDisconnect = () => {
    setUserKey(null);
    setManualKeyInput("");
    localStorage.removeItem(POLLINATIONS_USER_KEY_STORAGE_KEY);
  };

  const handleManualKeyConnect = () => {
    const trimmed = manualKeyInput.trim();
    if (!isPollinationsApiKey(trimmed)) {
      setError("Invalid Pollinations key. Use a valid `sk_...` development key.");
      return;
    }
    setError(null);
    setUserKey(trimmed);
    setManualKeyInput(trimmed);
    localStorage.setItem(POLLINATIONS_USER_KEY_STORAGE_KEY, trimmed);
    setShowManualKeyEntry(false);
  };

  const handleConnectPollinations = () => {
    if (!runtimeConfig.appKey) {
      setError("Pollinations app key is not configured for this deployment yet.");
      return;
    }
    const state = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    localStorage.setItem(POLLINATIONS_AUTH_STATE_KEY, state);
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    setIsConnecting(true);
    const url = buildPollinationsAuthorizeUrl({
      appKey: runtimeConfig.appKey,
      redirectUri,
      state,
      expiry: 7,
    });
    window.location.href = url;
  };

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--space-xl) 1.25rem" }}>
      {/* Spin animation for loading indicator */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-xl)",
          flexWrap: "wrap",
          gap: "var(--space-md)",
        }}
      >
        <a
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            textDecoration: "none",
            color: "inherit",
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
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          {userKey ? (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--success)", fontWeight: 600 }}>
                ● Connected {maskPollinationsApiKey(userKey)}
              </span>
              <button
                onClick={handleDisconnect}
                style={{
                  padding: "0.3rem 0.6rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  fontSize: "0.78rem",
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleConnectPollinations}
                disabled={isConnecting}
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--accent)",
                  border: "1px solid var(--accent)",
                  color: "var(--bg)",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  transition: "filter var(--transition-fast)",
                  cursor: isConnecting ? "progress" : "pointer",
                  opacity: isConnecting ? 0.75 : 1,
                }}
              >
                {isConnecting ? "Connecting…" : "Connect Pollinations"}
              </button>
              {DEV_MANUAL_KEY_ENTRY_ENABLED && (
                <button
                  onClick={() => setShowManualKeyEntry((current) => !current)}
                  style={{
                    padding: "0.45rem 0.85rem",
                    borderRadius: "var(--radius-sm)",
                    background: showManualKeyEntry ? "rgba(0,229,255,0.12)" : "var(--surface)",
                    border: "1px solid var(--border)",
                    color: showManualKeyEntry ? "var(--accent)" : "var(--text)",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                  }}
                >
                  {showManualKeyEntry ? "Close dev key" : "Paste dev key"}
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {!userKey && DEV_MANUAL_KEY_ENTRY_ENABLED && showManualKeyEntry && (
        <section
          style={{
            marginBottom: "var(--space-lg)",
            padding: "var(--space-lg)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "var(--space-md)",
              alignItems: "flex-start",
              marginBottom: "var(--space-md)",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "-0.01em", marginBottom: "0.3rem" }}>
                Development key entry
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Paste a manual Pollinations user key for local development. This path is meant for dev only and can be removed before production.
              </p>
            </div>
            <span
              style={{
                padding: "0.22rem 0.5rem",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Dev only
            </span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <input
              type="password"
              value={manualKeyInput}
              placeholder="sk_..."
              onChange={(e) => setManualKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleManualKeyConnect();
                }
              }}
              style={{
                flex: "1 1 320px",
                minWidth: 0,
                padding: "0.65rem 0.8rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: "0.9rem",
                fontFamily: "var(--font-mono)",
              }}
            />
            <button
              onClick={handleManualKeyConnect}
              disabled={!manualKeyInput.trim()}
              style={{
                padding: "0.65rem 0.9rem",
                borderRadius: "var(--radius-sm)",
                background: manualKeyInput.trim() ? "var(--accent)" : "var(--bg-2)",
                border: "1px solid var(--border)",
                color: manualKeyInput.trim() ? "var(--bg)" : "var(--muted)",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: manualKeyInput.trim() ? "pointer" : "not-allowed",
                opacity: manualKeyInput.trim() ? 1 : 0.65,
              }}
            >
              Save dev key
            </button>
          </div>
          <p style={{ marginTop: "var(--space-sm)", fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.45 }}>
            Current validation accepts modern Pollinations prefixes like <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>sk_</code> and <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>pk_</code>.
            For transcription during development, use your user spend key.
          </p>
        </section>
      )}

      {/* Error banner */}
      {error && !isTranscribing && (
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <ErrorBanner message={error} onRetry={handleTranscribe} />
        </div>
      )}

      {/* Upload empty state */}
      {!video && (
        <div>
          <UploadEmptyState onFile={handleFile} />
          <div style={{ textAlign: "center", marginTop: "var(--space-md)" }}>
            <button
              onClick={async () => {
                setError(null);
                try {
                  const blob = await generateDemoVideo(8);
                  const file = new File([blob], "demo-video.webm", { type: "video/webm" });
                  await handleFile(file);
                } catch (e: any) {
                  setError("Demo video generation failed: " + (e?.message || "Unknown error"));
                }
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
                fontWeight: 600,
                transition: "border-color var(--transition-fast)",
              }}
            >
              Try with demo video
            </button>
          </div>
        </div>
      )}

      {/* Video + controls */}
      {video && (
        <>
          {/* Video name + change */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "var(--space-md)",
              flexWrap: "wrap",
              gap: "var(--space-sm)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)" }}>{video.name}</span>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                {(video.size / 1024 / 1024).toFixed(1)} MB · {Math.floor(video.duration / 60)}:
                {Math.floor(video.duration % 60).toString().padStart(2, "0")}
              </span>
            </div>
            <button
              onClick={() => {
                setVideo(null);
                setSegments([]);
                setSelectedSegmentId(null);
                setError(null);
              }}
              style={{
                padding: "0.3rem 0.6rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                fontSize: "0.82rem",
              }}
            >
              Change video
            </button>
          </div>

          <div className="studio-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-xl)", alignItems: "start" }}>
            {/* Left: video + canvas overlay */}
            <div>
              <div
                style={{
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  background: "var(--bg-2)",
                  position: "relative",
                  marginBottom: "var(--space-md)",
                }}
              >
                <video
                  ref={videoRef}
                  src={video.url}
                  controls
                  style={{ width: "100%", display: "block" }}
                  crossOrigin="anonymous"
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                  }}
                />
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "var(--space-sm)" }}>
                Preview shows the selected subtitle style on the current frame. Play the video to check timing.
              </p>
            </div>

            {/* Right: style + transcribe + export */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
              {/* Style selector */}
              <div
                style={{
                  padding: "var(--space-lg)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
                    Subtitle style
                  </h3>
                  <button
                    onClick={() => setShowCustomizer((v) => !v)}
                    style={{
                      padding: "0.3rem 0.6rem",
                      borderRadius: "var(--radius-sm)",
                      background: showCustomizer ? "rgba(0,229,255,0.12)" : "var(--bg-2)",
                      border: "1px solid var(--border)",
                      color: showCustomizer ? "var(--accent)" : "var(--text-secondary)",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                    }}
                  >
                    {showCustomizer ? "Close" : "Customize"}
                  </button>
                </div>
                {showCustomizer ? (
                  <StyleCustomizer style={activeStyle} onChange={handleStylePartial} />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                    {DEFAULT_STYLES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleStyleChange(s)}
                        style={{
                          textAlign: "left",
                          padding: "0.75rem 1rem",
                          borderRadius: "var(--radius-sm)",
                          border: activeStyle.id === s.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                          background: activeStyle.id === s.id ? "rgba(0,229,255,0.08)" : "var(--bg-2)",
                          color: "var(--text)",
                          transition: "border-color var(--transition-fast), background var(--transition-fast)",
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.15rem" }}>{s.name}</div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{s.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Transcribe */}
              <div
                style={{
                  padding: "var(--space-lg)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ marginBottom: "var(--space-sm)" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "-0.01em", marginBottom: "0.25rem" }}>
                    Speech-to-text model
                  </h3>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                    Choose the Pollinations transcription model for this video. Whisper stays the default, but tougher audio can use other providers.
                  </p>
                </div>
                <select
                  value={selectedSttModel}
                  onChange={(e) => setSelectedSttModel(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.85rem",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontSize: "0.9rem",
                  }}
                >
                  {runtimeConfig.sttModels.map((model) => {
                    const soon = model.label.includes("(soon)");
                    return (
                      <option key={model.id} value={model.id} disabled={soon} style={{ color: soon ? "var(--muted)" : "var(--text)" }}>
                        {model.label}
                      </option>
                    );
                  })}
                </select>
                <p style={{ marginTop: "var(--space-sm)", fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.45 }}>
                  {(runtimeConfig.sttModels.find((model) => model.id === selectedSttModel) ?? runtimeConfig.sttModels[0])?.description}
                </p>

                {/* Words per line */}
                <div style={{ marginTop: "var(--space-md)" }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-xs)" }}>
                    Max words per subtitle line
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={20}
                    step={1}
                    value={maxWordsPerLine}
                    onChange={(e) => setMaxWordsPerLine(parseInt(e.target.value, 10))}
                    style={{ width: "100%", accentColor: "var(--accent)" }}
                  />
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", textAlign: "right", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                    {maxWordsPerLine} words
                  </div>
                </div>


              </div>

              {/* Transcribe */}
              {isTranscribing ? (
                <TranscriptionSkeleton />
              ) : (
                <button
                  onClick={handleTranscribe}
                  style={{
                    padding: "0.85rem 1.25rem",
                    borderRadius: "var(--radius)",
                    background: "var(--accent)",
                    color: "var(--bg)",
                    fontWeight: 700,
                    fontSize: "1rem",
                    transition: "filter var(--transition-fast)",
                  }}
                >
                  Transcribe video
                </button>
              )}

              {/* Pollen cost estimate */}
              {video && (
                <div
                  style={{
                    padding: "var(--space-md)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, marginBottom: "var(--space-xs)" }}>
                    Estimated Pollen cost
                  </p>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                    Model: {selectedSttModel}
                    <br />
                    Transcribe: {estimatePollenCost(video.duration / 60, "transcribe")}
                    <br />
                    Burn-in: {estimatePollenCost(video.duration / 60, "burnin")}
                    <br />
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Estimate only. Final wallet spend is calculated by Pollinations at request time.
                    </span>
                  </p>
                </div>
              )}

              {/* Warning when no key */}
              {!userKey && !isTranscribing && (
                <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.45 }}>
                  Without a Pollinations key, transcription uses mock data.{" "}
                  <button
                    onClick={handleConnectPollinations}
                    style={{ color: "var(--accent)", textDecoration: "underline", fontSize: "0.82rem", fontWeight: 600 }}
                  >
                    Connect Pollinations
                  </button>{" "}
                  for real Whisper transcription and BYOP wallet attribution.
                  {DEV_MANUAL_KEY_ENTRY_ENABLED ? (
                    <>
                      {" "}Or{" "}
                      <button
                        onClick={() => setShowManualKeyEntry(true)}
                        style={{ color: "var(--accent)", textDecoration: "underline", fontSize: "0.82rem", fontWeight: 600 }}
                      >
                        paste a dev key
                      </button>
                      .
                    </>
                  ) : null}
                </p>
              )}

              {/* Export */}
              {segments.length > 0 && (
                <div
                  style={{
                    padding: "var(--space-lg)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "var(--space-md)", letterSpacing: "-0.01em" }}>
                    Export
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}>
                    {(["srt", "vtt", "ass", "json"] as ExportFormat[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => handleExport(f)}
                        style={{
                          padding: "0.5rem 0.85rem",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-2)",
                          border: "1px solid var(--border)",
                          color: "var(--text)",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          transition: "border-color var(--transition-fast)",
                        }}
                      >
                        .{f}
                      </button>
                    ))}
                    <button
                      onClick={handleBurnIn}
                      disabled={isBurning || segments.length === 0}
                      style={{
                        padding: "0.5rem 0.85rem",
                        borderRadius: "var(--radius-sm)",
                        background: isBurning ? "var(--bg-2)" : "rgba(0,229,255,0.12)",
                        border: "1px solid var(--accent)",
                        color: isBurning ? "var(--muted)" : "var(--accent)",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        transition: "border-color var(--transition-fast)",
                        cursor: isBurning ? "not-allowed" : "pointer",
                        opacity: isBurning ? 0.6 : 1,
                        minWidth: 120,
                      }}
                    >
                      {isBurning ? `Recording ${burnInProgress}%` : "Burn-in video"}
                    </button>
                  </div>
                  {isBurning && (
                    <div
                      style={{
                        marginTop: "var(--space-sm)",
                        height: 4,
                        borderRadius: 2,
                        background: "var(--bg-2)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${burnInProgress}%`,
                          height: "100%",
                          background: "var(--accent)",
                          transition: "width 150ms linear",
                        }}
                      />
                    </div>
                  )}
                  <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "var(--space-sm)", lineHeight: 1.45 }}>
                    Burn-in outputs WebM (plays in all modern browsers and upload platforms).
                    Short-form videos (&lt;3 min) recommended.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Segments editor */}
          <div style={{ marginTop: "var(--space-2xl)" }}>
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                marginBottom: "var(--space-lg)",
              }}
            >
              Subtitle segments {segments.length > 0 && `(${segments.length})`}
            </h2>
            {segments.length === 0 && !isTranscribing ? (
              <SegmentsEmptyState />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {segments.map((seg, idx) => (
                  <div
                    key={seg.id}
                    onClick={() => setSelectedSegmentId(seg.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "70px 1fr 70px auto",
                      minWidth: 0,
                      gap: "var(--space-sm)",
                      alignItems: "center",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "var(--radius-sm)",
                      border: selectedSegmentId === seg.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                      background: selectedSegmentId === seg.id ? "rgba(0,229,255,0.06)" : "var(--surface)",
                      cursor: "pointer",
                      transition: "border-color var(--transition-fast), background var(--transition-fast)",
                    }}
                  >
                    <input
                      type="text"
                      value={formatTime(seg.start)}
                      onChange={(e) => {
                        const parts = e.target.value.split(":");
                        if (parts.length === 2) {
                          const [m, s] = parts;
                          const seconds = parseInt(m, 10) * 60 + parseFloat(s);
                          if (!isNaN(seconds)) handleEditSegment(seg.id, "start", seconds);
                        }
                      }}
                      style={{
                        background: "var(--bg-2)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "0.35rem 0.5rem",
                        color: "var(--text)",
                        fontSize: "0.82rem",
                        fontFamily: "var(--font-mono)",
                        width: "100%",
                      }}
                    />
                    <input
                      type="text"
                      value={seg.text}
                      onChange={(e) => handleEditSegment(seg.id, "text", e.target.value)}
                      style={{
                        background: "var(--bg-2)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "0.35rem 0.5rem",
                        color: "var(--text)",
                        fontSize: "0.9rem",
                        width: "100%",
                      }}
                    />
                    <input
                      type="text"
                      value={formatTime(seg.end)}
                      onChange={(e) => {
                        const parts = e.target.value.split(":");
                        if (parts.length === 2) {
                          const [m, s] = parts;
                          const seconds = parseInt(m, 10) * 60 + parseFloat(s);
                          if (!isNaN(seconds)) handleEditSegment(seg.id, "end", seconds);
                        }
                      }}
                      style={{
                        background: "var(--bg-2)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "0.35rem 0.5rem",
                        color: "var(--text)",
                        fontSize: "0.82rem",
                        fontFamily: "var(--font-mono)",
                        width: "100%",
                      }}
                    />
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMerge(seg.id);
                        }}
                        title="Merge with previous"
                        disabled={idx === 0}
                        style={{
                          padding: "0.3rem 0.45rem",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-2)",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                          fontSize: "0.75rem",
                          cursor: idx === 0 ? "not-allowed" : "pointer",
                          opacity: idx === 0 ? 0.4 : 1,
                        }}
                      >
                        Merge
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSplit(seg.id);
                        }}
                        title="Split segment"
                        style={{
                          padding: "0.3rem 0.45rem",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-2)",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                          fontSize: "0.75rem",
                        }}
                      >
                        Split
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    {/* Mobile responsive overrides */}
    <style>{`
      @media (max-width: 768px) {
        .studio-grid { grid-template-columns: 1fr !important; }
      }
    `}</style>
    </main>
  );
}
