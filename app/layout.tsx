import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Minhas finanças", description: "Controle financeiro pessoal" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
