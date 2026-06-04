import { describe, it, expect } from "vitest";
import { exportSubtitles, wrapSubtitleText } from "@/lib/subtitle";
import type { SubtitleSegment } from "@/lib/types";

const segments: SubtitleSegment[] = [
  { id: "1", start: 0, end: 2.5, text: "Hello world" },
  { id: "2", start: 3, end: 5.123, text: "Second line" },
];

describe("exportSubtitles", () => {
  it("exports valid SRT", () => {
    const srt = exportSubtitles(segments, "srt");
    expect(srt).toContain("1");
    expect(srt).toContain("00:00:00,000 --> 00:00:02,500");
    expect(srt).toContain("Hello world");
    expect(srt).toContain("2");
    expect(srt).toContain("00:00:03,000 --> 00:00:05,123");
    expect(srt).toContain("Second line");
  });

  it("exports valid VTT", () => {
    const vtt = exportSubtitles(segments, "vtt");
    expect(vtt).toContain("WEBVTT");
    expect(vtt).toContain("00:00:00.000 --> 00:00:02.500");
    expect(vtt).toContain("Hello world");
  });

  it("exports valid ASS", () => {
    const ass = exportSubtitles(segments, "ass");
    expect(ass).toContain("[Script Info]");
    expect(ass).toContain("Dialogue:");
    expect(ass).toContain("Hello world");
  });

  it("exports valid JSON", () => {
    const json = exportSubtitles(segments, "json");
    const parsed = JSON.parse(json);
    expect(parsed.segments).toHaveLength(2);
    expect(parsed.segments[0].text).toBe("Hello world");
  });

  it("handles empty segments gracefully", () => {
    const srt = exportSubtitles([], "srt");
    expect(srt.trim()).toBe("");
  });

  it("pads hours, minutes, seconds correctly", () => {
    const long: SubtitleSegment[] = [
      { id: "a", start: 3661.001, end: 3662.002, text: "Long" },
    ];
    const srt = exportSubtitles(long, "srt");
    expect(srt).toContain("01:01:01,001 --> 01:01:02,002");
  });

  it("wraps long subtitle text into multiple lines", () => {
    const lines = wrapSubtitleText(
      {
        measureText: (value: string) => ({ width: value.length * 10 }) as TextMetrics,
      },
      "This subtitle line needs to wrap before it hits the video edge",
      180
    );
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe("This subtitle line needs to wrap before it hits the video edge");
  });

  it("wraps long no-space text without overflowing forever", () => {
    const lines = wrapSubtitleText(
      {
        measureText: (value: string) => ({ width: value.length * 12 }) as TextMetrics,
      },
      "LongUnbrokenSubtitleToken",
      60
    );
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("LongUnbrokenSubtitleToken");
  });
});
