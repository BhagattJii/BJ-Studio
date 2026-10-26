import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthGate } from "@/components/auth/auth-gate";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-dvh bg-background px-4 py-10">
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </div>
      <Toaster position="top-center" theme="system" />
    </AuthGate>
  );
}
