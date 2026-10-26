import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { VaultGate } from "@/components/vault/vault-gate";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <VaultGate>
      <div className="min-h-dvh bg-background px-4 py-10">
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </div>
      <Toaster position="top-center" theme="system" />
    </VaultGate>
  );
}
