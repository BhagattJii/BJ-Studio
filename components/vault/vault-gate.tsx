"use client";

import { LockKeyholeIcon, ShieldCheckIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useVault } from "@/hooks/use-vault";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClientId, setClientId } from "@/lib/local/google";
import { vault } from "@/lib/local/vault";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-float)]">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheckIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold">BJ Studio</h1>
            <p className="text-[12px] text-muted-foreground">
              Aapka data, aapke Google Drive me — end-to-end encrypted
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
      <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      {label}
    </div>
  );
}

function ErrorBox({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
      {message}
    </p>
  );
}

function ClientIdSetup({ onSave }: { onSave: () => void }) {
  const [value, setValue] = useState(getClientId() ?? "");

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setClientId(value);
        onSave();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="google-client-id">Google OAuth Client ID</Label>
        <Input
          id="google-client-id"
          onChange={(event) => setValue(event.target.value)}
          placeholder="xxxxx.apps.googleusercontent.com"
          value={value}
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Google Cloud Console → APIs & Services → Credentials → OAuth client
          (Web) banayein, phir Drive API enable karein. Authorized origin me
          apna app URL daalein.
        </p>
      </div>
      <Button className="w-full" type="submit">
        Save Client ID
      </Button>
    </form>
  );
}

export function VaultGate({ children }: { children: ReactNode }) {
  const snapshot = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsClientId, setNeedsClientId] = useState(false);

  useEffect(() => {
    vault.boot().catch(() => undefined);
    setNeedsClientId(!getClientId());
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setPassphrase("");
      setConfirm("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kuch galat hua");
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = () =>
    run(async () => {
      if (!getClientId()) {
        setNeedsClientId(true);
        throw new Error("Pehle Google Client ID daalo");
      }
      await vault.signIn();
    });

  const handleUnlock = (event: FormEvent) => {
    event.preventDefault();
    run(async () => {
      await vault.unlock(passphrase, remember);
    });
  };

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    if (passphrase !== confirm) {
      setError("Dono passphrase match nahi kar rahe");
      return;
    }
    run(async () => {
      await vault.createVault(passphrase, remember);
    });
  };

  if (snapshot.status === "unlocked") {
    return <>{children}</>;
  }

  if (snapshot.status === "booting" || snapshot.status === "connecting") {
    return (
      <Shell>
        <Spinner
          label={
            snapshot.status === "booting"
              ? "Vault check ho raha hai..."
              : "Google Drive connect ho raha hai..."
          }
        />
      </Shell>
    );
  }

  if (snapshot.status === "signed-out") {
    if (needsClientId) {
      return (
        <Shell>
          <ClientIdSetup onSave={() => setNeedsClientId(false)} />
        </Shell>
      );
    }

    return (
      <Shell>
        <div className="space-y-4">
          <div className="rounded-xl bg-muted/50 p-3 text-[12px] leading-relaxed text-muted-foreground">
            Login = Google. Aapke chats aapke hi Google Drive (app folder) me
            save honge, AES-256 encrypted. Hamare paas na database hai, na
            aapka data.
          </div>
          <Button
            className="w-full"
            disabled={busy}
            onClick={handleSignIn}
            type="button"
          >
            <GoogleIcon />
            Continue with Google
          </Button>
          <ErrorBox message={error ?? snapshot.error} />
          <button
            className="w-full text-center text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setNeedsClientId(true)}
            type="button"
          >
            Client ID change karna hai?
          </button>
        </div>
      </Shell>
    );
  }

  if (snapshot.status === "locked") {
    return (
      <Shell>
        <form className="space-y-3" onSubmit={handleUnlock}>
          <p className="text-[12px] text-muted-foreground">
            Connected: <strong>{snapshot.user?.email}</strong>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="passphrase">Passphrase</Label>
            <Input
              autoFocus
              id="passphrase"
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Apna passphrase daalo"
              type="password"
              value={passphrase}
            />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <input
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              type="checkbox"
            />
            Is device pe yaad rakho
          </label>
          <Button className="w-full" disabled={busy || passphrase.length < 1}>
            <LockKeyholeIcon className="mr-1 size-4" />
            Unlock vault
          </Button>
          <ErrorBox message={error ?? snapshot.error} />
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => run(() => vault.reconnectDrive())}
            type="button"
            variant="outline"
          >
            Google Drive reconnect karo
          </Button>
          <button
            className="w-full text-center text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => run(() => vault.signOut())}
            type="button"
          >
            Doosre Google account se sign in karo
          </button>
        </form>
      </Shell>
    );
  }

  if (snapshot.status === "needs-passphrase") {
    return (
      <Shell>
        <form className="space-y-3" onSubmit={handleCreate}>
          <div className="rounded-xl bg-muted/50 p-3 text-[12px] leading-relaxed text-muted-foreground">
            Naya vault banega <strong>{snapshot.user?.email}</strong> ke Drive
            me. Ye passphrase hi aapki encryption key hai — sirf aapko pata
            hogi, hum ise save nahi karte. <strong>Ise yaad rakhein</strong>,
            bhool gaye to data recover nahi hoga.
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-passphrase">Naya passphrase</Label>
            <Input
              autoFocus
              id="new-passphrase"
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Kam se kam 8 characters"
              type="password"
              value={passphrase}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-passphrase">Confirm passphrase</Label>
            <Input
              id="confirm-passphrase"
              onChange={(event) => setConfirm(event.target.value)}
              type="password"
              value={confirm}
            />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <input
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              type="checkbox"
            />
            Is device pe yaad rakho
          </label>
          <Button
            className="w-full"
            disabled={busy || passphrase.length < 8}
            type="submit"
          >
            Create encrypted vault
          </Button>
          <ErrorBox message={error ?? snapshot.error} />
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <ErrorBox message={snapshot.error ?? "Kuch galat hua"} />
      <Button
        className="mt-4 w-full"
        onClick={() => window.location.reload()}
        type="button"
      >
        Retry
      </Button>
    </Shell>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}
