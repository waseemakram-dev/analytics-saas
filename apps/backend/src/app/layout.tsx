import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics Intelligence SaaS",
  description: "Modern analytics intelligence platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
