const AUTHORIZE_BASE = "https://enter.pollinations.ai/authorize";

const API_KEY_PREFIXES = ["sk_", "pk_", "sk-", "pk-"] as const;

export const POLLINATIONS_AUTH_STATE_KEY = "pollinations_auth_state";
export const POLLINATIONS_USER_KEY_STORAGE_KEY = "pollinations_user_key";

export function isPollinationsApiKey(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return API_KEY_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function maskPollinationsApiKey(value: string | null | undefined): string | null {
  if (!isPollinationsApiKey(value)) return null;
  const trimmed = value!.trim();
  if (trimmed.length <= 10) return trimmed;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function buildPollinationsAuthorizeUrl({
  appKey,
  redirectUri,
  state,
  scope,
  models,
  budget,
  expiry,
}: {
  appKey: string;
  redirectUri: string;
  state: string;
  scope?: string[];
  models?: string[];
  budget?: number;
  expiry?: number;
}): string {
  const url = new URL(AUTHORIZE_BASE);
  url.searchParams.set("client_id", appKey);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  if (scope?.length) {
    url.searchParams.set("scope", scope.join(" "));
  }

  if (models?.length) {
    url.searchParams.set("models", models.join(","));
  }

  if (typeof budget === "number" && Number.isFinite(budget)) {
    url.searchParams.set("budget", String(budget));
  }

  if (typeof expiry === "number" && Number.isFinite(expiry)) {
    url.searchParams.set("expiry", String(expiry));
  }

  return url.toString();
}

export function parsePollinationsAuthorizeHash(hash: string): {
  apiKey: string | null;
  state: string | null;
} {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(normalizedHash);
  return {
    apiKey: params.get("api_key"),
    state: params.get("state"),
  };
}
