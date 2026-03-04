import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "experimentime",
  description: "Creative tools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-zinc-950`}
      >
        <div className="min-h-screen bg-white flex flex-col">
          <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 text-xs uppercase tracking-[0.18em] text-zinc-600">
              <a href="/" className="font-medium text-zinc-900 hover:text-zinc-500">
                experimentime
              </a>
            </div>
          </header>
          <main className="mx-auto max-w-5xl flex-1 px-6 pb-10 pt-10 sm:pt-14">
            {children}
          </main>
          <footer className="border-t border-zinc-200/80 bg-white/80">
            <div className="mx-auto flex max-w-5xl items-center justify-start px-6 py-4">
              <a
                href="https://hourbrahim.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-zinc-400 hover:text-zinc-500"
              >
                made by hourbrahim
              </a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
