import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proofwork — Algorithm Analysis & Comparison",
  description: "Scoped equivalence proofs, shared-input testing, rigorous complexity derivations, and controlled algorithm benchmarks in Python, C++, and Java.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0e13",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
