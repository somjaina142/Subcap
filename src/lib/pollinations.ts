const TEXT_BASE = "https://text.pollinations.ai/openai/chat/completions";
const AUDIO_BASE = "https://audio.pollinations.ai/transcribe";

export async function pollinationsText({
  messages,
  model = "openai",
  apiKey,
  temperature = 0.7,
}: {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  apiKey?: string;
  temperature?: number;
}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(TEXT_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, messages, temperature }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      throw new Error(`Pollinations text API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as any;
    const content = data.choices?.[0]?.message?.content ?? "";
    return content;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

export async function transcribeAudio({
  audioBlob,
  apiKey,
}: {
  audioBlob: Blob;
  apiKey?: string;
}): Promise<{ text: string; segments: Array<{ start: number; end: number; text: string }> }> {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.wav");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(AUDIO_BASE, {
      method: "POST",
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      throw new Error(`Pollinations audio API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as any;
    return {
      text: data.text ?? "",
      segments: (data.segments ?? []).map((s: any) => ({
        start: s.start ?? 0,
        end: s.end ?? 0,
        text: s.text ?? "",
      })),
    };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}
