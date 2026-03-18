import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NYC Housing Court Case Intake',
  description: 'Automated case intake and defense analysis for NYC Housing Court proceedings',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
