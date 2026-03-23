import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "AXIOM — AI Crypto Intelligence",
  description:
    "Dashboard intelligent qui analyse le marché crypto et aide à la décision grâce à l'IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
