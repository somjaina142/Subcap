export interface SttModelOption {
  id: string;
  label: string;
  description: string;
}

export const POLLINATIONS_STT_MODELS: SttModelOption[] = [
  {
    id: "universal-3-pro",
    label: "AssemblyAI Universal-3 Pro",
    description: "Highest-accuracy option. Best for non-native accents and noisy audio.",
  },
  {
    id: "universal-2",
    label: "AssemblyAI Universal-2",
    description: "Broad language coverage with balanced speed and accuracy.",
  },
  {
    id: "whisper-large-v3",
    label: "Whisper Large v3 (soon)",
    description: "Default Pollinations Whisper model. Temporarily unavailable via proxy.",
  },
];

export const DEFAULT_POLLINATIONS_STT_MODEL = "universal-3-pro";
