import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chalk — The Board That Draws Itself",
  description: "A live teaching board that turns explanations into diagrams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
