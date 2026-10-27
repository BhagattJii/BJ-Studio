# Contributing to BJ Studio

Thanks for taking the time to contribute. BJ Studio is a client-only AI chat app — **your key, your Drive, your data** — and every change should preserve that promise.

## Reporting bugs

Open a bug report using the template. Include the provider, browser/OS and the browser console output (with any API key or passphrase removed).

## Local setup

```bash
pnpm install
cp .env.example .env.local
# fill NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
pnpm dev
```

For a production check:

```bash
pnpm build
```

> On Android/Termux use `pnpm build` (webpack) — Turbopack has no native Android bindings.

## Before you open a pull request

1. `pnpm build` passes (this also runs the TypeScript check).
2. `pnpm fix` formats the changed files (Ultracite / Biome).
3. One logical change per PR — split unrelated refactors out.
4. Fill in the PR template, including how you verified the change.

## Rules that are not negotiable

- **Never commit secrets.** No API keys, Clerk secret keys, OAuth client secrets or `.env.local`.
- **Never log or transmit the encryption passphrase, derived keys, vault contents or API keys.** All encryption stays in the browser (AES-256-GCM, PBKDF2-SHA256) and the passphrase must never leave the device.
- **No analytics, trackers or third-party scripts.**
- Keep the app free of a server-side data store. If a feature needs persistence, use the user's own Drive appDataFolder.
- Prefer dependency-light solutions; every package is a supply-chain and bundle-size cost.

## Commit messages

Short, imperative subject lines:

```
fix: derive vault key with PBKDF2 iterations from salt
feat: add OpenRouter provider to the model picker
chore: bump next to 16.2.10
```

## License

By contributing you agree that your contributions are licensed under the Apache-2.0 license of this repository.
