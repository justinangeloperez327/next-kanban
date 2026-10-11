import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next Kanban",
  description: "Collaborative real-time project canvas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
