import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Müügiassistent",
  description: "Online töövahend kinnisvaraomanike kõnede, AI tagasiside ja järeltegevuste jaoks."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="et">
      <body>{children}</body>
    </html>
  );
}
