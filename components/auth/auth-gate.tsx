"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { ShieldCheckIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { VaultGate } from "@/components/vault/vault-gate";
import { clerkEnabled } from "@/lib/clerk";
import { vault } from "@/lib/local/vault";

export function AuthGate({ children }: { children: ReactNode }) {
  if (!clerkEnabled) {
    return <VaultGate>{children}</VaultGate>;
  }
  return <ClerkSessionGate>{children}</ClerkSessionGate>;
}

function ClerkSessionGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const hadSession = useRef(false);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (isSignedIn) {
      hadSession.current = true;
      return;
    }
    if (hadSession.current) {
      hadSession.current = false;
      vault.signOut().catch(() => undefined);
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <Center>
        <span className="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        <p className="text-[13px] text-muted-foreground">Session check...</p>
      </Center>
    );
  }

  if (!isSignedIn) {
    return <SignInPanel />;
  }

  return <VaultGate driveOnly>{children}</VaultGate>;
}

function SignInPanel() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <div className="flex items-center gap-2.5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheckIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-[16px] font-semibold">BJ Studio</h1>
          <p className="text-[12px] text-muted-foreground">
            Secure login, powered by Clerk
          </p>
        </div>
      </div>
      <SignIn
        appearance={{ variables: { borderRadius: "0.9rem" } }}
        routing="hash"
      />
      <p className="max-w-xs text-center text-[11px] leading-relaxed text-muted-foreground">
        Login ke baad Google Drive connect hoga. Aapke chats end-to-end
        encrypted rahenge.
      </p>
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-4">
      {children}
    </div>
  );
}
