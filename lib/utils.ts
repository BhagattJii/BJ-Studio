import type { UIMessage, UIMessagePart } from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import { ChatbotError, type ErrorCode } from './errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from './types';

type LocalMessageLike = {
  id: string;
  role: string;
  parts: unknown;
  createdAt: string | Date;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const { localFetch } = await import('@/lib/local/api');
  const response = await localFetch(url);

  if (!response.ok) {
    const { code, cause } = (await response.json().catch(() => ({}))) as {
      code?: ErrorCode;
      cause?: string;
    };
    throw new ChatbotError(code ?? 'bad_request:api', cause);
  }

  return response.json();
};

export async function localFetchWithErrors(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const { localFetch } = await import('@/lib/local/api');
  try {
    const response = await localFetch(input, init);

    if (!response.ok) {
      const { code, cause } = (await response.json().catch(() => ({}))) as {
        code?: ErrorCode;
        cause?: string;
      };
      throw new ChatbotError(code ?? 'bad_request:api', cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatbotError('offline:chat');
    }

    throw error;
  }
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDocumentTimestampByIndex(
  documents: Array<{ createdAt: string | Date }>,
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return new Date(documents[index].createdAt);
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

export function convertToUIMessages(
  messages: LocalMessageLike[],
): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(new Date(message.createdAt)),
    },
  }));
}

export function getTextFromMessage(message: ChatMessage | UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { type: 'text'; text: string}).text)
    .join('');
}
