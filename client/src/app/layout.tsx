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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-surface text-gray-100 antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
