# BJ Studio

**Live:** https://bjstudioai.vercel.app

Open-source AI chat app — **your key, your Drive, your data.**

Built on top of Vercel's Chatbot template (Apache-2.0), stripped of every server-side dependency:

- **No database.** Chats, documents and votes live in **your own Google Drive** (hidden `appDataFolder`).
- **No AI Gateway.** You bring your own API key (BYOK): OpenAI, Anthropic, Google Gemini or OpenRouter.
- **No accounts on our side.** Sign in with Google — that same OAuth connection gives the app access to a private app folder in *your* Drive.
- **End-to-end encrypted.** Everything is encrypted in the browser with a passphrase only you know (AES-256-GCM, PBKDF2-SHA256). The passphrase never leaves your device, and neither does any plaintext.

The app itself is just static files. There is no backend to run, no data to leak, and no bill to pay.

## Features

- Streaming chat UI (AI SDK), markdown, reasoning display, dark/light mode
- Model picker: OpenAI, Anthropic, Google Gemini and OpenRouter (free models included)
- Multiple chats with auto-generated titles, per-chat history stored in your Drive
- File attachments (images) sent to vision models and stored encrypted
- Passphrase lock/unlock, "remember this device", lock & sign out
- Encrypted vault export / import (backup) and full wipe
- Optional custom OpenAI-compatible base URL (any proxy / local server)

## How it works

```
Google OAuth (login)
        │
        ▼
Passphrase ──PBKDF2──► AES-256-GCM key (memory only)
        │
        ▼
Vault JSON ──encrypt──► Google Drive appDataFolder   (bjstudio.vault.enc)
        │
        └──encrypt──► IndexedDB local cache (offline + fast boot)

Your API key ──► provider (OpenAI/Anthropic/Google/OpenRouter) directly from the browser
```

- On first run you create a passphrase and a new encrypted vault is written to your Drive.
- On every other device: sign in with the same Google account, enter the passphrase, done.
- If Drive is temporarily unreachable the app keeps working locally and syncs later.

## Setup (5 minutes)

### 1. Google Cloud

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services → Library → Google Drive API** → Enable.
3. **APIs & Services → OAuth consent screen** → External → fill the basics (add yourself as a test user if the app stays in testing).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` and your deployed URL (e.g. `https://bj-studio.vercel.app`).
5. Copy the **Client ID** (it is public — safe to commit in env).

### 2. Run locally

```bash
pnpm install
cp .env.example .env.local     # paste NEXT_PUBLIC_GOOGLE_CLIENT_ID
pnpm dev                       # http://localhost:3000
```

No env var? The app will ask for the Client ID on the login screen and store it in your browser.

> Note: on Android/Termux use `pnpm build` (webpack) — Turbopack has no native Android bindings.

### 3. Deploy

- **Vercel:** import the repo → add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` → deploy. No other services needed.
- Any static host that supports Next.js output works (Cloudflare Pages via OpenNext, Netlify, self-hosted Node).

### 4. Add your AI key

Open **Settings → AI API keys** and paste a key for at least one provider. Keys are stored encrypted inside your vault and sent only to that provider. Bring your own bill — we never see it.

## Limitations (honest list)

- If you forget the passphrase, **the data is unrecoverable** (that's the point of E2EE). Export backups regularly from Settings.
- Free Google Drive storage quota applies to your attachments (15 GB normally).
- You need a Google account. GitHub/Gist sync is not implemented (yet).
- Artifact tools (document/code/sheet side panel) are not wired in the client-only build — UI is present, generation tools are disabled.
- Some providers restrict browser (CORS) calls. OpenAI, Anthropic (browser flag), Google AI and OpenRouter work.
- Rate limits and abuse protection are the provider's responsibility (it's your key).

## Tech

Next.js 16 (App Router) · React 19 · AI SDK 7 · Tailwind CSS 4 · shadcn/ui · Google Identity Services · Web Crypto · Dexie-free IndexedDB · SWR

## Credits & license

UI and app structure derived from [Vercel's Chatbot template](https://github.com/vercel/chatbot) (Apache-2.0). Client-only storage/encryption/BYOK layer by BhagattJii. Licensed under Apache-2.0 — see [LICENSE](./LICENSE).
