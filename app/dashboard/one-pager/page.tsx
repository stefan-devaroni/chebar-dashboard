import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { getSessionInfo } from '@/lib/roles';
import { ShareLinks } from '@/components/share-links';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'One Pager', robots: { index: false, follow: false } };

// The business summary for prospective buyers (Oct 2026), owners only. The document comes from
// /api/one-pager; opened as a full page, its Print / save as PDF button prints just the summary.
// Below it, owners make private links for buyers (components/share-links.tsx, /view/<token>).
export default async function OnePagerPage() {
  const session = await getSessionInfo().catch(() => null);
  if (!session?.owner) redirect('/dashboard');

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">One Pager</h1>
          <p className="text-sm text-neutral-500 mt-1">The business summary for a prospective buyer. Only owners can see this page.</p>
        </div>
        <a
          href="/api/one-pager"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream"
        >
          <ExternalLink className="w-4 h-4" />
          Open full page
        </a>
      </header>
      <iframe
        src="/api/one-pager"
        title="Che Bar business summary"
        className="w-full h-[75vh] rounded-xl border border-neutral-200 bg-white"
      />
      <ShareLinks />
    </div>
  );
}
