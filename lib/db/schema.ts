export type User = {
  id: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  isAnonymous: boolean;
  name: string | null;
  password: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Chat = {
  id: string;
  createdAt: Date;
  title: string;
  userId: string;
  visibility: "private" | "public";
};

export type DBMessage = {
  id: string;
  chatId: string;
  role: string;
  parts: unknown;
  attachments: unknown;
  createdAt: Date;
};

export type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};

export type Document = {
  id: string;
  title: string;
  kind: "text" | "code" | "image" | "sheet";
  content: string | null;
  createdAt: Date;
  userId: string;
};

export type Suggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: Date;
  originalText: string;
  suggestedText: string;
  description: string | null;
  isResolved: boolean;
  userId: string;
  createdAt: Date;
};

export type Stream = {
  id: string;
  chatId: string;
  createdAt: Date;
};
