import type { ProviderId } from "@/lib/local/types";

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const DEFAULT_CHAT_MODEL = "openai/gpt-4.1-mini";

export const providerLabels: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  google: "Google",
  openai: "OpenAI",
  openrouter: "OpenRouter",
};

export const providerKeyUrls: Record<ProviderId, string> = {
  anthropic: "https://console.anthropic.com/settings/keys",
  google: "https://aistudio.google.com/apikey",
  openai: "https://platform.openai.com/api-keys",
  openrouter: "https://openrouter.ai/keys",
};

export const chatModels: ChatModel[] = [
  {
    description: "OpenAI flagship general model",
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
  },
  {
    description: "Fast, cheap OpenAI model for everyday chat",
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 mini",
    provider: "openai",
  },
  {
    description: "Vision model for images and text",
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
  },
  {
    description: "Reasoning model, slower but sharper",
    id: "openai/o4-mini",
    name: "o4-mini",
    provider: "openai",
    reasoningEffort: "medium",
  },
  {
    description: "Anthropic flagship for long chats and code",
    id: "anthropic/claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
  },
  {
    description: "Deepest Anthropic reasoning model",
    id: "anthropic/claude-opus-4-1",
    name: "Claude Opus 4.1",
    provider: "anthropic",
  },
  {
    description: "Fast Anthropic model",
    id: "anthropic/claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
  },
  {
    description: "Google flagship multimodal model",
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
  },
  {
    description: "Fast Google model with huge context",
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
  },
  {
    description: "Free open-source model via OpenRouter",
    id: "openrouter/openai/gpt-oss-20b:free",
    name: "GPT-OSS 20B (free)",
    provider: "openrouter",
  },
  {
    description: "Free DeepSeek chat model via OpenRouter",
    id: "openrouter/deepseek/deepseek-chat-v3.1:free",
    name: "DeepSeek V3.1 (free)",
    provider: "openrouter",
  },
  {
    description: "Claude via OpenRouter",
    id: "openrouter/anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5 (OR)",
    provider: "openrouter",
  },
];

export const modelCapabilities: Record<string, ModelCapabilities> = Object.fromEntries(
  chatModels.map((model) => [
    model.id,
    {
      reasoning: Boolean(model.reasoningEffort),
      tools: true,
      vision: true,
    },
  ])
);

export function getCapabilities(): Promise<Record<string, ModelCapabilities>> {
  return Promise.resolve(modelCapabilities);
}

export function parseModelId(modelId: string): {
  provider: ProviderId;
  model: string;
} {
  const slash = modelId.indexOf("/");
  if (slash === -1) {
    return { model: modelId, provider: "openai" };
  }
  const provider = modelId.slice(0, slash) as ProviderId;
  return { model: modelId.slice(slash + 1), provider };
}

export function getModelLabel(modelId: string): string {
  const known = chatModels.find((model) => model.id === modelId);
  return known?.name ?? modelId;
}
