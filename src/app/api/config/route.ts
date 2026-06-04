import { NextResponse } from "next/server";
import { DEFAULT_POLLINATIONS_STT_MODEL, POLLINATIONS_STT_MODELS } from "@/lib/stt-models";

export async function GET() {
  const appKey =
    process.env.NEXT_PUBLIC_POLLINATIONS_APP_KEY ??
    process.env.NEXT_PUBLIC_APP_KEY ??
    "";
  const mockEnabled = process.env.POLLINATIONS_ALLOW_MOCK !== "false";
  const defaultAudioModel = process.env.POLLINATIONS_AUDIO_MODEL ?? DEFAULT_POLLINATIONS_STT_MODEL;
  return NextResponse.json({
    appKey: appKey || null,
    appKeyPresent: !!appKey && appKey.startsWith("pk_"),
    mockEnabled,
    appKeyPrefix: appKey ? `${appKey.slice(0, 6)}...` : null,
    defaultAudioModel,
    sttModels: POLLINATIONS_STT_MODELS,
  });
}
