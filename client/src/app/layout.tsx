import type { Metadata } from 'next';
import NavBar from '@/components/NavBar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sherpa — AI Onboarding Agent',
  description: 'Upload your repo. Get an intelligent onboarding agent in minutes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
