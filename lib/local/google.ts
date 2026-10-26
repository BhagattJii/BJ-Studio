const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.appdata",
].join(" ");

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { message?: string }) => void;
      }) => TokenClient;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

export type GoogleSession = {
  accessToken: string;
  expiresAt: number;
  email: string;
  name?: string;
  picture?: string;
};

let scriptPromise: Promise<void> | null = null;
let cachedSession: GoogleSession | null = null;
let pendingResolve: ((response: TokenResponse) => void) | null = null;
let pendingReject: ((error: Error) => void) | null = null;
let tokenClient: TokenClient | null = null;
let tokenClientClientId: string | null = null;

export function getClientId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem("bjstudio.googleClientId");
  return stored && stored.trim().length > 0 ? stored.trim() : null;
}

export function setClientId(clientId: string) {
  if (typeof window === "undefined") {
    return;
  }
  const trimmed = clientId.trim();
  if (trimmed) {
    window.localStorage.setItem("bjstudio.googleClientId", trimmed);
  } else {
    window.localStorage.removeItem("bjstudio.googleClientId");
  }
  tokenClient = null;
  tokenClientClientId = null;
}

export function loadGis(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in browser me hi chalta hai"));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google script load nahi hua"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

function ensureTokenClient(clientId: string): TokenClient {
  if (tokenClient && tokenClientClientId === clientId) {
    return tokenClient;
  }
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google identity services ready nahi hain");
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (response) => {
      const resolve = pendingResolve;
      const reject = pendingReject;
      pendingResolve = null;
      pendingReject = null;
      if (response.error) {
        reject?.(
          new Error(response.error_description ?? response.error ?? "OAuth fail")
        );
        return;
      }
      resolve?.(response);
    },
    error_callback: (error) => {
      const reject = pendingReject;
      pendingResolve = null;
      pendingReject = null;
      reject?.(new Error(error.message ?? "OAuth popup band ho gaya"));
    },
  });
  tokenClientClientId = clientId;
  return tokenClient;
}

export async function fetchProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error("Google profile nahi mila");
  }
  return (await response.json()) as {
    email: string;
    name?: string;
    picture?: string;
  };
}

export async function connectGoogle({
  interactive = true,
}: { interactive?: boolean } = {}): Promise<GoogleSession> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("Google Client ID set nahi hai (Settings me daalo)");
  }

  await loadGis();
  const client = ensureTokenClient(clientId);

  const token = await new Promise<TokenResponse>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    client.requestAccessToken({ prompt: interactive ? "consent" : "" });
  });

  if (!token.access_token) {
    throw new Error("Access token nahi mila");
  }

  const profile = await fetchProfile(token.access_token);
  const session: GoogleSession = {
    accessToken: token.access_token,
    email: profile.email,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    name: profile.name,
    picture: profile.picture,
  };
  cachedSession = session;
  window.sessionStorage.setItem(
    "bjstudio.googleProfile",
    JSON.stringify({ email: profile.email, name: profile.name })
  );
  return session;
}

export async function ensureGoogleToken(): Promise<string> {
  if (cachedSession && cachedSession.expiresAt - 60_000 > Date.now()) {
    return cachedSession.accessToken;
  }
  try {
    const session = await connectGoogle({ interactive: false });
    return session.accessToken;
  } catch {
    const session = await connectGoogle({ interactive: true });
    return session.accessToken;
  }
}

export function currentGoogleSession(): GoogleSession | null {
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession;
  }
  return null;
}

export function disconnectGoogle() {
  cachedSession = null;
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem("bjstudio.googleProfile");
    const token = cachedSession as GoogleSession | null;
    if (token) {
      fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token.accessToken)}`,
        { method: "POST" }
      ).catch(() => undefined);
    }
  }
}
