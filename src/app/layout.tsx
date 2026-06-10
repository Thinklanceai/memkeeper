import type { Metadata } from "next";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import Link from "next/link";
import { VaultProvider } from "@/lib/store/vault";
import { LocalOnlyBadge } from "@/components/ui";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "MemKeeper — own your AI memory",
  description:
    "Import your ChatGPT, Claude and Gemini exports. See what each AI knows about you — parsed entirely in your browser, nothing uploaded.",
  metadataBase: new URL("https://memkeeper.eu"),
  authors: [{ name: "ThinkLance AI", url: "https://thinklanceai.com" }],
};

const NAV = [
  { href: "/import", label: "Import" },
  { href: "/inventory", label: "Inventory" },
  { href: "/compare", label: "Compare" },
] as const;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <VaultProvider>
          <header className="border-b border-line bg-card">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <Link
                href="/"
                className="font-display text-lg font-bold tracking-tight text-lapis-deep"
              >
                MemKeeper
                <span className="ml-1.5 align-middle text-[0.625rem] font-semibold tracking-widest text-brass">
                  .EU
                </span>
              </Link>
              <nav className="flex gap-4 text-sm font-medium text-slate">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="hover:text-ink"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="ml-auto">
                <LocalOnlyBadge />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-5xl px-4 pb-8 pt-4 text-xs text-slate">
            Built in the EU · A{" "}
            <a
              href="https://thinklanceai.com"
              className="underline underline-offset-2 hover:text-ink"
            >
              ThinkLance AI
            </a>{" "}
            product · Engine:{" "}
            <a
              href="https://github.com/Thinklanceai/agentkeeper"
              className="underline underline-offset-2 hover:text-ink"
            >
              AgentKeeper
            </a>{" "}
            (MIT) · Your exports never leave this device.
          </footer>
        </VaultProvider>
      <Analytics />
      </body>
    </html>
  );
}
