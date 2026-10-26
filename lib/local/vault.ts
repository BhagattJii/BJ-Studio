import {
  decryptJson,
  deriveKey,
  encryptJson,
  isEnvelope,
  randomSalt,
  type EncryptedEnvelope,
} from "./crypto";
import {
  deleteAllAppDataFiles,
  readVaultEnvelope,
  writeVaultEnvelope,
} from "./drive";
import {
  connectGoogle,
  currentGoogleSession,
  disconnectGoogle,
  ensureGoogleToken,
  getClientId,
} from "./google";
import {
  emptyVault,
  type LocalChat,
  type LocalDocument,
  type LocalMessageRow,
  type LocalStoredFile,
  type LocalSuggestion,
  type LocalUser,
  type LocalVote,
  type ProviderKey,
  type SyncState,
  type VaultData,
  type VaultSnapshot,
  type VaultStatus,
} from "./types";

const IDB_NAME = "bjstudio-vault";
const IDB_STORE = "kv";
const REMEMBER_KEY = "remembered-key";
const PROFILE_KEY = "profile";

type KvRecord = { id: string; value: unknown };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(id: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const request = tx.objectStore(IDB_STORE).get(id);
      request.onsuccess = () => resolve((request.result as KvRecord)?.value as T ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(id: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put({ id, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore quota failures, Drive is the source of truth
  }
}

async function idbDelete(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

type Listener = () => void;

class VaultStore {
  private data: VaultData | null = null;
  private key: CryptoKey | null = null;
  private salt: string | null = null;
  private listeners = new Set<Listener>();
  private snapshot: VaultSnapshot = {
    error: null,
    hasRemoteVault: false,
    status: "booting",
    sync: "idle",
    user: null,
    version: 0,
  };
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private savingPromise: Promise<void> | null = null;
  private storeRevision = 0;
  private booted = false;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): VaultSnapshot => this.snapshot;

  private emit(patch: Partial<VaultSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch, version: this.snapshot.version + 1 };
    for (const listener of this.listeners) {
      listener();
    }
  }

  getData(): VaultData | null {
    return this.data;
  }

  getUser(): LocalUser | null {
    return this.snapshot.user;
  }

  isReady(): boolean {
    return this.snapshot.status === "unlocked" && this.data !== null;
  }

  async boot() {
    if (this.booted) {
      return;
    }
    this.booted = true;
    try {
      const remembered = await idbGet<{ key: CryptoKey; salt: string; email: string }>(
        REMEMBER_KEY
      );
      const profile = await idbGet<LocalUser>(PROFILE_KEY);
      if (remembered && profile) {
        this.key = remembered.key;
        this.salt = remembered.salt;
        this.emit({ status: "connecting", user: profile });
        const driveVault = await readVaultEnvelope().catch(() => null);
        let envelope: EncryptedEnvelope | null = null;
        if (driveVault) {
          const parsed = safeParse(driveVault);
          if (isEnvelope(parsed)) {
            envelope = parsed;
          }
        }
        if (!envelope) {
          envelope = await idbGet<EncryptedEnvelope>("vault-cache");
        }
        if (envelope) {
          try {
            const data = await decryptJson<VaultData>(remembered.key, envelope);
            this.data = data;
            this.salt = envelope.salt;
            this.emit({ status: "unlocked", hasRemoteVault: Boolean(driveVault), sync: "saved" });
            this.scheduleSave();
            return;
          } catch {
            this.key = null;
            this.salt = null;
            await idbDelete(REMEMBER_KEY);
          }
        }
        this.emit({ status: "signed-out", user: null });
        return;
      }
      const profileOnly = await idbGet<LocalUser>(PROFILE_KEY);
      this.emit({
        status: profileOnly ? "locked" : "signed-out",
        user: profileOnly ?? null,
      });
    } catch (error) {
      this.emit({
        error: error instanceof Error ? error.message : "Boot fail",
        status: "signed-out",
      });
    }
  }

  async signIn(): Promise<void> {
    const clientId = getClientId();
    if (!clientId) {
      throw new Error("Pehle Google Client ID set karo");
    }
    this.emit({ error: null, status: "connecting" });
    try {
      const session = await connectGoogle({ interactive: true });

      const user: LocalUser = {
        email: session.email,
        name: session.name,
        picture: session.picture,
      };
      await idbSet(PROFILE_KEY, user);

      const remote = await readVaultEnvelope().catch((error) => {
        throw error instanceof Error
          ? error
          : new Error("Drive connect nahi hua");
      });

      if (remote) {
        const parsed = safeParse(remote);
        if (!isEnvelope(parsed)) {
          throw new Error("Drive me vault file corrupt hai");
        }
        this.salt = parsed.salt;
        this.emit({ hasRemoteVault: true, status: "locked", user });
        return;
      }

      this.emit({ hasRemoteVault: false, status: "needs-passphrase", user });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign-in fail";
      this.emit({ error: message, status: "signed-out", user: null });
      throw error;
    }
  }

  async unlock(passphrase: string, remember = true): Promise<void> {
    if (!this.snapshot.user) {
      throw new Error("Pehle Google se connect karo");
    }
    const remote = await readVaultEnvelope().catch(() => null);
    let envelope: EncryptedEnvelope | null = null;
    if (remote) {
      const parsed = safeParse(remote);
      if (isEnvelope(parsed)) {
        envelope = parsed;
      }
    }
    if (!envelope) {
      envelope = await idbGet<EncryptedEnvelope>("vault-cache");
    }
    if (!envelope) {
      throw new Error("Vault nahi mila — naya bana rahe hain");
    }
    const key = await deriveKey(passphrase, envelope.salt);
    let data: VaultData;
    try {
      data = await decryptJson<VaultData>(key, envelope);
    } catch {
      throw new Error("Galat passphrase");
    }
    if (data.ownerEmail && data.ownerEmail !== this.snapshot.user.email) {
      throw new Error("Ye vault kisi aur account ka hai");
    }
    this.data = data;
    this.key = key;
    this.salt = envelope.salt;
    if (remember) {
      await idbSet(REMEMBER_KEY, {
        email: data.ownerEmail,
        key,
        salt: envelope.salt,
      });
    }
    this.emit({
      error: null,
      hasRemoteVault: Boolean(remote),
      status: "unlocked",
      sync: "saved",
    });
    await this.persistNow();
  }

  async createVault(passphrase: string, remember = true): Promise<void> {
    if (!this.snapshot.user) {
      throw new Error("Pehle Google se connect karo");
    }
    if (passphrase.trim().length < 8) {
      throw new Error("Passphrase kam se kam 8 characters ka hona chahiye");
    }
    const salt = randomSalt();
    const key = await deriveKey(passphrase, salt);
    const data = emptyVault(this.snapshot.user.email);

    this.data = data;
    this.key = key;
    this.salt = salt;
    if (remember) {
      await idbSet(REMEMBER_KEY, { email: data.ownerEmail, key, salt });
    }
    this.emit({ error: null, status: "unlocked", sync: "saving" });
    await this.persistNow();
    this.emit({ hasRemoteVault: true, sync: "saved" });
  }

  async reconnectDrive(): Promise<void> {
    await connectGoogle({ interactive: true });
    this.emit({ error: null });
    await this.persistNow();
  }

  lock() {
    this.key = null;
    this.data = null;
    this.salt = null;
    this.emit({
      status: this.snapshot.user ? "locked" : "signed-out",
      sync: "idle",
    });
  }

  async signOut() {
    this.lock();
    await idbDelete(PROFILE_KEY);
    await idbDelete(REMEMBER_KEY);
    disconnectGoogle();
    this.emit({ status: "signed-out", user: null });
  }

  async forgetDevice() {
    await idbDelete(REMEMBER_KEY);
  }

  async changePassphrase(next: string): Promise<void> {
    if (!(this.data && this.key)) {
      throw new Error("Vault unlock nahi hai");
    }
    if (next.trim().length < 8) {
      throw new Error("Passphrase kam se kam 8 characters ka hona chahiye");
    }
    const salt = randomSalt();
    const key = await deriveKey(next, salt);
    this.key = key;
    this.salt = salt;
    if (this.snapshot.user) {
      await idbSet(REMEMBER_KEY, {
        email: this.snapshot.user.email,
        key,
        salt,
      });
    }
    await this.persistNow();
  }

  private scheduleSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.persistNow().catch(() => undefined);
    }, 700);
  }

  private async persistNow(): Promise<void> {
    if (!(this.data && this.key && this.salt)) {
      return;
    }
    const revision = ++this.storeRevision;
    this.emit({ sync: "saving" });
    try {
      const envelope = await encryptJson(this.key, this.data, this.salt);
      await idbSet("vault-cache", envelope);
      if (currentGoogleSession() || this.snapshot.hasRemoteVault) {
        try {
          await ensureGoogleToken();
          await writeVaultEnvelope(JSON.stringify(envelope));
        } catch {
          this.emit({ sync: "offline" });
          return;
        }
      }
      if (revision === this.storeRevision) {
        this.emit({ sync: "saved" });
      }
    } catch (error) {
      this.emit({
        error: error instanceof Error ? error.message : "Save fail",
        sync: "error",
      });
    }
  }

  private touch() {
    this.scheduleSave();
  }

  getApiKeys(): ProviderKey[] {
    return this.data?.apiKeys ?? [];
  }

  getApiKey(provider: string): ProviderKey | undefined {
    return this.data?.apiKeys.find((item) => item.provider === provider);
  }

  setApiKey(entry: ProviderKey) {
    if (!this.data) {
      throw new Error("Vault locked hai");
    }
    const rest = this.data.apiKeys.filter(
      (item) => item.provider !== entry.provider
    );
    this.data.apiKeys = [...rest, entry];
    this.touch();
  }

  removeApiKey(provider: string) {
    if (!this.data) {
      return;
    }
    this.data.apiKeys = this.data.apiKeys.filter(
      (item) => item.provider !== provider
    );
    this.touch();
  }

  private requireData(): VaultData {
    if (!this.data) {
      throw new Error("Vault locked hai");
    }
    return this.data;
  }

  ensureChat(chatId: string): LocalChat {
    const data = this.requireData();
    const existing = data.chats.find((chat) => chat.id === chatId);
    if (existing) {
      return existing;
    }
    const userId = data.ownerEmail;
    const now = new Date().toISOString();
    const chat: LocalChat = {
      createdAt: now,
      id: chatId,
      title: "New Chat",
      updatedAt: now,
      userId,
      visibility: "private",
    };
    data.chats.unshift(chat);
    this.touch();
    return chat;
  }

  getChat(chatId: string): LocalChat | null {
    return this.data?.chats.find((chat) => chat.id === chatId) ?? null;
  }

  getChatsPage({
    endingBefore,
    limit,
    startingAfter,
  }: {
    limit: number;
    endingBefore?: string | null;
    startingAfter?: string | null;
  }): { chats: LocalChat[]; hasMore: boolean } {
    const data = this.requireData();
    const sorted = [...data.chats].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
    let startIndex = 0;
    if (startingAfter) {
      const index = sorted.findIndex((chat) => chat.id === startingAfter);
      startIndex = index >= 0 ? index + 1 : 0;
    } else if (endingBefore) {
      const index = sorted.findIndex((chat) => chat.id === endingBefore);
      startIndex = index >= 0 ? index + 1 : 0;
    }
    const slice = sorted.slice(startIndex, startIndex + limit + 1);
    return {
      chats: slice.slice(0, limit),
      hasMore: slice.length > limit,
    };
  }

  deleteChat(chatId: string) {
    const data = this.requireData();
    data.chats = data.chats.filter((chat) => chat.id !== chatId);
    data.messages = data.messages.filter((msg) => msg.chatId !== chatId);
    data.votes = data.votes.filter((vote) => vote.chatId !== chatId);
    this.touch();
  }

  deleteAllChats() {
    const data = this.requireData();
    data.chats = [];
    data.messages = [];
    data.votes = [];
    this.touch();
  }

  setChatVisibility(chatId: string, visibility: "private" | "public") {
    const chat = this.ensureChat(chatId);
    chat.visibility = visibility;
    this.touch();
  }

  setChatTitle(chatId: string, title: string) {
    const chat = this.ensureChat(chatId);
    if (!title.trim()) {
      return;
    }
    chat.title = title.slice(0, 120);
    chat.updatedAt = new Date().toISOString();
    this.touch();
  }

  getMessages(chatId: string): LocalMessageRow[] {
    return (this.data?.messages ?? [])
      .filter((msg) => msg.chatId === chatId)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  replaceMessages(chatId: string, rows: LocalMessageRow[]) {
    const data = this.requireData();
    data.messages = data.messages.filter((msg) => msg.chatId !== chatId);
    data.messages.push(...rows);
    const chat = data.chats.find((item) => item.id === chatId);
    if (chat) {
      chat.updatedAt = new Date().toISOString();
    }
    this.touch();
  }

  deleteTrailingMessages(messageId: string) {
    const data = this.requireData();
    const target = data.messages.find((message) => message.id === messageId);
    if (!target) {
      return;
    }
    data.messages = data.messages.filter(
      (message) =>
        message.chatId !== target.chatId ||
        Date.parse(message.createdAt) <= Date.parse(target.createdAt)
    );
    this.touch();
  }

  getVotes(chatId: string): LocalVote[] {
    return (this.data?.votes ?? []).filter((vote) => vote.chatId === chatId);
  }

  setVote({
    chatId,
    isUpvoted,
    messageId,
  }: {
    chatId: string;
    messageId: string;
    isUpvoted: boolean;
  }) {
    const data = this.requireData();
    data.votes = data.votes.filter(
      (vote) => !(vote.chatId === chatId && vote.messageId === messageId)
    );
    data.votes.push({ chatId, isUpvoted, messageId });
    this.touch();
  }

  getDocumentsById(id: string): LocalDocument[] {
    return (this.data?.documents ?? [])
      .filter((doc) => doc.id === id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  saveDocument(doc: Omit<LocalDocument, "createdAt" | "userId"> & {
    createdAt?: string;
    userId?: string;
  }): LocalDocument {
    const data = this.requireData();
    const row: LocalDocument = {
      ...doc,
      createdAt: doc.createdAt ?? new Date().toISOString(),
      userId: data.ownerEmail,
    };
    data.documents.push(row);
    this.touch();
    return row;
  }

  updateDocumentContent(id: string, content: string): LocalDocument | null {
    const documents = this.getDocumentsById(id);
    const latest = documents[0];
    if (!latest) {
      return null;
    }
    latest.content = content;
    this.touch();
    return latest;
  }

  deleteDocumentsByIdAfterTimestamp(id: string, timestamp: string) {
    const data = this.requireData();
    data.documents = data.documents.filter(
      (doc) => doc.id !== id || Date.parse(doc.createdAt) <= Date.parse(timestamp)
    );
    this.touch();
  }

  getSuggestions(documentId: string): LocalSuggestion[] {
    return (this.data?.suggestions ?? []).filter(
      (item) => item.documentId === documentId
    );
  }

  addSuggestions(rows: LocalSuggestion[]) {
    const data = this.requireData();
    const ids = new Set(rows.map((row) => row.id));
    data.suggestions = [
      ...data.suggestions.filter((row) => !ids.has(row.id)),
      ...rows,
    ];
    this.touch();
  }

  saveFile(file: Omit<LocalStoredFile, "createdAt">): LocalStoredFile {
    const data = this.requireData();
    const row: LocalStoredFile = {
      ...file,
      createdAt: new Date().toISOString(),
    };
    data.files.push(row);
    this.touch();
    return row;
  }

  getFile(id: string): LocalStoredFile | null {
    return this.data?.files.find((file) => file.id === id) ?? null;
  }

  async exportEncrypted(): Promise<string> {
    if (!(this.data && this.key && this.salt)) {
      throw new Error("Vault unlock nahi hai");
    }
    const envelope = await encryptJson(this.key, this.data, this.salt);
    return JSON.stringify(envelope);
  }

  async importEncrypted(raw: string, passphrase: string): Promise<void> {
    const parsed = safeParse(raw);
    if (!isEnvelope(parsed)) {
      throw new Error("File encrypted vault format me nahi hai");
    }
    const key = await deriveKey(passphrase, parsed.salt);
    let data: VaultData;
    try {
      data = await decryptJson<VaultData>(key, parsed);
    } catch {
      throw new Error("Galat passphrase ya corrupt file");
    }
    if (this.snapshot.user && data.ownerEmail !== this.snapshot.user.email) {
      throw new Error("Ye vault kisi aur account ka hai");
    }
    this.data = data;
    this.key = key;
    this.salt = parsed.salt;
    if (this.snapshot.user) {
      await idbSet(REMEMBER_KEY, {
        email: this.snapshot.user.email,
        key,
        salt: parsed.salt,
      });
    }
    this.emit({ error: null, status: "unlocked", sync: "saving" });
    await this.persistNow();
  }

  async wipeEverything(): Promise<void> {
    await deleteAllAppDataFiles().catch(() => undefined);
    await idbDelete("vault-cache");
    await idbDelete(REMEMBER_KEY);
    this.data = null;
    this.key = null;
    this.salt = null;
    this.emit({ hasRemoteVault: false, status: "signed-out", user: null });
  }

  async retrySync() {
    await this.persistNow();
  }
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export const vault = new VaultStore();
