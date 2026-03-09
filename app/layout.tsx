import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "experimentime",
  description: "creative tools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[var(--background)] text-[var(--foreground)] transition-colors duration-200">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur sticky top-0 z-50">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 text-xs tracking-[0.18em] text-[var(--text-muted)]">
              <Link href="/" className="font-medium text-[var(--foreground)] hover:text-zinc-500">
                experimentime
              </Link>
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto max-w-5xl flex-1 px-6 pb-10 pt-10 sm:pt-14">
            {children}
          </main>
          <footer className="border-t border-[var(--border)] bg-[var(--header-bg)]">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <a
                href="https://hourbrahim.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-zinc-400 hover:text-zinc-500"
              >
                made by hourbrahim
              </a>
              <a
                href="https://www.instagram.com/hourbrahimm/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-900 transition-colors"
                aria-label="Instagram"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
