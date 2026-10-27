# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| `main` | Yes |
| Older commits | No |

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private reporting flow instead:

https://github.com/BhagattJii/BJ-Studio/security/advisories/new

Please include the affected version/commit, reproduction steps and the impact. You can expect an acknowledgement within 72 hours and a fix or mitigation plan within 14 days.

## Threat model in one paragraph

BJ Studio runs entirely in the browser. Your API key and your encryption passphrase are provided by you and are stored only in your encrypted vault (or, for the passphrase, in memory). Chats and attachments are stored in your own Google Drive. The project server — if you self-host the static build — only serves files and never receives vault plaintext. Vulnerabilities of interest are therefore: leakage of passphrase or API key, plaintext vault data leaving the browser, broken encryption (AES-256-GCM / PBKDF2-SHA256 parameters), authentication bypass via Clerk, and OAuth scope escalation via Google Drive permissions.

## What to report

- Plaintext vault data or passphrases reaching the network, logs or storage
- API keys leaking into logs, analytics or third-party requests
- Weak or predictable key derivation (salt, iterations, IV/nonce reuse)
- OAuth permission requests broader than `appdata` scope
- Cross-user data access in the Drive sync layer
- XSS or dependency vulnerabilities that expose vault contents
