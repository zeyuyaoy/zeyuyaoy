import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Peter's basement",
  description: "What are you doing here?",
  robots: { index: false },
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
