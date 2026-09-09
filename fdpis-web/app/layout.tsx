import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FDPIS — Flight Delay Propagation Intelligence System",
  description:
    "Predict how a single flight delay cascades through an airline's rotation network, and act before it does.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
