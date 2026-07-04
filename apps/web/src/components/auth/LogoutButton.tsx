"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@kakoa/ui";
import { useToast } from "@kakoa/ui/client";
import { useAuth } from "./AuthProvider";

export interface LogoutButtonProps {
  className?: string;
  children?: ReactNode;
}

/**
 * Logout control (auth-otp.md §5.3). Posts to `POST /api/auth/logout`
 * (idempotent — always 200, clears the cookie), refreshes the auth context,
 * and routes home. Never fails visibly per spec; a network blip still clears
 * local state and navigates so the customer is not stuck "signed in".
 */
export function LogoutButton({
  className,
  children,
}: LogoutButtonProps): ReactNode {
  const router = useRouter();
  const { toast } = useToast();
  const { refresh } = useAuth();
  const [pending, setPending] = useState(false);

  const handleLogout = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Logout must never fail visibly — swallow and continue.
    } finally {
      await refresh();
      toast({ kind: "info", message: "You've been signed out." });
      router.replace("/");
      router.refresh();
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={pending}
      className={cx(
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60",
        className,
      )}
    >
      {children ?? (pending ? "Signing out…" : "Log out")}
    </button>
  );
}
