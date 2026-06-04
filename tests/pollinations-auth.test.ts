import { describe, expect, it } from "vitest";
import {
  buildPollinationsAuthorizeUrl,
  isPollinationsApiKey,
  maskPollinationsApiKey,
  parsePollinationsAuthorizeHash,
} from "@/lib/pollinations-auth";

describe("pollinations auth helpers", () => {
  it("accepts current Pollinations key prefixes", () => {
    expect(isPollinationsApiKey("sk_123456")).toBe(true);
    expect(isPollinationsApiKey("pk_123456")).toBe(true);
    expect(isPollinationsApiKey("sk-legacy")).toBe(true);
    expect(isPollinationsApiKey("nope")).toBe(false);
  });

  it("masks keys safely", () => {
    expect(maskPollinationsApiKey("sk_1234567890")).toBe("sk_1...7890");
    expect(maskPollinationsApiKey("bad")).toBeNull();
  });

  it("builds the authorize url with client id and redirect uri", () => {
    const url = new URL(
      buildPollinationsAuthorizeUrl({
        appKey: "pk_app_123",
        redirectUri: "https://subcap.example/studio",
        state: "abc123",
        expiry: 7,
      })
    );

    expect(url.origin + url.pathname).toBe("https://enter.pollinations.ai/authorize");
    expect(url.searchParams.get("client_id")).toBe("pk_app_123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://subcap.example/studio");
    expect(url.searchParams.get("state")).toBe("abc123");
    expect(url.searchParams.get("expiry")).toBe("7");
  });

  it("parses the returned authorize hash", () => {
    expect(parsePollinationsAuthorizeHash("#api_key=sk_user_123&state=abc123")).toEqual({
      apiKey: "sk_user_123",
      state: "abc123",
    });
  });
});
