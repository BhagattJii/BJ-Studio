"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { ChevronUp, SettingsIcon, UserRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useVault } from "@/hooks/use-vault";
import { clerkEnabled } from "@/lib/clerk";
import { vault } from "@/lib/local/vault";
import { toast } from "./toast";

function emailToHue(email: string): number {
  let hash = 0;
  for (const char of email) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function SidebarUserNav() {
  if (clerkEnabled) {
    return <ClerkUserNav />;
  }
  return <LocalUserNav />;
}

function NavShell({
  avatar,
  email,
  items,
}: {
  avatar: React.ReactNode;
  email: string;
  items: React.ReactNode;
}) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="h-8 px-2 rounded-lg bg-transparent text-sidebar-foreground/70 transition-colors duration-150 hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              data-testid="user-nav-button"
            >
              {avatar}
              <span className="truncate text-[13px]" data-testid="user-email">
                {email}
              </span>
              <ChevronUp className="ml-auto size-3.5 text-sidebar-foreground/50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-popper-anchor-width) rounded-lg border border-border/60 bg-card/95 backdrop-blur-xl shadow-[var(--shadow-float)]"
            data-testid="user-nav-menu"
            side="top"
          >
            {items}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function ClerkUserNav() {
  const router = useRouter();
  const clerk = useClerk();
  const { user } = useUser();
  const { setTheme, resolvedTheme } = useTheme();

  const handleThemeSelect = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  if (!user) {
    return null;
  }

  const email =
    user.primaryEmailAddress?.emailAddress ?? user.username ?? "User";

  return (
    <NavShell
      avatar={
        user.imageUrl ? (
          <img
            alt={user.fullName ?? email}
            className="size-5 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border/50"
            src={user.imageUrl}
          />
        ) : (
          <div
            className="grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-medium text-white ring-1 ring-sidebar-border/50"
            style={{
              background: `linear-gradient(135deg, oklch(0.35 0.08 ${emailToHue(email)}), oklch(0.25 0.05 ${emailToHue(email) + 40}))`,
            }}
          >
            <UserRoundIcon className="size-3" />
          </div>
        )
      }
      email={email}
      items={
        <>
          <DropdownMenuItem
            className="cursor-pointer text-[13px]"
            onSelect={handleThemeSelect}
          >
            {`Toggle ${resolvedTheme === "light" ? "dark" : "light"} mode`}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-[13px]"
            onSelect={() => router.push("/settings")}
          >
            <SettingsIcon className="mr-2 size-3.5" />
            Settings & API keys
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-[13px]"
            onSelect={() => clerk.openUserProfile()}
          >
            <UserRoundIcon className="mr-2 size-3.5" />
            Manage account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-[13px]"
            onSelect={() => {
              vault.lock();
              router.replace("/");
              router.refresh();
            }}
          >
            Lock vault
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-[13px] text-destructive"
            onSelect={async () => {
              await vault.signOut().catch(() => undefined);
              await clerk.signOut({ redirectUrl: "/" });
              toast({ description: "Signed out", type: "success" });
              router.replace("/");
            }}
          >
            Sign out
          </DropdownMenuItem>
        </>
      }
    />
  );
}

function LocalUserNav() {
  const router = useRouter();
  const { user } = useVault();
  const { setTheme, resolvedTheme } = useTheme();

  const handleThemeSelect = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  if (!user) {
    return null;
  }

  return (
    <NavShell
      avatar={
        <div
          className="size-5 shrink-0 rounded-full ring-1 ring-sidebar-border/50"
          style={{
            background: `linear-gradient(135deg, oklch(0.35 0.08 ${emailToHue(user.email)}), oklch(0.25 0.05 ${emailToHue(user.email) + 40}))`,
          }}
        />
      }
      email={user.email}
      items={
        <>
          <DropdownMenuItem
            className="cursor-pointer text-[13px]"
            data-testid="user-nav-item-theme"
            onSelect={handleThemeSelect}
          >
            {`Toggle ${resolvedTheme === "light" ? "dark" : "light"} mode`}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-[13px]"
            onSelect={() => router.push("/settings")}
          >
            <SettingsIcon className="mr-2 size-3.5" />
            Settings & API keys
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild data-testid="user-nav-item-auth">
            <button
              className="w-full cursor-pointer text-[13px]"
              onClick={() => {
                vault.lock();
                router.replace("/");
                router.refresh();
              }}
              type="button"
            >
              Lock vault
            </button>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <button
              className="w-full cursor-pointer text-[13px] text-destructive"
              onClick={() => {
                vault.signOut().catch(() => undefined);
                toast({ description: "Signed out", type: "success" });
                router.replace("/");
                router.refresh();
              }}
              type="button"
            >
              Sign out
            </button>
          </DropdownMenuItem>
        </>
      }
    />
  );
}
