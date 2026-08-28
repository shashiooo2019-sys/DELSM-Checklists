'use client';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6">
      <h2 className="text-2xl font-bold">404 - Page Not Found</h2>
      <p className="text-slate-400 mt-2">Could not find requested resource.</p>
    </div>
  );
}
