export type ProviderId = "openai" | "anthropic" | "google" | "openrouter";

export type ProviderKey = {
  provider: ProviderId;
  apiKey: string;
  baseURL?: string;
};

export type LocalChat = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  visibility: "private" | "public";
};

export type LocalMessageRow = {
  id: string;
  chatId: string;
  role: string;
  parts: unknown[];
  attachments: unknown[];
  createdAt: string;
};

export type LocalVote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};

export type LocalDocument = {
  id: string;
  title: string;
  kind: "text" | "code" | "image" | "sheet";
  content: string;
  createdAt: string;
  userId: string;
};

export type LocalSuggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: string;
  originalText: string;
  suggestedText: string;
  description: string | null;
  isResolved: boolean;
  userId: string;
  createdAt: string;
};

export type LocalStoredFile = {
  id: string;
  name: string;
  contentType: string;
  dataUrl: string;
  createdAt: string;
};

export type VaultData = {
  version: 1;
  ownerEmail: string;
  createdAt: string;
  chats: LocalChat[];
  messages: LocalMessageRow[];
  votes: LocalVote[];
  documents: LocalDocument[];
  suggestions: LocalSuggestion[];
  files: LocalStoredFile[];
  apiKeys: ProviderKey[];
};

export function emptyVault(ownerEmail: string): VaultData {
  return {
    apiKeys: [],
    chats: [],
    createdAt: new Date().toISOString(),
    documents: [],
    files: [],
    messages: [],
    ownerEmail,
    suggestions: [],
    version: 1,
    votes: [],
  };
}

export type LocalUser = {
  email: string;
  name?: string;
  picture?: string;
};

export type VaultStatus =
  | "booting"
  | "signed-out"
  | "connecting"
  | "locked"
  | "needs-passphrase"
  | "unlocked"
  | "error";

export type SyncState = "idle" | "saving" | "saved" | "offline" | "error";

export type VaultSnapshot = {
  status: VaultStatus;
  user: LocalUser | null;
  sync: SyncState;
  hasRemoteVault: boolean;
  error: string | null;
  version: number;
};
