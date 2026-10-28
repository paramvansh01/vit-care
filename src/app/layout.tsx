import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/shell/app-header";
import { StatusBar } from "@/components/shell/status-bar";
import { CallWatcher } from "@/components/call-watcher";
import { currentUser } from "@/lib/auth";
import { lanAddresses, servingOverLan } from "@/lib/network";

const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexCond = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-cond",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VIT-Care",
  description:
    "Telemedicine, e-prescription, pharmacy and attendance condonation for VIT students, on one normalized SQLite database.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const lan = lanAddresses()[0] ?? null;

  return (
    <html lang="en">
      <body
        className={`${plex.variable} ${plexMono.variable} ${plexCond.variable} ${fraunces.variable} antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <AppHeader
            user={user ? { name: user.display_name, role: user.role, username: user.username } : null}
            lan={lan}
            secureLan={servingOverLan()}
          />
          <main className="min-w-0 flex-1">{children}</main>
          <StatusBar userName={user?.display_name ?? null} />
        </div>
        {user && <CallWatcher />}
      </body>
    </html>
  );
}
