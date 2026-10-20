import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { HandbookView } from '@/components/handbook-view';
import { CHAPTER_COLUMNS, SECTION_COLUMNS, type HandbookChapter, type HandbookSection } from '@/lib/handbook';
import { isMissingTable } from '@/lib/reservations-server';

export const dynamic = 'force-dynamic';

export default async function HandbookPage({ searchParams }: { searchParams: { s?: string } }) {
  const supabase = createClient();
  const [session, chapters, sections] = await Promise.all([
    getSessionInfo().catch(() => null),
    supabase.from('handbook_chapters').select(CHAPTER_COLUMNS).order('sort'),
    supabase.from('handbook_sections').select(SECTION_COLUMNS).order('sort'),
  ]);

  return (
    <div className="max-w-2xl">
      <HandbookView
        initialChapters={(chapters.data ?? []) as HandbookChapter[]}
        initialSections={(sections.data ?? []) as HandbookSection[]}
        initialSectionId={searchParams.s ?? null}
        role={session?.role ?? 'employee'}
        setupNeeded={isMissingTable(chapters.error)}
      />
    </div>
  );
}
