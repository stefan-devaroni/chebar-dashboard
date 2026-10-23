'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Instagram, Facebook, Music2, Star, Sparkles, Trash2, TrendingUp, Loader2, Copy, Send, Lightbulb, Calendar,
} from 'lucide-react';
import { ReviewsClient } from '@/components/reviews-client';

interface ContentDraft {
  id: string;
  platform: string | null;
  caption: string;
  status: string;
  created_at: string;
}

type SubTab = 'overview' | 'ideas' | 'create' | 'reviews';

const PLATFORM_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Music2,
  google: Star,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'text-pink-600 bg-pink-50',
  facebook: 'text-blue-600 bg-blue-50',
  tiktok: 'text-neutral-900 bg-neutral-100',
  google: 'text-amber-600 bg-amber-50',
};

// The Facebook & Instagram overview (components/meta-overview.tsx) comes in from the page as `overview`
export function MarketingHub({
  overview,
  initialDrafts,
  googleConnected,
}: {
  overview: React.ReactNode;
  initialDrafts: ContentDraft[];
  googleConnected: boolean;
}) {
  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [drafts, setDrafts] = useState(initialDrafts);

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'overview', label: 'Facebook & Instagram' },
    { key: 'ideas', label: 'Ideas' },
    { key: 'create', label: 'Create content' },
    { key: 'reviews', label: 'Reviews' },
  ];

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-8 border-b border-neutral-200 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-xs uppercase tracking-widest transition -mb-px whitespace-nowrap shrink-0',
              activeTab === tab.key
                ? 'border-b-2 border-ink text-ink'
                : 'text-neutral-500 hover:text-ink'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && overview}
      {activeTab === 'ideas' && <IdeasTab />}
      {activeTab === 'create' && <CreateTab drafts={drafts} setDrafts={setDrafts} />}
      {activeTab === 'reviews' && <ReviewsClient googleConnected={googleConnected} />}
    </div>
  );
}

/* ========== IDEAS TAB ========== */

interface ContentIdea {
  day: number;
  date_suggestion: string;
  platform: string;
  format: string;
  pillar: string;
  value_prop: string;
  hook: string;
  idea: string;
  caption: string;
  hashtags: string;
  notes: string | null;
}

const PILLAR_COLORS: Record<string, string> = {
  'Food & Menu': 'bg-orange-50 text-orange-700 border-orange-200',
  'Vibe & Atmosphere': 'bg-sky-50 text-sky-700 border-sky-200',
  'People & Community': 'bg-violet-50 text-violet-700 border-violet-200',
  'Behind the Scenes': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Promos & Events': 'bg-rose-50 text-rose-700 border-rose-200',
};

const VALUE_EMOJI: Record<string, string> = {
  laugh: '😂', useful: '📚', inspire: '✨', visual: '🎨', personality: '💬',
};

function IdeasTab() {
  const [platform, setPlatform] = useState('all');
  const [weeks, setWeeks] = useState(4);
  const [focus, setFocus] = useState('');
  const [month, setMonth] = useState('');
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setIdeas([]);

    try {
      const res = await fetch('/api/marketing/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, weeks, focus: focus.trim() || null, month: month.trim() || null }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to generate ideas');
      } else {
        const data = await res.json();
        setIdeas(data.ideas || []);
      }
    } catch {
      setError('Network error. Try again.');
    }
    setGenerating(false);
  }

  const grouped = useMemo(() => {
    const weekMap: Record<number, ContentIdea[]> = {};
    for (const idea of ideas) {
      const weekNum = Math.ceil(idea.day / 7) || 1;
      if (!weekMap[weekNum]) weekMap[weekNum] = [];
      weekMap[weekNum].push(idea);
    }
    return Object.entries(weekMap).sort(([a], [b]) => parseInt(a) - parseInt(b));
  }, [ideas]);

  return (
    <div className="space-y-8">
      {/* Generator controls */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={18} className="text-gold" />
          <h3 className="font-display text-lg">Content Ideas Generator</h3>
        </div>
        <p className="text-sm text-neutral-500 mb-5">
          Generate a month of content ideas based on proven content pillars and value props. Each idea comes with a hook, caption, and hashtags ready to go.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2.5 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold">
              <option value="all">All platforms</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Weeks</label>
            <select value={weeks} onChange={(e) => setWeeks(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold">
              <option value={1}>1 week</option>
              <option value={2}>2 weeks</option>
              <option value={4}>4 weeks</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Month</label>
            <input type="text" value={month} onChange={(e) => setMonth(e.target.value)}
              placeholder="e.g. June 2026"
              className="w-full px-3 py-2.5 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Special focus</label>
            <input type="text" value={focus} onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. Summer promo, new pizza"
              className="w-full px-3 py-2.5 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-ink text-cream px-6 py-2.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
          {generating ? 'Generating ideas...' : 'Generate content plan'}
        </button>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>
        )}
      </div>

      {/* Framework reference */}
      {ideas.length === 0 && !generating && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-neutral-200 rounded p-5">
            <h4 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Content Pillars</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-400" /> Food & Menu</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-sky-400" /> Vibe & Atmosphere</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-violet-400" /> People & Community</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Behind the Scenes</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-400" /> Promos & Events</li>
            </ul>
          </div>
          <div className="bg-white border border-neutral-200 rounded p-5">
            <h4 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Value Props</h4>
            <ul className="space-y-2 text-sm">
              <li>😂 Make someone laugh or trigger emotions</li>
              <li>📚 Share useful info</li>
              <li>✨ Inspire people</li>
              <li>🎨 Create visually stunning content</li>
              <li>💬 Express personality & beliefs</li>
            </ul>
          </div>
        </div>
      )}

      {/* Generated ideas */}
      {grouped.map(([weekNum, weekIdeas]) => (
        <div key={weekNum}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} className="text-gold" />
            <h3 className="text-xs uppercase tracking-widest text-neutral-500">Week {weekNum}</h3>
          </div>
          <div className="space-y-2">
            {weekIdeas.map((idea, idx) => {
              const globalIdx = idea.day;
              const expanded = expandedId === globalIdx;
              const Icon = PLATFORM_ICONS[idea.platform] ?? TrendingUp;
              const pillarColor = PILLAR_COLORS[idea.pillar] ?? 'bg-neutral-50 text-neutral-600 border-neutral-200';

              return (
                <div key={idx} className="bg-white border border-neutral-200 rounded overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expanded ? null : globalIdx)}
                    className="w-full px-4 sm:px-5 py-3 sm:py-3.5 text-left flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 hover:bg-cream/30 transition"
                  >
                    <span className="text-xs text-neutral-400 w-6 sm:w-8 shrink-0">#{idea.day}</span>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest shrink-0', PLATFORM_COLORS[idea.platform] ?? 'bg-neutral-100')}>
                      <Icon size={10} /> {idea.platform}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-neutral-500 shrink-0">{idea.format}</span>
                    <span className="w-full sm:w-auto sm:flex-1 text-sm font-medium truncate order-last sm:order-none">{idea.hook}</span>
                    <span className="text-sm shrink-0 hidden sm:inline">{VALUE_EMOJI[idea.value_prop] ?? ''}</span>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded border shrink-0 hidden sm:inline', pillarColor)}>
                      {idea.pillar}
                    </span>
                  </button>

                  {expanded && (
                    <div className="px-5 pb-5 pt-1 border-t border-neutral-100 space-y-4">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Idea</p>
                        <p className="text-sm text-neutral-700">{idea.idea}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs uppercase tracking-widest text-neutral-500">Caption (ready to post)</p>
                          <button
                            onClick={() => navigator.clipboard.writeText(idea.caption + '\n\n' + idea.hashtags)}
                            className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-neutral-500 hover:text-ink transition"
                          >
                            <Copy size={10} /> Copy
                          </button>
                        </div>
                        <div className="bg-cream border border-neutral-200 rounded p-3 text-sm whitespace-pre-wrap">
                          {idea.caption}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Hashtags</p>
                        <p className="text-xs text-blue-600">{idea.hashtags}</p>
                      </div>
                      {idea.notes && (
                        <div>
                          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Production notes</p>
                          <p className="text-xs text-neutral-600">{idea.notes}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-neutral-500">
                        <span>Pillar: <strong className="text-neutral-700">{idea.pillar}</strong></span>
                        <span>Value: <strong className="text-neutral-700">{VALUE_EMOJI[idea.value_prop]} {idea.value_prop}</strong></span>
                        <span>Day: <strong className="text-neutral-700">{idea.date_suggestion}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ========== CREATE CONTENT TAB ========== */
function CreateTab({ drafts, setDrafts }: { drafts: ContentDraft[]; setDrafts: (fn: (d: ContentDraft[]) => ContentDraft[]) => void }) {
  const [prompt, setPrompt] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [contentType, setContentType] = useState('post caption');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setResult(null);

    const res = await fetch('/api/marketing/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim(), platform, contentType }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult(data.content);
    }
    setGenerating(false);
  }

  async function saveDraft() {
    if (!result) return;
    const res = await fetch('/api/marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _table: 'drafts', platform, caption: result, status: 'draft' }),
    });
    if (res.ok) {
      const created = await res.json();
      setDrafts((prev) => [created, ...prev]);
    }
  }

  async function deleteDraft(id: string) {
    const res = await fetch('/api/marketing', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, _table: 'drafts' }),
    });
    if (res.ok) setDrafts((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-8">
      {/* Generator */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-gold" />
          <h3 className="font-display text-lg">AI Content Generator</h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2.5 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold">
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Content type</label>
              <select value={contentType} onChange={(e) => setContentType(e.target.value)}
                className="w-full px-3 py-2.5 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold">
                <option value="post caption">Post caption</option>
                <option value="story text">Story text</option>
                <option value="reel script">Reel script</option>
                <option value="ad copy">Ad copy</option>
                <option value="promotion announcement">Promo announcement</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">What should the post be about?</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Our new Margherita pizza with fior di latte, happy hour tonight from 5-7..."
              className="w-full px-3 py-2.5 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold resize-y"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="bg-ink text-cream px-6 py-2.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-6 p-4 bg-cream border border-neutral-200 rounded">
            <p className="text-sm whitespace-pre-wrap mb-4">{result}</p>
            <div className="flex gap-2">
              <button onClick={() => { navigator.clipboard.writeText(result); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-widest border border-neutral-300 rounded hover:bg-white transition">
                <Copy size={12} /> Copy
              </button>
              <button onClick={saveDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-widest bg-ink text-cream rounded hover:bg-neutral-800 transition">
                <Send size={12} /> Save draft
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Saved drafts */}
      {drafts.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Saved drafts</h3>
          <div className="space-y-2">
            {drafts.map((d) => (
              <div key={d.id} className="bg-white border border-neutral-200 rounded px-4 py-3 group flex gap-3">
                <div className="flex-1 min-w-0">
                  {d.platform && (
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest mb-1', PLATFORM_COLORS[d.platform] ?? 'bg-neutral-100')}>
                      {d.platform}
                    </span>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{d.caption}</p>
                  <p className="text-xs text-neutral-400 mt-1">{new Date(d.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => navigator.clipboard.writeText(d.caption)}
                    className="p-1 text-neutral-400 hover:text-ink transition"><Copy size={12} /></button>
                  <button onClick={() => deleteDraft(d.id)}
                    className="p-1 text-neutral-400 hover:text-red-500 transition"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
