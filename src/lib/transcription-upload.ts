import type { MediaKind } from "./types";

const DIRECT_UPLOAD_MIME_TYPES = new Set([
  "audio/m4a",
  "audio/mp3",
  "audio/mp4",
  "audio/mpga",
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
  "video/mp4",
  "video/mpeg",
  "video/webm",
]);

const DIRECT_UPLOAD_EXTENSIONS = new Set([
  "m4a",
  "mp3",
  "mp4",
  "mpga",
  "mpeg",
  "wav",
  "webm",
]);

const AUDIO_ONLY_EXTENSIONS = new Set([
  "m4a",
  "mp3",
  "mpga",
  "mpeg",
  "wav",
]);

function normalizedExtension(name?: string | null) {
  if (!name) return "";
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) ?? "" : "";
}

export function inferMediaKind(file: Pick<File, "name" | "type">): MediaKind {
  const normalizedType = (file.type ?? "").toLowerCase();
  if (normalizedType.startsWith("audio/")) return "audio";
  if (normalizedType.startsWith("video/")) return "video";
  return AUDIO_ONLY_EXTENSIONS.has(normalizedExtension(file.name)) ? "audio" : "video";
}

export function supportsDirectTranscriptionUpload(file: Pick<File, "name" | "type">) {
  const normalizedType = (file.type ?? "").toLowerCase();
  if (DIRECT_UPLOAD_MIME_TYPES.has(normalizedType)) return true;
  return DIRECT_UPLOAD_EXTENSIONS.has(normalizedExtension(file.name));
}

export function getTranscriptionResponseFormat(model?: string | null): "json" | "verbose_json" {
  const normalizedModel = (model ?? "").toLowerCase();
  return normalizedModel === "whisper-large-v3" || normalizedModel === "whisper-1"
    ? "verbose_json"
    : "json";
}
