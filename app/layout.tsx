import type { Metadata, Viewport } from 'next';
import './globals.css'; // Global styles

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export const metadata: Metadata = {
  title: 'DELSM Ground Ops Turnaround Checklists Control',
  description: 'Mobile-responsive aviation ground operations checklist, supervisor verification, and shift management system with Excel import and WhatsApp reports.',
  openGraph: {
    title: 'DELSM Ground Ops Turnaround Checklists Control',
    description: 'Mobile-responsive aviation ground operations checklist, supervisor verification, and shift management system with Excel import and WhatsApp reports.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DELSM Ground Ops Turnaround Checklists Control',
    description: 'Mobile-responsive aviation ground operations checklist, supervisor verification, and shift management system with Excel import and WhatsApp reports.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="bg-aviation-pattern min-h-screen text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
