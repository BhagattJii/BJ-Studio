"use client";

import type { UIMessage } from "ai";
import { generateChatTitle } from "@/lib/local/ai";
import { vault } from "@/lib/local/vault";

export function saveChatModelAsCookie(model: string) {
  document.cookie = `chat-model=${encodeURIComponent(model)}; path=/; max-age=31536000; samesite=lax`;
}

export async function generateTitleFromUserMessage({
  message,
  modelId,
}: {
  message: UIMessage;
  modelId?: string;
}) {
  return generateChatTitle({ message, modelId });
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  vault.deleteTrailingMessages(id);
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  vault.setChatVisibility(chatId, visibility);
}
