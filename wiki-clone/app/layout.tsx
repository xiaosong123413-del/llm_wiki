/**
 * Root layout for the standalone Wikipedia-style wiki clone.
 */

import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "LLM Wiki",
  description: "A personal encyclopedia generated from local wiki notes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
