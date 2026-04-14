import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Repo Runner',
  description: 'Drop a repo ZIP or paste a GitHub URL to run it instantly',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
