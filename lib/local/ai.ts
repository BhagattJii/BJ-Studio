import {
  convertToModelMessages,
  generateText,
  streamText,
  type UIMessage,
} from "ai";
import {
  DEFAULT_CHAT_MODEL,
  modelCapabilities,
  parseModelId,
} from "@/lib/ai/models";
import { resolveLanguageModel } from "@/lib/ai/providers";
import {
  titlePrompt,
  systemPrompt,
  type RequestHints,
} from "@/lib/ai/prompts";
import { getTextFromMessage } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";
import { vault } from "./vault";

const hints: RequestHints = {
  city: "unknown",
  country: "unknown",
  latitude: "0",
  longitude: "0",
};

export async function createLocalChatResponse({
  body,
  signal,
}: {
  body: unknown;
  signal?: AbortSignal | null;
}): Promise<Response> {
  if (!vault.isReady()) {
    throw new Error("Vault unlock nahi hai");
  }

  const payload = (body ?? {}) as {
    id?: string;
    messages?: ChatMessage[];
    message?: ChatMessage;
    selectedChatModel?: string;
  };

  const chatId = payload.id;
  if (!chatId) {
    throw new Error("Chat id missing");
  }

  const messages: ChatMessage[] =
    payload.messages ?? (payload.message ? [payload.message] : []);

  if (messages.length === 0) {
    throw new Error("Koi message nahi mila");
  }

  vault.ensureChat(chatId);

  const modelId = payload.selectedChatModel ?? DEFAULT_CHAT_MODEL;
  const model = resolveLanguageModel(modelId);

  const result = streamText({
    abortSignal: signal ?? undefined,
    instructions: systemPrompt({ requestHints: hints, supportsTools: false }),
    messages: await convertToModelMessages(messages),
    model,
  });

  return result.toUIMessageStreamResponse();
}

export async function generateChatTitle({
  message,
  modelId,
}: {
  message: UIMessage;
  modelId?: string;
}): Promise<string> {
  const fallback = getTextFromMessage(message).trim().slice(0, 60) || "New Chat";

  const parsed = parseModelId(modelId ?? DEFAULT_CHAT_MODEL);
  if (!vault.getApiKey(parsed.provider)) {
    return fallback;
  }

  try {
    const { text } = await generateText({
      instructions: titlePrompt,
      model: resolveLanguageModel(modelId),
      prompt: getTextFromMessage(message),
    });
    const clean = text
      .replace(/^[#*"\s]+/, "")
      .replace(/["]+$/, "")
      .trim();
    return clean || fallback;
  } catch {
    return fallback;
  }
}

export function modelsPayload() {
  const keys = vault.getApiKeys();
  const enabled = new Set(keys.map((entry) => entry.provider));
  const capabilities = Object.fromEntries(
    Object.entries(modelCapabilities).map(([id, caps]) => {
      const provider = parseModelId(id).provider;
      return [id, { ...caps, available: enabled.has(provider) }];
    })
  );
  return { capabilities };
}
