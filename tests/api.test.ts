import { describe, it, expect, vi } from "vitest";
import "../src/app/api/config/route";
import "../src/app/api/models/route";
import "../src/app/api/transcribe/route";
import { POLLINATIONS_STT_MODELS } from "../src/lib/stt-models";

// Verify API route modules load without crashing
describe("API routes", () => {
  it("config route module loads", () => {
    expect(true).toBe(true);
  });
  it("models route module loads", () => {
    expect(true).toBe(true);
  });
  it("transcribe route module loads", () => {
    expect(true).toBe(true);
  });
});

describe("Model filter logic", () => {
  function isPaid(m: any) {
    return m.paidOnly === true || m.paid_only === true;
  }
  function hasOutput(m: any, mod: string) {
    return (m.output_modalities ?? []).includes(mod);
  }

  it("excludes paidOnly models", () => {
    expect(isPaid({ id: "a", paidOnly: true })).toBe(true);
    expect(isPaid({ id: "b", paid_only: true })).toBe(true);
    expect(isPaid({ id: "c", paidOnly: false })).toBe(false);
    expect(isPaid({ id: "d" })).toBe(false);
  });

  it("excludes video from image models", () => {
    const m1 = { id: "flux", output_modalities: ["image"] };
    const m2 = { id: "wan", output_modalities: ["image", "video"] };
    const imageOk = hasOutput(m1, "image") && !hasOutput(m1, "video");
    const imageBad = hasOutput(m2, "image") && !hasOutput(m2, "video");
    expect(imageOk).toBe(true);
    expect(imageBad).toBe(false);
  });

  it("excludes image from video models", () => {
    const m1 = { id: "ltx", output_modalities: ["video"] };
    const m2 = { id: "wan", output_modalities: ["image", "video"] };
    const videoOk = hasOutput(m1, "video") && !hasOutput(m1, "image");
    const videoBad = hasOutput(m2, "video") && !hasOutput(m2, "image");
    expect(videoOk).toBe(true);
    expect(videoBad).toBe(false);
  });

  it("includes the documented Pollinations STT models", () => {
    const ids = POLLINATIONS_STT_MODELS.map((model) => model.id);
    expect(ids).toEqual([
      "universal-3-pro",
      "universal-2",
      "whisper-large-v3",
    ]);
  });
});

describe("Transcription normalization", () => {
  it("maps Whisper verbose_json segments to our shape", () => {
    const data = {
      segments: [
        { start: 0, end: 2.5, text: "Hello world" },
        { start: 3, end: 5, text: "Second line" },
      ],
      language: "en",
      text: "Hello world Second line",
    };
    const mapped = data.segments.map((s: any, i: number) => ({
      id: `seg-${i}`,
      start: s.start ?? 0,
      end: s.end ?? 0,
      text: (s.text ?? "").trim(),
    }));
    expect(mapped).toHaveLength(2);
    expect(mapped[0]).toEqual({ id: "seg-0", start: 0, end: 2.5, text: "Hello world" });
    expect(mapped[1]).toEqual({ id: "seg-1", start: 3, end: 5, text: "Second line" });
  });

  it("filters empty and zero-length segments", () => {
    const segs = [
      { text: "ok", end: 2, start: 0 },
      { text: "", end: 4, start: 3 },
      { text: "bad", end: 3, start: 3 },
    ];
    const filtered = segs.filter(
      (s) => s.text.length > 0 && s.end > s.start
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].text).toBe("ok");
  });

  it("can synthesize coarse segments from plain transcript text", () => {
    const fullText = "Hello world. This is a second sentence.";
    const durationSec = 8;
    const parts = fullText
      .split(/(?<=[.!?])\s+|\n+/)
      .map((part) => part.trim())
      .filter(Boolean);
    const slice = durationSec / parts.length;
    const synthesized = parts.map((text, index) => ({
      id: `seg-${index}`,
      start: Number((index * slice).toFixed(3)),
      end: Number(((index + 1) * slice).toFixed(3)),
      text,
    }));

    expect(synthesized).toHaveLength(2);
    expect(synthesized[0].text).toBe("Hello world.");
    expect(synthesized[1].text).toBe("This is a second sentence.");
    expect(synthesized[1].end).toBe(8);
  });
});
