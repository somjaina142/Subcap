export interface SubtitleSegment {
  id: string;
  start: number; // seconds
  end: number;
  text: string;
}

export interface SubtitleStyle {
  id: string;
  name: string;
  description: string;
  fontFamily: string;
  fontSize: number; // relative to video height (0-1)
  color: string;
  backgroundColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  position: "top" | "center" | "bottom";
  alignment: "left" | "center" | "right";
  uppercase: boolean;
  bold: boolean;
  animation: "none" | "pop" | "slide" | "fade";
}

export type MediaKind = "video" | "audio";

export interface MediaFile {
  id: string;
  name: string;
  size: number;
  type: string;
  duration: number;
  url: string; // blob URL
  file: File;
  kind: MediaKind;
}

export interface TranscriptionResult {
  segments: SubtitleSegment[];
  language: string;
  fullText: string;
}

export type ExportFormat = "srt" | "vtt" | "ass" | "json";

export const DEFAULT_STYLES: SubtitleStyle[] = [
  {
    id: "kinetic",
    name: "Kinetic Bold",
    description: "Big, bouncy, attention-grabbing. Perfect for Shorts and TikTok.",
    fontFamily: "Impact, Arial Black, sans-serif",
    fontSize: 0.065,
    color: "#ffffff",
    outlineColor: "#000000",
    outlineWidth: 4,
    shadowColor: "#000000",
    shadowBlur: 8,
    position: "center",
    alignment: "center",
    uppercase: true,
    bold: true,
    animation: "pop",
  },
  {
    id: "minimal",
    name: "Minimal Clean",
    description: "Thin, elegant, unobtrusive. Best for courses and corporate.",
    fontFamily: "Inter, Helvetica, sans-serif",
    fontSize: 0.045,
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.5)",
    position: "bottom",
    alignment: "center",
    uppercase: false,
    bold: false,
    animation: "none",
  },
  {
    id: "neon",
    name: "Neon Glow",
    description: "Vibrant glow effect. Great for gaming and tech content.",
    fontFamily: "Courier New, monospace",
    fontSize: 0.055,
    color: "#39ff14",
    outlineColor: "#0a0a0a",
    outlineWidth: 2,
    shadowColor: "#39ff14",
    shadowBlur: 12,
    position: "bottom",
    alignment: "center",
    uppercase: true,
    bold: true,
    animation: "fade",
  },
  {
    id: "corporate",
    name: "Corporate Clean",
    description: "Professional and readable. Subtle, confident typography.",
    fontFamily: "Georgia, serif",
    fontSize: 0.04,
    color: "#f8f9fa",
    outlineColor: "#212529",
    outlineWidth: 1,
    position: "bottom",
    alignment: "center",
    uppercase: false,
    bold: false,
    animation: "none",
  },
];
