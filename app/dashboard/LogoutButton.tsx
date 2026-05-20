"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } finally {
          router.replace("/dashboard/login");
          router.refresh();
        }
      }}
      className="dashboard-logout-button rounded-xl px-4 py-2 text-sm font-medium transition hover:brightness-95 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 hover:cursor-pointer"
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
