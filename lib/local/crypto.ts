const PBKDF2_ITERATIONS = 310_000;

export type EncryptedEnvelope = {
  iv: string;
  ct: string;
  salt: string;
  v: 1;
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function randomSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(
  passphrase: string,
  saltB64: string
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromBase64(saltB64) as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBytes(
  key: CryptoKey,
  data: Uint8Array,
  salt: string
): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    data as BufferSource
  );

  return {
    ct: toBase64(new Uint8Array(ct)),
    iv: toBase64(iv),
    salt,
    v: 1,
  };
}

export async function decryptBytes(
  key: CryptoKey,
  envelope: EncryptedEnvelope
): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(envelope.iv) as BufferSource },
    key,
    fromBase64(envelope.ct) as BufferSource
  );
  return new Uint8Array(plain);
}

export async function encryptJson(
  key: CryptoKey,
  value: unknown,
  salt: string
): Promise<EncryptedEnvelope> {
  return encryptBytes(
    key,
    new TextEncoder().encode(JSON.stringify(value)),
    salt
  );
}

export async function decryptJson<T>(
  key: CryptoKey,
  envelope: EncryptedEnvelope
): Promise<T> {
  const bytes = await decryptBytes(key, envelope);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export function isEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.v === 1 &&
    typeof candidate.iv === "string" &&
    typeof candidate.ct === "string" &&
    typeof candidate.salt === "string"
  );
}
