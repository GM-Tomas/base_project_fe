import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WealthProvider } from '@/context/WealthContext';
import { AuthProvider } from '@/context/AuthContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BASE Wealth Dashboard — Your money, together',
  description: 'Track all your assets, platforms, liquidity, and wealth projection in one place.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        <AuthProvider>
          <WealthProvider>{children}</WealthProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
