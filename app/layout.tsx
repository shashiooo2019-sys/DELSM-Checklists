import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'DEL Ground Ops Turnaround Checklists Control',
  description: 'DEL Ground Ops Turnaround Checklists Control system.',
  openGraph: {
    title: 'DEL Ground Ops Turnaround Checklists Control',
    description: 'DEL Ground Ops Turnaround Checklists Control system.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DEL Ground Ops Turnaround Checklists Control',
    description: 'DEL Ground Ops Turnaround Checklists Control system.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
