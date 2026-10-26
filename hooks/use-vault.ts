"use client";

import { useSyncExternalStore } from "react";
import { vault } from "@/lib/local/vault";

export function useVault() {
  return useSyncExternalStore(
    vault.subscribe,
    vault.getSnapshot,
    vault.getSnapshot
  );
}
