import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { MobileBar, Sidebar } from "@/components/Sidebar";
import { SearchDialog } from "@/components/SearchDialog";
import { WatchlistProvider } from "@/components/Watchlist";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "FortAnalytic – Fortnite island analytics", template: "%s · FortAnalytic" },
  description: "Live player counts, charts, genres and trends for every Fortnite Creative and UEFN island.",
};

// Applied before paint so the saved theme never flashes.
const themeScript = `try{var t=localStorage.getItem("fortanalytic.theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <WatchlistProvider>
          <div className="flex min-h-dvh">
            <Sidebar />
            <div className="min-w-0 flex-1">
              <MobileBar />
              <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-7">{children}</main>
            </div>
          </div>
          <SearchDialog />
        </WatchlistProvider>
      </body>
    </html>
  );
}
