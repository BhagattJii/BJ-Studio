import { ensureGoogleToken } from "./google";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

export const VAULT_FILE_NAME = "bjstudio.vault.enc";

type DriveFile = {
  id: string;
  name: string;
  modifiedTime?: string;
};

async function driveFetch(
  url: string,
  init?: RequestInit,
  retried = false
): Promise<Response> {
  const token = await ensureGoogleToken();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });

  if (response.status === 401 && !retried) {
    return driveFetch(url, init, true);
  }
  return response;
}

export async function findFile(name: string): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    q: `name = '${name.replace(/'/g, "\\'")}' and trashed = false`,
    spaces: "appDataFolder",
    fields: "files(id,name,modifiedTime)",
  });
  const response = await driveFetch(`${DRIVE_FILES_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Drive list fail (${response.status})`);
  }
  const data = (await response.json()) as { files?: DriveFile[] };
  return data.files?.[0] ?? null;
}

export async function readFile(fileId: string): Promise<string> {
  const url = `${DRIVE_FILES_URL}/${fileId}?alt=media&spaces=appDataFolder`;
  const response = await driveFetch(url);
  if (!response.ok) {
    throw new Error(`Drive read fail (${response.status})`);
  }
  return response.text();
}

export async function writeFile({
  content,
  fileId,
  mimeType = "application/vnd.bjstudio.encrypted+json",
  name,
}: {
  content: BlobPart;
  name: string;
  fileId?: string | null;
  mimeType?: string;
}): Promise<string> {
  const boundary = `bjstudio-${crypto.randomUUID()}`;
  const metadata = fileId
    ? JSON.stringify({ name })
    : JSON.stringify({ name, parents: ["appDataFolder"] });

  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    content,
    `\r\n--${boundary}--`,
  ]);

  const url = new URL(DRIVE_UPLOAD_URL);
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("fields", "id");
  if (fileId) {
    url.searchParams.set("fileId", fileId);
  }

  const response = await driveFetch(url.toString(), {
    body,
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    method: fileId ? "PATCH" : "POST",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Drive write fail (${response.status}) ${detail}`);
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

export async function deleteFile(fileId: string): Promise<void> {
  const response = await driveFetch(`${DRIVE_FILES_URL}/${fileId}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Drive delete fail (${response.status})`);
  }
}

export async function listAppDataFiles(): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    fields: "files(id,name,modifiedTime)",
    pageSize: "1000",
  });
  const response = await driveFetch(`${DRIVE_FILES_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Drive list fail (${response.status})`);
  }
  const data = (await response.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

export async function readVaultEnvelope(): Promise<string | null> {
  const file = await findFile(VAULT_FILE_NAME);
  if (!file) {
    return null;
  }
  return readFile(file.id);
}

export async function writeVaultEnvelope(content: string): Promise<void> {
  const existing = await findFile(VAULT_FILE_NAME);
  await writeFile({
    content,
    fileId: existing?.id ?? null,
    name: VAULT_FILE_NAME,
  });
}

export async function readEncryptedBlob(
  name: string
): Promise<string | null> {
  const file = await findFile(name);
  if (!file) {
    return null;
  }
  return readFile(file.id);
}

export async function writeEncryptedBlob(
  name: string,
  content: string
): Promise<void> {
  const existing = await findFile(name);
  await writeFile({ content, fileId: existing?.id ?? null, name });
}

export async function deleteAllAppDataFiles(): Promise<void> {
  const files = await listAppDataFiles();
  await Promise.all(files.map((file) => deleteFile(file.id).catch(() => undefined)));
}
