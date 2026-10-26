import { convertToUIMessages } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";
import type {
  LocalDocument,
  LocalMessageRow,
  LocalSuggestion,
} from "./types";
import { vault } from "./vault";

async function readJson(init?: RequestInit): Promise<unknown> {
  const body = init?.body;
  if (!body) {
    return {};
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return {};
}

function jsonError(code: string, cause: string, status = 400): Response {
  return Response.json({ cause, code }, { status });
}

function messageRowFromUI(chatId: string, message: ChatMessage): LocalMessageRow {
  return {
    attachments: [],
    chatId,
    createdAt:
      (message.metadata as { createdAt?: string } | undefined)?.createdAt ??
      new Date().toISOString(),
    id: message.id,
    parts: message.parts as unknown[],
    role: message.role,
  };
}

export function saveChatMessages({
  chatId,
  messages,
}: {
  chatId: string;
  messages: ChatMessage[];
}) {
  vault.ensureChat(chatId);
  vault.replaceMessages(
    chatId,
    messages.map((message) => messageRowFromUI(chatId, message))
  );
}

function docsToJson(documents: LocalDocument[]) {
  return documents.map((doc) => ({ ...doc }));
}

export async function localFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url =
    typeof input === "string" || input instanceof URL
      ? new URL(input.toString(), window.location.origin)
      : new URL(input.url, window.location.origin);

  const method = (init?.method ?? "GET").toUpperCase();
  const path = url.pathname.replace(/^\/demo/, "");

  try {
    if (path === "/api/models" && method === "GET") {
      const { modelsPayload } = await import("./ai");
      return Response.json(modelsPayload());
    }

    if (path === "/api/messages" && method === "GET") {
      const chatId = url.searchParams.get("chatId");
      if (!chatId) {
        return jsonError("bad_request:api", "chatId required");
      }
      const chat = vault.getChat(chatId);
      const messages = vault.getMessages(chatId);
      return Response.json({
        isReadonly: false,
        messages: convertToUIMessages(
          messages.map((message) => ({
            ...message,
            chatId,
          })) as never
        ),
        userId: chat?.userId ?? vault.getUser()?.email ?? null,
        visibility: chat?.visibility ?? "private",
      });
    }

    if (path === "/api/history" && method === "GET") {
      const limit = Math.min(
        Math.max(Number.parseInt(url.searchParams.get("limit") || "10", 10), 1),
        50
      );
      const page = vault.getChatsPage({
        endingBefore: url.searchParams.get("ending_before"),
        limit,
        startingAfter: url.searchParams.get("starting_after"),
      });
      return Response.json(page);
    }

    if (path === "/api/history" && method === "DELETE") {
      vault.deleteAllChats();
      return Response.json({ deleted: true });
    }

    if (path === "/api/history" && method === "POST") {
      const body = (await readJson(init)) as {
        chatId?: string;
        visibility?: "private" | "public";
      };
      if (!body?.chatId) {
        return jsonError("bad_request:api", "chatId required");
      }
      vault.setChatVisibility(body.chatId, body.visibility ?? "private");
      return Response.json({ ok: true });
    }

    if (path === "/api/chat" && method === "DELETE") {
      const chatId = url.searchParams.get("id");
      if (chatId) {
        vault.deleteChat(chatId);
      }
      return Response.json({ deleted: true });
    }

    if (path === "/api/vote" && method === "GET") {
      const chatId = url.searchParams.get("chatId");
      if (!chatId) {
        return jsonError("bad_request:api", "chatId required");
      }
      return Response.json(vault.getVotes(chatId));
    }

    if (path === "/api/vote" && method === "PATCH") {
      const body = (await readJson(init)) as {
        chatId?: string;
        messageId?: string;
        type?: "up" | "down";
      };
      if (!(body?.chatId && body.messageId && body.type)) {
        return jsonError("bad_request:api", "vote parameters missing");
      }
      vault.setVote({
        chatId: body.chatId,
        isUpvoted: body.type === "up",
        messageId: body.messageId,
      });
      return new Response("Message voted", { status: 200 });
    }

    if (path === "/api/document" && method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) {
        return jsonError("bad_request:api", "id required");
      }
      return Response.json(docsToJson(vault.getDocumentsById(id)));
    }

    if (path === "/api/document" && method === "POST") {
      const id = url.searchParams.get("id");
      if (!id) {
        return jsonError("bad_request:api", "id required");
      }
      const body = (await readJson(init)) as {
        content?: string;
        title?: string;
        kind?: "text" | "code" | "image" | "sheet";
        isManualEdit?: boolean;
      };
      const existing = vault.getDocumentsById(id);
      if (body?.isManualEdit && existing.length > 0) {
        const updated = vault.updateDocumentContent(id, body.content ?? "");
        return Response.json(updated);
      }
      const doc = vault.saveDocument({
        content: body?.content ?? "",
        id,
        kind: body?.kind ?? "text",
        title: body?.title ?? "Untitled",
      });
      return Response.json(doc);
    }

    if (path === "/api/document" && method === "DELETE") {
      const id = url.searchParams.get("id");
      const timestamp = url.searchParams.get("timestamp");
      if (!(id && timestamp)) {
        return jsonError("bad_request:api", "id and timestamp required");
      }
      vault.deleteDocumentsByIdAfterTimestamp(id, timestamp);
      return Response.json({ deleted: true });
    }

    if (path === "/api/suggestions" && method === "GET") {
      const documentId = url.searchParams.get("documentId");
      if (!documentId) {
        return jsonError("bad_request:api", "documentId required");
      }
      return Response.json(vault.getSuggestions(documentId));
    }

    if (path === "/api/files/upload" && method === "POST") {
      const formData = init?.body as FormData;
      const file = formData?.get("file");
      if (!(file instanceof File)) {
        return jsonError("bad_request:api", "file missing");
      }
      if (file.size > 5 * 1024 * 1024) {
        return jsonError("bad_request:api", "File 5MB se chhota hona chahiye");
      }
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        return jsonError("bad_request:api", "Sirf JPEG/PNG chalega");
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const stored = vault.saveFile({
        contentType: file.type,
        dataUrl,
        id: crypto.randomUUID(),
        name: file.name,
      });
      return Response.json({
        contentType: file.type,
        pathname: stored.name,
        url: stored.dataUrl,
      });
    }

    return jsonError("not_found:api", `Local route nahi mila: ${path}`, 404);
  } catch (error) {
    return jsonError(
      "bad_request:api",
      error instanceof Error ? error.message : "Local op fail",
      500
    );
  }
}

export function saveLocalSuggestions(rows: LocalSuggestion[]) {
  vault.addSuggestions(rows);
}
