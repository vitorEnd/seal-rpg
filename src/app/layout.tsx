import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const siteDescription =
  "Arquivo privado da Operação Neptune — uma campanha militar e tática de RPG ambientada no Afeganistão em 2018.";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "Operação Neptune · RPG Vitin",
    template: "%s · RPG Vitin",
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    title: "Operação Neptune · RPG Vitin",
    description: siteDescription,
    images: [
      {
        url: "/og.png",
        width: 1672,
        height: 941,
        alt: "Operação Neptune — Arquivo privado de campanha",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Operação Neptune · RPG Vitin",
    description: siteDescription,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
