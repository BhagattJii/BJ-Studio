"use client";

import { ArrowLeftIcon, DownloadIcon, KeyRoundIcon, TrashIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, useState } from "react";
import { toast } from "@/components/chat/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVault } from "@/hooks/use-vault";
import {
  providerKeyUrls,
  providerLabels,
} from "@/lib/ai/models";
import type { ProviderId } from "@/lib/local/types";
import { vault } from "@/lib/local/vault";

const providers: ProviderId[] = ["openai", "anthropic", "google", "openrouter"];

export default function SettingsPage() {
  const snapshot = useVault();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [baseUrl, setBaseUrl] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [importText, setImportText] = useState<string | null>(null);
  const [importPass, setImportPass] = useState("");

  const data = vault.getData();
  const savedKeys = vault.getApiKeys();

  const saveKey = (provider: ProviderId) => {
    const value = (keys[provider] ?? "").trim();
    if (!value) {
      toast({ description: "Key khaali hai", type: "error" });
      return;
    }
    vault.setApiKey({
      apiKey: value,
      baseURL: provider === "openai" && baseUrl.trim() ? baseUrl.trim() : undefined,
      provider,
    });
    setKeys((current) => ({ ...current, [provider]: "" }));
    toast({ description: `${providerLabels[provider]} key saved`, type: "success" });
  };

  const exportVault = async () => {
    const raw = await vault.exportEncrypted();
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bj-studio-vault-${new Date().toISOString().slice(0, 10)}.enc.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    file
      .text()
      .then((text) => setImportText(text))
      .catch(() => toast({ description: "File padhi nahi ja saki", type: "error" }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild size="icon-sm" variant="ghost">
          <Link href="/">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-[16px] font-semibold">Settings</h1>
          <p className="text-[12px] text-muted-foreground">
            {snapshot.user?.email} · {snapshot.sync === "offline" ? "Drive offline" : snapshot.sync}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <KeyRoundIcon className="size-4 text-muted-foreground" />
          <h2 className="text-[14px] font-semibold">AI API keys (BYOK)</h2>
        </div>
        <p className="mb-4 text-[12px] leading-relaxed text-muted-foreground">
          Aapki key, aapki bill. Key encrypted vault ke andar save hoti hai.
          Sirf aapke chats ke liye use hoti hai — humse koi relation nahi.
        </p>
        <div className="space-y-4">
          {providers.map((provider) => {
            const saved = savedKeys.find((entry) => entry.provider === provider);
            return (
              <div key={provider} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`key-${provider}`}>
                    {providerLabels[provider]}
                    {saved ? " ✓" : ""}
                  </Label>
                  <a
                    className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                    href={providerKeyUrls[provider]}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Get key
                  </a>
                </div>
                <div className="flex gap-2">
                  <Input
                    id={`key-${provider}`}
                    onChange={(event) =>
                      setKeys((current) => ({
                        ...current,
                        [provider]: event.target.value,
                      }))
                    }
                    placeholder={saved ? "•••••••• saved — replace karne ke liye nayi daalo" : "sk-..."}
                    type="password"
                    value={keys[provider] ?? ""}
                  />
                  <Button onClick={() => saveKey(provider)} type="button">
                    Save
                  </Button>
                  {saved ? (
                    <Button
                      onClick={() => {
                        vault.removeApiKey(provider);
                        toast({ description: "Key removed", type: "success" });
                      }}
                      type="button"
                      variant="outline"
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                {provider === "openai" ? (
                  <Input
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="Custom base URL (optional, OpenAI-compatible)"
                    value={baseUrl}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="mb-2 text-[14px] font-semibold">Passphrase change</h2>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Poora vault naye passphrase se dobara encrypt ho jayega.
        </p>
        <div className="flex gap-2">
          <Input
            onChange={(event) => setNewPassphrase(event.target.value)}
            placeholder="Naya passphrase (8+ chars)"
            type="password"
            value={newPassphrase}
          />
          <Button
            onClick={() => {
              vault
                .changePassphrase(newPassphrase)
                .then(() => {
                  setNewPassphrase("");
                  toast({ description: "Passphrase updated", type: "success" });
                })
                .catch((error: unknown) =>
                  toast({
                    description: error instanceof Error ? error.message : "Fail",
                    type: "error",
                  })
                );
            }}
            type="button"
          >
            Update
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="mb-2 text-[14px] font-semibold">Backup</h2>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Encrypted vault file download karo, ya kisi doosre vault file se
          restore karo (uska passphrase lagega).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportVault} type="button" variant="outline">
            <DownloadIcon className="mr-1 size-4" /> Export encrypted
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-[13px] hover:bg-accent">
            <UploadIcon className="size-4" /> Import file
            <input
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
              type="file"
            />
          </label>
          {data ? (
            <span className="self-center text-[11px] text-muted-foreground">
              {data.chats.length} chats · {data.messages.length} messages
            </span>
          ) : null}
        </div>
        {importText ? (
          <div className="mt-3 flex gap-2">
            <Input
              onChange={(event) => setImportPass(event.target.value)}
              placeholder="Uss file ka passphrase"
              type="password"
              value={importPass}
            />
            <Button
              onClick={() => {
                vault
                  .importEncrypted(importText, importPass)
                  .then(() => {
                    setImportText(null);
                    setImportPass("");
                    toast({ description: "Vault restored", type: "success" });
                  })
                  .catch((error: unknown) =>
                    toast({
                      description:
                        error instanceof Error ? error.message : "Import fail",
                      type: "error",
                    })
                  );
              }}
              type="button"
            >
              Restore
            </Button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
        <h2 className="mb-2 text-[14px] font-semibold text-destructive">Danger zone</h2>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Google Drive ka saara BJ Studio data aur is device ka cache delete ho
          jayega. Wapas nahi aayega.
        </p>
        <Button
          onClick={() => {
            if (
              window.confirm(
                "Pakka? Saara chat history, documents aur keys delete ho jayenge."
              )
            ) {
              vault
                .wipeEverything()
                .then(() => toast({ description: "Sab delete ho gaya", type: "success" }))
                .catch(() => toast({ description: "Delete fail", type: "error" }));
            }
          }}
          type="button"
          variant="destructive"
        >
          <TrashIcon className="mr-1 size-4" /> Delete everything
        </Button>
      </section>
    </div>
  );
}
