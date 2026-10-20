'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { boldRuns, parseBlocks, type HandbookChapter, type HandbookSection } from '@/lib/handbook';

type Role = 'manager' | 'employee';

const inputClass = 'w-full px-3 py-3 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:border-gold';
const labelClass = 'block text-xs uppercase tracking-wider text-neutral-500 mb-1.5';

async function send(method: string, body: unknown) {
  const res = await fetch('/api/handbook', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not save. Check your connection and try again.');
  return data;
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {boldRuns(text).map((run, i) => (run.bold ? <strong key={i}>{run.text}</strong> : <span key={i}>{run.text}</span>))}
    </>
  );
}

function HandbookText({ body }: { body: string }) {
  return (
    <div className="space-y-4 text-[16px] leading-relaxed text-neutral-800">
      {parseBlocks(body).map((block, i) => {
        if (block.type === 'heading') return <h3 key={i} className="font-display text-xl pt-2"><Inline text={block.text} /></h3>;
        if (block.type === 'bullets')
          return (
            <ul key={i} className="space-y-1.5 pl-5 list-disc marker:text-gold">
              {block.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}
            </ul>
          );
        if (block.type === 'steps')
          return (
            <ol key={i} className="space-y-1.5 pl-5 list-decimal marker:text-neutral-500">
              {block.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}
            </ol>
          );
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Inline text={line} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function HandbookView({
  initialChapters,
  initialSections,
  initialSectionId,
  role,
  setupNeeded,
}: {
  initialChapters: HandbookChapter[];
  initialSections: HandbookSection[];
  initialSectionId: string | null;
  role: Role;
  setupNeeded: boolean;
}) {
  const isManager = role === 'manager';
  const [chapters, setChapters] = useState(initialChapters);
  const [sections, setSections] = useState(initialSections);
  const [openId, setOpenId] = useState<string | null>(initialSectionId);
  const [editingSection, setEditingSection] = useState(false);
  const [editContents, setEditContents] = useState(false);

  const orderedChapters = useMemo(() => [...chapters].sort((a, b) => a.sort - b.sort), [chapters]);
  const sectionsOf = (chapterId: string) => sections.filter((s) => s.chapter_id === chapterId).sort((a, b) => a.sort - b.sort);
  // Reading order across the whole handbook, for previous / next
  const readingOrder = useMemo(() => orderedChapters.flatMap((c) => sections.filter((s) => s.chapter_id === c.id).sort((a, b) => a.sort - b.sort)), [orderedChapters, sections]);
  const written = sections.filter((s) => s.body.trim()).length;

  const open = (id: string | null) => {
    setOpenId(id);
    setEditingSection(false);
    window.history.replaceState(null, '', id ? `?s=${id}` : window.location.pathname);
    window.scrollTo({ top: 0 });
  };

  // Browser back/forward keeps working with the ?s= links
  useEffect(() => {
    const onPop = () => setOpenId(new URLSearchParams(window.location.search).get('s'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (setupNeeded) {
    return (
      <>
        <h1 className="font-display text-3xl mb-6">Handbook</h1>
        <div className="bg-white border border-neutral-200 rounded-xl p-5 text-sm text-neutral-600">
          {isManager ? (
            <>
              <p className="font-medium text-ink mb-1">One-time setup needed</p>
              <p>
                Open Supabase → SQL Editor, paste the file <code className="text-xs bg-neutral-100 px-1 rounded">supabase/handbook.sql</code> and press
                Run. Then reload this page.
              </p>
            </>
          ) : (
            <p>The handbook isn&apos;t set up yet. Ask a manager.</p>
          )}
        </div>
      </>
    );
  }

  const section = sections.find((s) => s.id === openId);

  // ---------- one section ----------
  if (section) {
    const chapter = orderedChapters.find((c) => c.id === section.chapter_id);
    const chapterNumber = orderedChapters.findIndex((c) => c.id === section.chapter_id) + 1;
    const index = readingOrder.findIndex((s) => s.id === section.id);
    const prev = readingOrder[index - 1];
    const next = readingOrder[index + 1];

    if (editingSection && isManager) {
      return (
        <SectionEditor
          section={section}
          onCancel={() => setEditingSection(false)}
          onSaved={(saved) => {
            setSections((list) => list.map((s) => (s.id === saved.id ? saved : s)));
            setEditingSection(false);
          }}
          onDeleted={() => {
            setSections((list) => list.filter((s) => s.id !== section.id));
            open(null);
          }}
        />
      );
    }

    return (
      <article>
        <button onClick={() => open(null)} className="flex items-center gap-1 text-sm text-neutral-500 mb-4 -ml-1 py-1">
          <ChevronLeft size={16} />
          Contents
        </button>
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          {chapterNumber}. {chapter?.title}
        </p>
        <h1 className="font-display text-3xl mt-1 mb-5">{section.title}</h1>

        {section.body.trim() ? (
          <HandbookText body={section.body} />
        ) : (
          <div className="bg-white border border-dashed border-neutral-300 rounded-xl p-5">
            <p className="text-sm font-medium text-neutral-600">Not written yet</p>
            {section.hint && <p className="text-sm text-neutral-500 mt-1">{section.hint}</p>}
          </div>
        )}

        {isManager && (
          <button onClick={() => setEditingSection(true)} className="w-full mt-6 bg-ink text-cream py-3.5 rounded-xl text-base font-medium">
            {section.body.trim() ? 'Edit this section' : 'Write this section'}
          </button>
        )}

        <div className="grid grid-cols-2 gap-2 mt-6">
          {prev ? (
            <button onClick={() => open(prev.id)} className="text-left bg-white border border-neutral-200 rounded-xl p-3">
              <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-neutral-400">
                <ChevronLeft size={13} />
                Previous
              </span>
              <span className="block text-sm mt-1 truncate">{prev.title}</span>
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button onClick={() => open(next.id)} className="text-right bg-white border border-neutral-200 rounded-xl p-3">
              <span className="flex items-center justify-end gap-1 text-[11px] uppercase tracking-wider text-neutral-400">
                Next
                <ChevronRight size={13} />
              </span>
              <span className="block text-sm mt-1 truncate">{next.title}</span>
            </button>
          )}
        </div>
        {section.body.trim() && section.updated_by && (
          <p className="text-[11px] text-neutral-400 mt-4">
            Last edited by {section.updated_by},{' '}
            {new Date(section.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Aruba' })}
          </p>
        )}
      </article>
    );
  }

  // ---------- table of contents ----------
  return (
    <>
      <header className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Handbook</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {isManager ? `${written} of ${sections.length} sections written` : 'Tap a section to read it.'}
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => setEditContents((v) => !v)}
            className={cn(
              'shrink-0 px-4 h-11 rounded-xl text-sm font-medium border',
              editContents ? 'bg-ink text-cream border-ink' : 'bg-white border-neutral-200 text-neutral-700'
            )}
          >
            {editContents ? 'Done' : 'Edit contents'}
          </button>
        )}
      </header>

      {editContents ? (
        <ContentsEditor
          chapters={orderedChapters}
          sectionsOf={sectionsOf}
          setChapters={setChapters}
          setSections={setSections}
        />
      ) : (
        <div className="space-y-4">
          {orderedChapters.map((chapter, ci) => (
            <section key={chapter.id} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              <h2 className="px-4 pt-4 pb-2 font-display text-xl">
                <span className="text-gold mr-2">{ci + 1}</span>
                {chapter.title}
              </h2>
              <ul className="divide-y divide-neutral-100">
                {sectionsOf(chapter.id).map((s, si) => (
                  <li key={s.id}>
                    <button onClick={() => open(s.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 active:bg-neutral-50">
                      <span className="w-9 shrink-0 text-xs tabular-nums text-neutral-400">
                        {ci + 1}.{si + 1}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={cn('block text-[15px]', !s.body.trim() && 'text-neutral-500')}>{s.title}</span>
                        {!s.body.trim() && isManager && <span className="block text-[11px] text-amber-700 mt-0.5">Not written yet</span>}
                      </span>
                      <ChevronRight size={16} className="text-neutral-300 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function SectionEditor({
  section,
  onCancel,
  onSaved,
  onDeleted,
}: {
  section: HandbookSection;
  onCancel: () => void;
  onSaved: (s: HandbookSection) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [body, setBody] = useState(section.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onCancel} className="flex items-center gap-1 text-sm text-neutral-500 -ml-1 py-1">
        <ChevronLeft size={16} />
        Back without saving
      </button>
      <div>
        <label className={labelClass}>Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Text</label>
        {section.hint && !body.trim() && <p className="text-sm text-neutral-500 mb-2">What goes here: {section.hint}</p>}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} className={cn(inputClass, 'resize-y leading-relaxed')} />
        <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
          Leave an empty line between paragraphs. Start a line with <b>-</b> for a bullet list, <b>1.</b> for numbered steps, or <b>##</b> for a
          small heading. Put <b>**double stars**</b> around words to make them bold.
        </p>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-800">{error}</div>}
      <button
        onClick={() => run(async () => onSaved(await send('PUT', { kind: 'section', id: section.id, title, body })))}
        disabled={saving || !title.trim()}
        className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        onClick={() =>
          confirm(`Delete the section "${section.title}"? This can't be undone.`) &&
          run(async () => {
            await send('DELETE', { kind: 'section', id: section.id });
            onDeleted();
          })
        }
        disabled={saving}
        className="w-full py-3 text-sm text-red-600"
      >
        Delete section
      </button>
    </div>
  );
}

function ContentsEditor({
  chapters,
  sectionsOf,
  setChapters,
  setSections,
}: {
  chapters: HandbookChapter[];
  sectionsOf: (chapterId: string) => HandbookSection[];
  setChapters: React.Dispatch<React.SetStateAction<HandbookChapter[]>>;
  setSections: React.Dispatch<React.SetStateAction<HandbookSection[]>>;
}) {
  const [newSection, setNewSection] = useState<Record<string, string>>({});
  const [newChapter, setNewChapter] = useState('');
  const [titles, setTitles] = useState<Record<string, string>>({});

  const fail = (e: unknown) => alert((e as Error).message);

  async function moveChapter(index: number, dir: -1 | 1) {
    const list = [...chapters];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    setChapters(list.map((c, i) => ({ ...c, sort: i + 1 })));
    await send('PUT', { kind: 'order', table: 'chapters', ids: list.map((c) => c.id) }).catch(fail);
  }

  async function moveSection(chapterId: string, index: number, dir: -1 | 1) {
    const list = sectionsOf(chapterId);
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const sortOf = new Map(list.map((s, i) => [s.id, i + 1]));
    setSections((all) => all.map((s) => (sortOf.has(s.id) ? { ...s, sort: sortOf.get(s.id)! } : s)));
    await send('PUT', { kind: 'order', table: 'sections', ids: list.map((s) => s.id) }).catch(fail);
  }

  async function renameChapter(chapter: HandbookChapter) {
    const title = (titles[chapter.id] ?? chapter.title).trim();
    if (!title || title === chapter.title) return;
    try {
      const saved: HandbookChapter = await send('PUT', { kind: 'chapter', id: chapter.id, title });
      setChapters((list) => list.map((c) => (c.id === saved.id ? saved : c)));
    } catch (e) {
      fail(e);
    }
  }

  async function addSection(chapterId: string) {
    const title = (newSection[chapterId] ?? '').trim();
    if (!title) return;
    try {
      const saved: HandbookSection = await send('POST', { kind: 'section', chapter_id: chapterId, title });
      setSections((list) => [...list, saved]);
      setNewSection((d) => ({ ...d, [chapterId]: '' }));
    } catch (e) {
      fail(e);
    }
  }

  async function deleteSection(section: HandbookSection) {
    if (!confirm(`Delete the section "${section.title}"? This can't be undone.`)) return;
    try {
      await send('DELETE', { kind: 'section', id: section.id });
      setSections((list) => list.filter((s) => s.id !== section.id));
    } catch (e) {
      fail(e);
    }
  }

  async function deleteChapter(chapter: HandbookChapter) {
    if (!confirm(`Delete the chapter "${chapter.title}" and all its sections? This can't be undone.`)) return;
    try {
      await send('DELETE', { kind: 'chapter', id: chapter.id });
      setChapters((list) => list.filter((c) => c.id !== chapter.id));
      setSections((list) => list.filter((s) => s.chapter_id !== chapter.id));
    } catch (e) {
      fail(e);
    }
  }

  async function addChapter() {
    const title = newChapter.trim();
    if (!title) return;
    try {
      const saved: HandbookChapter = await send('POST', { kind: 'chapter', title });
      setChapters((list) => [...list, saved]);
      setNewChapter('');
    } catch (e) {
      fail(e);
    }
  }

  const iconButton = 'w-10 h-10 flex items-center justify-center text-neutral-400 disabled:opacity-25';

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500 px-1">Rename chapters, change the order with the arrows, add or delete sections. Tap Done when finished.</p>
      {chapters.map((chapter, ci) => {
        const list = sectionsOf(chapter.id);
        return (
          <section key={chapter.id} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-1 p-2 border-b border-neutral-100 bg-neutral-50">
              <span className="w-7 text-center text-sm text-gold font-medium">{ci + 1}</span>
              <input
                type="text"
                value={titles[chapter.id] ?? chapter.title}
                onChange={(e) => setTitles((t) => ({ ...t, [chapter.id]: e.target.value }))}
                onBlur={() => renameChapter(chapter)}
                className="flex-1 min-w-0 px-2 py-2 text-base font-medium bg-transparent rounded-lg border border-transparent focus:border-gold focus:bg-white focus:outline-none"
              />
              <button onClick={() => moveChapter(ci, -1)} disabled={ci === 0} aria-label="Move chapter up" className={iconButton}>
                <ArrowUp size={16} />
              </button>
              <button onClick={() => moveChapter(ci, 1)} disabled={ci === chapters.length - 1} aria-label="Move chapter down" className={iconButton}>
                <ArrowDown size={16} />
              </button>
              <button onClick={() => deleteChapter(chapter)} aria-label="Delete chapter" className={cn(iconButton, 'hover:text-red-600')}>
                <Trash2 size={16} />
              </button>
            </div>
            <ul className="divide-y divide-neutral-100">
              {list.map((s, si) => (
                <li key={s.id} className="flex items-center gap-1 pl-3 pr-1">
                  <span className="w-9 text-xs tabular-nums text-neutral-400 shrink-0">
                    {ci + 1}.{si + 1}
                  </span>
                  <span className="flex-1 min-w-0 text-[15px] py-2.5">{s.title}</span>
                  <button onClick={() => moveSection(chapter.id, si, -1)} disabled={si === 0} aria-label="Move section up" className={iconButton}>
                    <ArrowUp size={16} />
                  </button>
                  <button onClick={() => moveSection(chapter.id, si, 1)} disabled={si === list.length - 1} aria-label="Move section down" className={iconButton}>
                    <ArrowDown size={16} />
                  </button>
                  <button onClick={() => deleteSection(s)} aria-label="Delete section" className={cn(iconButton, 'hover:text-red-600')}>
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 p-3 border-t border-neutral-100">
              <input
                type="text"
                value={newSection[chapter.id] ?? ''}
                onChange={(e) => setNewSection((d) => ({ ...d, [chapter.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addSection(chapter.id)}
                placeholder="New section title…"
                className={cn(inputClass, 'py-2.5')}
              />
              <button onClick={() => addSection(chapter.id)} className="shrink-0 px-4 rounded-xl bg-ink text-cream text-sm font-medium">
                Add
              </button>
            </div>
          </section>
        );
      })}
      <div className="flex gap-2">
        <input
          type="text"
          value={newChapter}
          onChange={(e) => setNewChapter(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addChapter()}
          placeholder="New chapter title…"
          className={inputClass}
        />
        <button onClick={addChapter} className="shrink-0 flex items-center gap-1.5 px-4 rounded-xl bg-gold text-ink text-sm font-medium">
          <Plus size={16} />
          Chapter
        </button>
      </div>
    </div>
  );
}
