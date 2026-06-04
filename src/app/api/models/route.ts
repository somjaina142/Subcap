import { NextResponse } from "next/server";

const GEN_MODELS_URL = "https://gen.pollinations.ai/v1/models";
const IMAGE_MODELS_URL = "https://gen.pollinations.ai/image/models";
const AUDIO_MODELS_URL = "https://gen.pollinations.ai/audio/models";

interface ModelInfo {
  id: string;
  name?: string;
  paidOnly?: boolean;
  paid_only?: boolean;
  output_modalities?: string[];
  input_modalities?: string[];
  [key: string]: unknown;
}

function isPaid(model: ModelInfo): boolean {
  return model.paidOnly === true || model.paid_only === true;
}

function hasOutputModality(model: ModelInfo, modality: string): boolean {
  const modalities = model.output_modalities ?? [];
  return modalities.includes(modality);
}

export async function GET() {
  try {
    // Fetch all model lists in parallel
    const [genRes, imageRes, audioRes] = await Promise.allSettled([
      fetch(GEN_MODELS_URL, { next: { revalidate: 300 } }),
      fetch(IMAGE_MODELS_URL, { next: { revalidate: 300 } }),
      fetch(AUDIO_MODELS_URL, { next: { revalidate: 300 } }),
    ]);

    const parseJson = async (result: PromiseSettledResult<Response>): Promise<ModelInfo[]> => {
      if (result.status === "fulfilled" && result.value.ok) {
        try {
          const data = await result.value.json();
          if (Array.isArray(data)) return data;
          if (data?.data && Array.isArray(data.data)) return data.data;
          return [];
        } catch {
          return [];
        }
      }
      return [];
    };

    const [genModels, imageModels, audioModels] = await Promise.all([
      parseJson(genRes),
      parseJson(imageRes),
      parseJson(audioRes),
    ]);

    // Deduplicate by id (gen.models may overlap with image/audio)
    const seen = new Set<string>();
    const allModels: ModelInfo[] = [];
    for (const m of [...genModels, ...imageModels, ...audioModels]) {
      const id = m.id ?? m.name;
      if (id && !seen.has(id)) {
        seen.add(id);
        allModels.push(m);
      }
    }

    // Apply model filter rules per CRON_PROMPT / REGISTRY policy
    const freeModels = allModels.filter((m) => !isPaid(m));

    // Image models: exclude those that output video
    const imageOnlyModels = freeModels.filter(
      (m) => hasOutputModality(m, "image") && !hasOutputModality(m, "video")
    );

    // Video models: exclude those that output image
    const videoOnlyModels = freeModels.filter(
      (m) => hasOutputModality(m, "video") && !hasOutputModality(m, "image")
    );

    // Audio models (transcription + TTS)
    const audioModelsFiltered = freeModels.filter(
      (m) =>
        hasOutputModality(m, "audio") ||
        m.id?.toLowerCase().includes("whisper") ||
        m.id?.toLowerCase().includes("tts") ||
        m.id?.toLowerCase().includes("eleven")
    );

    // Text models (chat completions)
    const textModels = freeModels.filter(
      (m) =>
        hasOutputModality(m, "text") ||
        (!hasOutputModality(m, "image") &&
          !hasOutputModality(m, "video") &&
          !hasOutputModality(m, "audio") &&
          !m.id?.toLowerCase().includes("whisper") &&
          !m.id?.toLowerCase().includes("flux"))
    );

    return NextResponse.json({
      text: textModels.map((m) => ({ id: m.id, name: m.name ?? m.id })),
      image: imageOnlyModels.map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        inputModalities: m.input_modalities ?? [],
      })),
      video: videoOnlyModels.map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        inputModalities: m.input_modalities ?? [],
        videoCapabilities: (m as any).video_capabilities ?? [],
      })),
      audio: audioModelsFiltered.map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        voices: (m as any).voices ?? [],
      })),
      totalFree: freeModels.length,
      totalAll: allModels.length,
      excludedPaid: allModels.length - freeModels.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch models" },
      { status: 500 }
    );
  }
}
