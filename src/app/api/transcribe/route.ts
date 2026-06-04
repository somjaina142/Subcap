import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_POLLINATIONS_STT_MODEL } from "@/lib/stt-models";

const TRANSCRIBE_URL = "https://gen.pollinations.ai/v1/audio/transcriptions";
const DEFAULT_AUDIO_MODEL = process.env.POLLINATIONS_AUDIO_MODEL ?? DEFAULT_POLLINATIONS_STT_MODEL;

// ── Types ──────────────────────────────────────────────────────────
type RawSegment = {
  start?: number | string | null;
  end?: number | string | null;
  text?: string | null;
};

type SubtitleSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
};

// ── Helpers ──────────────────────────────────────────────────────
function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Parse SRT text into timed segments */
function parseSrt(srtText: string): SubtitleSegment[] {
  const blocks = srtText.trim().split(/\n\n+/);
  const segments: SubtitleSegment[] = [];
  let index = 0;
  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 2) continue;
    // Find the timestamp line (format: 00:00:01,234 --> 00:00:04,567)
    const tsLine = lines.find((l) => l.includes("-->"));
    if (!tsLine) continue;
    const tsMatch = tsLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!tsMatch) continue;
    const start =
      parseInt(tsMatch[1]) * 3600 +
      parseInt(tsMatch[2]) * 60 +
      parseInt(tsMatch[3]) +
      parseInt(tsMatch[4]) / 1000;
    const end =
      parseInt(tsMatch[5]) * 3600 +
      parseInt(tsMatch[6]) * 60 +
      parseInt(tsMatch[7]) +
      parseInt(tsMatch[8]) / 1000;
    // Text is everything after the timestamp line
    const text = lines.slice(lines.indexOf(tsLine) + 1).join(" ").trim();
    if (text) {
      segments.push({ id: `seg-${index}`, start, end, text });
      index++;
    }
  }
  return segments;
}

/** Try to parse raw response from any format into segments */
function extractSegmentsFromResponse(
  rawText: string,
  durationSec: number
): { segments: SubtitleSegment[]; format: string; rawPreview: string } {
  const preview = rawText.slice(0, 500);

  // 1) Try SRT
  const srtSegments = parseSrt(rawText);
  if (srtSegments.length > 0) {
    return { segments: srtSegments, format: "srt", rawPreview: preview };
  }

  // 2) Try JSON (verbose_json fallback)
  try {
    const data = JSON.parse(rawText);
    if (Array.isArray(data.segments)) {
      const segs = data.segments
        .filter((s: any) => s.text && typeof s.start === "number" && typeof s.end === "number")
        .map((s: any, i: number) => ({
          id: `seg-${i}`,
          start: s.start,
          end: s.end,
          text: String(s.text).trim(),
        }));
      if (segs.length > 0) {
        return { segments: segs, format: "json-segments", rawPreview: preview };
      }
    }
    if (Array.isArray(data.words)) {
      // Group words into ~8-word segments
      const words = data.words.filter((w: any) => w.word || w.text);
      const groupSize = 8;
      const segs: SubtitleSegment[] = [];
      for (let i = 0; i < words.length; i += groupSize) {
        const group = words.slice(i, i + groupSize);
        segs.push({
          id: `seg-${i}`,
          start: group[0].start ?? 0,
          end: group[group.length - 1].end ?? (group[0].start ?? 0) + 2,
          text: group.map((w: any) => w.word || w.text).join(" ").trim(),
        });
      }
      if (segs.length > 0) {
        return { segments: segs, format: "json-words", rawPreview: preview };
      }
    }
  } catch {
    // Not JSON
  }

  // 3) Try VTT
  const vttMatches = rawText.matchAll(
    /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\s*\n?([^\n]+)/g
  );
  const vttSegments: SubtitleSegment[] = [];
  let vttIdx = 0;
  for (const m of vttMatches) {
    const start = m[1].split(":").map(Number);
    const end = m[2].split(":").map(Number);
    const text = m[3].trim();
    if (text) {
      vttSegments.push({
        id: `seg-${vttIdx}`,
        start: start[0] * 3600 + start[1] * 60 + start[2],
        end: end[0] * 3600 + end[1] * 60 + end[2],
        text,
      });
      vttIdx++;
    }
  }
  if (vttSegments.length > 0) {
    return { segments: vttSegments, format: "vtt", rawPreview: preview };
  }

  // 4) Try plain text with embedded timestamps (e.g. "[00:01.234] Hello world")
  const plainMatches = rawText.matchAll(
    /\[(?:(\d{2}):)?(\d{2}):(\d{2})[,.](\d{2,3})\]\s*([^\n\[]+)/g
  );
  const plainSegments: SubtitleSegment[] = [];
  let plainIdx = 0;
  for (const m of plainMatches) {
    const hrs = m[1] ? parseInt(m[1]) : 0;
    const mins = parseInt(m[2]);
    const secs = parseInt(m[3]);
    const ms = parseInt(m[4].padEnd(3, "0"));
    const text = m[5].trim();
    if (text) {
      plainSegments.push({
        id: `seg-${plainIdx}`,
        start: hrs * 3600 + mins * 60 + secs + ms / 1000,
        end: hrs * 3600 + mins * 60 + secs + ms / 1000 + 2, // guess 2s duration
        text,
      });
      plainIdx++;
    }
  }
  if (plainSegments.length > 0) {
    return { segments: plainSegments, format: "plain-timestamps", rawPreview: preview };
  }

  // 5) Plain text — split by sentences and distribute over duration
  const sentences = rawText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (sentences.length > 0) {
    const safeDuration = durationSec > 0 ? durationSec : Math.max(sentences.length * 3, 10);
    const slice = safeDuration / sentences.length;
    return {
      segments: sentences.map((text, i) => ({
        id: `seg-${i}`,
        start: Number((i * slice).toFixed(3)),
        end: Number(((i + 1) * slice).toFixed(3)),
        text,
      })),
      format: "plain-text-split",
      rawPreview: preview,
    };
  }

  return { segments: [], format: "none", rawPreview: preview };
}

/**
 * Consolidate short SRT chunks into longer subtitle lines.
 * @param segments - raw SRT segments
 * @param maxWordsPerLine - max words per merged line
 * @param maxDurationMs - max duration (ms) of a merged line; forces a new line even if under word limit
 * @returns merged, readable subtitle segments
 */
function consolidateSegments(
  segments: SubtitleSegment[],
  maxWordsPerLine: number,
  maxDurationMs: number
): SubtitleSegment[] {
  if (segments.length === 0) return [];
  if (maxWordsPerLine <= 0) return segments;

  const result: SubtitleSegment[] = [];
  let currentWords: string[] = [];
  let currentStart = segments[0].start;
  let currentEnd = segments[0].end;
  let idx = 0;

  for (const seg of segments) {
    const candidateWords = [...currentWords, ...seg.text.split(/\s+/)].filter(Boolean);
    const candidateDuration = (currentStart === seg.start ? seg.end - seg.start : seg.end - currentStart) * 1000;

    if (candidateWords.length <= maxWordsPerLine && candidateDuration <= maxDurationMs) {
      // Merge into current line
      currentWords = candidateWords;
      currentEnd = seg.end;
    } else {
      // Push current line and start new one
      if (currentWords.length > 0) {
        result.push({
          id: `seg-${idx}`,
          start: currentStart,
          end: currentEnd,
          text: currentWords.join(" "),
        });
        idx++;
      }
      currentWords = seg.text.split(/\s+/).filter(Boolean);
      currentStart = seg.start;
      currentEnd = seg.end;
    }
  }

  // Push remaining
  if (currentWords.length > 0) {
    result.push({
      id: `seg-${idx}`,
      start: currentStart,
      end: currentEnd,
      text: currentWords.join(" "),
    });
  }

  return result;
}

// ── Route ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientKey = formData.get("clientKey") as string | null;
    const language = formData.get("language") as string | null;
    const model = formData.get("model") as string | null;
    const prompt = (formData.get("prompt") as string | null) ?? undefined;
    const durationSec = toNumber(formData.get("durationSec") as string | null) ?? 0;
    const maxWordsPerLine = Math.max(1, Math.min(50, toNumber(formData.get("maxWordsPerLine") as string | null) ?? 8));
    const maxDurationMs = Math.max(500, Math.min(15000, toNumber(formData.get("maxDurationMs") as string | null) ?? 5000));

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log("[transcribe] received file:", {
      name: file.name,
      type: file.type,
      size: file.size,
      model: model || DEFAULT_AUDIO_MODEL,
      maxWordsPerLine,
      maxDurationMs,
    });

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Received empty file (0 bytes). The upload may have been corrupted." },
        { status: 400 }
      );
    }

    // Reconstruct a proper Blob from the File to ensure clean forwarding.
    const arrayBuffer = await file.arrayBuffer();
    const forwardBlob = new Blob([arrayBuffer], { type: file.type || "application/octet-stream" });

    // Build upstream form data — request SRT for ALL models.
    // SRT is universally supported across Whisper and AssemblyAI, and always
    // contains per-segment timestamps. verbose_json + timestamp_granularities
    // is OpenAI-native and not reliably supported by proxy providers.
    const upstreamForm = new FormData();
    upstreamForm.append("file", forwardBlob, file.name || "audio.wav");
    upstreamForm.append("model", model || DEFAULT_AUDIO_MODEL);
    if (language) upstreamForm.append("language", language);

    // Whisper prompt: guides vocabulary, punctuation, and subtitle line length.
    // Note: Whisper does not follow exact word counts, but the prompt
    // nudges it toward shorter phrases which improve downstream consolidation.
    const defaultPrompt =
      `Use natural punctuation and capitalization. ` +
      `Keep each subtitle caption line to about ${maxWordsPerLine} words or fewer. ` +
      `Break long sentences into multiple short caption lines. ` +
      `No speaker labels or extra commentary.`;
    upstreamForm.append("prompt", prompt ? `${prompt}\n${defaultPrompt}` : defaultPrompt);
    upstreamForm.append("response_format", "srt");

    const headers: Record<string, string> = {};
    if (clientKey) {
      headers["Authorization"] = `Bearer ${clientKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    const res = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      headers,
      body: upstreamForm,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      return NextResponse.json(
        { error: `Transcription API error ${res.status}: ${errorText}` },
        { status: res.status }
      );
    }

    // Read raw response and try multiple format parsers.
    // Pollinations sometimes returns JSON instead of SRT even when we
    // request response_format=srt, so we normalize everything.
    const rawText = await res.text();
    const { segments: rawSegments, format: detectedFormat, rawPreview } = extractSegmentsFromResponse(
      rawText,
      durationSec
    );

    if (rawSegments.length === 0) {
      return NextResponse.json(
        {
          error: "Transcription returned no segments. The video may not have audible speech.",
          debug: process.env.NODE_ENV !== "production"
            ? {
                model,
                rawLength: rawText.length,
                detectedFormat,
                rawPreview,
              }
            : undefined,
        },
        { status: 422 }
      );
    }

    // Merge short chunks into readable lines
    const segments = consolidateSegments(rawSegments, maxWordsPerLine, maxDurationMs);
    const fullText = segments.map((s) => s.text).join(" ");

    return NextResponse.json({
      segments,
      language: language ?? "en",
      fullText,
      debug: process.env.NODE_ENV !== "production"
        ? {
            model: model || DEFAULT_AUDIO_MODEL,
            detectedFormat,
            rawSegmentCount: rawSegments.length,
            consolidatedCount: segments.length,
            maxWordsPerLine,
            maxDurationMs,
            usedFallbackSegmentation: detectedFormat === "plain-text-split",
          }
        : undefined,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return NextResponse.json({ error: "Transcription timed out" }, { status: 504 });
    }
    return NextResponse.json(
      { error: err?.message || "Internal transcription error" },
      { status: 500 }
    );
  }
}
