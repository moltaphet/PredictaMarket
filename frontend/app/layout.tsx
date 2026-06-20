import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Predicta — AI-Resolved Prediction Markets",
  description:
    "Create and trade on real-world events, resolved autonomously by a consensus-safe GenLayer LLM flow. No single oracle, deterministic on-chain settlement.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen font-sans antialiased" style={{ fontFamily: "var(--font-inter)" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
