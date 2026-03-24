"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { BotProvider } from "@/lib/bot/context";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <BotProvider>{children}</BotProvider>
    </AuthProvider>
  );
}
