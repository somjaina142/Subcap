import type { SubtitleSegment, TranscriptionResult } from "./types";

export function mockTranscribe(durationSeconds: number): TranscriptionResult {
  const segments: SubtitleSegment[] = [];
  const words = [
    "Welcome back to the channel.",
    "Today we are diving deep into something",
    "that most creators completely overlook.",
    "And that is the power of subtitles.",
    "Did you know that 85% of people",
    "watch social videos with the sound off?",
    "If you are not captioning your content",
    "you are literally leaving views on the table.",
    "Let me show you how to fix that right now.",
    "First, you need a transcript.",
    "Then style it so it matches your brand.",
    "And finally export it in the right format.",
    "Stick around and I will walk you through each step.",
    "Let's get started.",
  ];
  const avgDuration = durationSeconds / words.length;
  for (let i = 0; i < words.length; i++) {
    const start = Math.round(i * avgDuration * 10) / 10;
    const end = Math.round((i + 1) * avgDuration * 10) / 10;
    segments.push({
      id: `seg-${i}`,
      start,
      end,
      text: words[i],
    });
  }
  return {
    segments,
    language: "en",
    fullText: words.join(" "),
  };
}
