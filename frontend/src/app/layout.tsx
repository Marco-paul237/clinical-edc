import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import AppLayoutClient from './AppLayoutClient';

export const metadata: Metadata = {
  title: 'Secure Clinical Trial Portal | EDC System',
  description: 'A containerized, cloud-IAM protected Electronic Data Capture portal for secure clinical trial management and compliance auditing.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body>
        <AuthProvider>
          <AppLayoutClient>{children}</AppLayoutClient>
        </AuthProvider>
      </body>
    </html>
  );
}
