"use client";

import type { Suggestion } from "@/lib/db/schema";
import { vault } from "@/lib/local/vault";

export async function getSuggestions({ documentId }: { documentId: string }) {
  const rows = vault.getSuggestions(documentId).map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt),
    documentCreatedAt: new Date(row.documentCreatedAt),
  }));
  return rows as unknown as Suggestion[];
}
