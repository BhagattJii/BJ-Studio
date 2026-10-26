import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { DEFAULT_CHAT_MODEL, parseModelId } from "@/lib/ai/models";
import { vault } from "@/lib/local/vault";

export function resolveLanguageModel(modelId?: string | null): LanguageModel {
  const selected = modelId && modelId.trim().length > 0 ? modelId : DEFAULT_CHAT_MODEL;
  const { provider, model } = parseModelId(selected);
  const entry = vault.getApiKey(provider);

  if (!entry || entry.apiKey.trim().length === 0) {
    throw new Error(
      `"${provider}" ki API key nahi mili. Settings me apni key daalo.`
    );
  }

  switch (provider) {
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: entry.apiKey,
        headers: {
          "anthropic-dangerous-direct-browser-access": "true",
        },
      });
      return anthropic(model);
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey: entry.apiKey });
      return google(model);
    }
    case "openrouter": {
      const openrouter = createOpenRouter({ apiKey: entry.apiKey });
      return openrouter(model);
    }
    case "openai":
    default: {
      const openai = createOpenAI({
        apiKey: entry.apiKey,
        baseURL: entry.baseURL?.trim() || undefined,
      });
      return openai(model);
    }
  }
}

export function hasAnyProviderKey(): boolean {
  return vault.getApiKeys().some((entry) => entry.apiKey.trim().length > 0);
}

export function firstConfiguredModelId(): string | null {
  const keys = vault.getApiKeys();
  if (keys.length === 0) {
    return null;
  }
  const first = keys[0]?.provider;
  const match = [
    "openai/gpt-4.1-mini",
    "anthropic/claude-sonnet-4-5",
    "google/gemini-2.5-flash",
    "openrouter/openai/gpt-oss-20b:free",
  ].find((id) => id.startsWith(`${first}/`));
  return match ?? null;
}
