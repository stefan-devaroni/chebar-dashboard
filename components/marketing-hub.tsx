'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Instagram, Facebook, Music2, Star, Sparkles, Plus, X, Trash2,
  TrendingUp, DollarSign, Eye, Heart, MessageCircle, Share2, Loader2, Copy, Send,
  Lightbulb, Calendar,
} from 'lucide-react';
import { ReviewsClient } from '@/components/reviews-client';

interface SocialPost {
  id: string;
  platform: string;
  post_date: string;
  post_type: string;
  caption: string | null;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  ad_spend: number;
  ad_revenue: number;
  notes: string | null;
}

interface Campaign {
  id: string;
  name: string;
  platform: string;
  start_date: string;
  end_date: string | null;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  status: string;
}

interface ContentDraft {
  id: string;
  platform: string | null;
  caption: string;
  status: string;
  created_at: string;
}

type SubTab = 'overview' | 'posts' | 'campaigns' | 'ideas' | 'create' | 'reviews';

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

export function MarketingHub({
  initialPosts,
  initialCampaigns,
  initialDrafts,
  googleConnected,
}: {
  initialPosts: SocialPost[];
  initialCampaigns: Campaign[];
  initialDrafts: ContentDraft[];
  googleConnected: boolean;
}) {
  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [posts, setPosts] = useState(initialPosts);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [drafts, setDrafts] = useState(initialDrafts);

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'ideas', label: 'Ideas' },
    { key: 'posts', label: 'Social posts' },
    { key: 'campaigns', label: 'Ad campaigns' },
    { key: 'create', label: 'Create content' },
    { key: 'reviews', label: 'Reviews' },
  ];

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-8 border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-xs uppercase tracking-widest transition -mb-px',
              activeTab === tab.key
                ? 'border-b-2 border-ink text-ink'
                : 'text-neutral-500 hover:text-ink'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab posts={posts} campaigns={campaigns} />}
      {activeTab === 'ideas' && <IdeasTab />}
      {activeTab === 'posts' && <PostsTab posts={posts} setPosts={setPosts} />}
      {activeTab === 'campaigns' && <CampaignsTab campaigns={campaigns} setCampaigns={setCampaigns} />}
      {activeTab === 'create' && <CreateTab drafts={drafts} setDrafts={setDrafts} />}
      {activeTab === 'reviews' && <ReviewsClient googleConnected={googleConnected} />}
    </div>
  );
}

/* ========== OVERVIEW TAB ========== */
function OverviewTab({ posts, campaigns }: { posts: SocialPost[]; campaigns: Campaign[] }) {
  const last30 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return posts.filter((p) => new Date(p.post_date) >= cutoff);
  }, [posts]);

  const totalPosts = last30.length;
  const totalLikes = last30.reduce((s, p) => s + p.likes, 0);
  const totalComments = last30.reduce((s, p) => s + p.comments, 0);
  const totalReach = last30.reduce((s, p) => s + p.reach, 0);
  const totalAdSpend = last30.reduce((s, p) => s + p.ad_spend, 0);
  const totalAdRevenue = last30.reduce((s, p) => s + p.ad_revenue, 0);
  const roas = totalAdSpend > 0 ? (totalAdRevenue / totalAdSpend).toFixed(1) : '--';

  const byPlatform = useMemo(() => {
    const map: Record<string, { posts: number; likes: number; comments: number; reach: number }> = {};
    for (const p of last30) {
      if (!map[p.platform]) map[p.platform] = { posts: 0, likes: 0, comments: 0, reach: 0 };
      map[p.platform].posts++;
      map[p.platform].likes += p.likes;
      map[p.platform].comments += p.comments;
      map[p.platform].reach += p.reach;
    }
    return Object.entries(map);
  }, [last30]);

  const activeCampaigns = campaigns.filter((c) => c.status === 'active');

  return (
    <div className="space-y-8">
      <p className="text-xs uppercase tracking-widest text-neutral-500">Last 30 days</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp size={14} />} label="Posts" value={totalPosts} />
        <StatCard icon={<Heart size={14} />} label="Likes" value={totalLikes.toLocaleString()} />
        <StatCard icon={<MessageCircle size={14} />} label="Comments" value={totalComments.toLocaleString()} />
        <StatCard icon={<Eye size={14} />} label="Reach" value={totalReach.toLocaleString()} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={<DollarSign size={14} />} label="Ad spend" value={`$${totalAdSpend.toFixed(0)}`} />
        <StatCard icon={<DollarSign size={14} />} label="Ad revenue" value={`$${totalAdRevenue.toFixed(0)}`} />
        <StatCard icon={<TrendingUp size={14} />} label="ROAS" value={`${roas}x`} />
      </div>

      {/* Per-platform breakdown */}
      {byPlatform.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">By platform</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {byPlatform.map(([platform, stats]) => {
              const Icon = PLATFORM_ICONS[platform] ?? TrendingUp;
              return (
                <div key={platform} className="bg-white border border-neutral-200 rounded p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('p-1.5 rounded', PLATFORM_COLORS[platform] ?? 'bg-neutral-100')}>
                      <Icon size={14} />
                    </div>
                    <span className="text-xs uppercase tracking-widest text-neutral-500 capitalize">{platform}</span>
                  </div>
                  <p className="text-sm"><strong>{stats.posts}</strong> posts · <strong>{stats.likes}</strong> likes · <strong>{stats.comments}</strong> comments</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active campaigns */}
      {activeCampaigns.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Active campaigns</h3>
          <div className="bg-white border border-neutral-200 rounded divide-y divide-neutral-100">
            {activeCampaigns.map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-neutral-500 capitalize">{c.platform} · ${c.spent.toFixed(0)} of ${c.budget.toFixed(0)} budget</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{c.clicks} clicks</p>
                  <p className="text-xs text-neutral-500">{c.budget > 0 ? ((c.spent / c.budget) * 100).toFixed(0) : 0}% spent</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {posts.length === 0 && campaigns.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded p-10 text-center">
          <p className="text-sm text-neutral-500">No marketing data yet. Start logging posts or create your first campaign.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white border border-neutral-200 rounded p-4">
      <div className="flex items-center gap-2 text-neutral-500 mb-1">
        {icon}
        <span className="text-xs uppercase tracking-widest">{label}</span>
      </div>
      <span className="font-display text-2xl">{value}</span>
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
                    className="w-full px-5 py-3.5 text-left flex items-center gap-3 hover:bg-cream/30 transition"
                  >
                    <span className="text-xs text-neutral-400 w-8 shrink-0">#{idea.day}</span>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest shrink-0', PLATFORM_COLORS[idea.platform] ?? 'bg-neutral-100')}>
                      <Icon size={10} /> {idea.platform}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-neutral-500 shrink-0">{idea.format}</span>
                    <span className="flex-1 text-sm font-medium truncate">{idea.hook}</span>
                    <span className="text-sm shrink-0">{VALUE_EMOJI[idea.value_prop] ?? ''}</span>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded border shrink-0', pillarColor)}>
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

/* ========== POSTS TAB ========== */
function PostsTab({ posts, setPosts }: { posts: SocialPost[]; setPosts: (fn: (p: SocialPost[]) => SocialPost[]) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  const filtered = platformFilter === 'all' ? posts : posts.filter((p) => p.platform === platformFilter);

  async function handleAdd(data: any) {
    const res = await fetch('/api/marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _table: 'social_posts', ...data }),
    });
    if (res.ok) {
      const created = await res.json();
      setPosts((prev) => [created, ...prev]);
    }
    setShowAdd(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this post?')) return;
    const res = await fetch('/api/marketing', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, _table: 'social_posts' }),
    });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          {['all', 'instagram', 'facebook', 'tiktok'].map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={cn(
                'px-3 py-1.5 text-xs uppercase tracking-widest rounded transition',
                platformFilter === p ? 'bg-ink text-cream' : 'text-neutral-600 hover:bg-white'
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-gold text-ink px-4 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-gold/80 transition">
          <Plus size={14} strokeWidth={2} /> Log post
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded p-10 text-center">
          <p className="text-sm text-neutral-500">No posts logged yet. Click "Log post" to track your social media activity.</p>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs uppercase tracking-widest text-neutral-500">
                <th className="text-left px-4 py-2.5 font-normal">Date</th>
                <th className="text-left px-3 py-2.5 font-normal">Platform</th>
                <th className="text-left px-3 py-2.5 font-normal">Type</th>
                <th className="text-left px-3 py-2.5 font-normal">Caption</th>
                <th className="text-center px-3 py-2.5 font-normal w-14"><Heart size={12} className="inline" /></th>
                <th className="text-center px-3 py-2.5 font-normal w-14"><MessageCircle size={12} className="inline" /></th>
                <th className="text-center px-3 py-2.5 font-normal w-14"><Share2 size={12} className="inline" /></th>
                <th className="text-center px-3 py-2.5 font-normal w-16"><Eye size={12} className="inline" /></th>
                <th className="text-center px-3 py-2.5 font-normal w-16">$ Spend</th>
                <th className="px-2 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((post) => {
                const Icon = PLATFORM_ICONS[post.platform] ?? TrendingUp;
                return (
                  <tr key={post.id} className="border-b border-neutral-50 last:border-b-0 group hover:bg-cream/30">
                    <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">
                      {new Date(post.post_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest', PLATFORM_COLORS[post.platform])}>
                        <Icon size={10} /> {post.platform}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-600 capitalize">{post.post_type}</td>
                    <td className="px-3 py-2.5 text-neutral-700 truncate max-w-[200px]">{post.caption || '--'}</td>
                    <td className="px-3 py-2.5 text-center">{post.likes}</td>
                    <td className="px-3 py-2.5 text-center">{post.comments}</td>
                    <td className="px-3 py-2.5 text-center">{post.shares}</td>
                    <td className="px-3 py-2.5 text-center">{post.reach.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-center">{post.ad_spend > 0 ? `$${post.ad_spend}` : '--'}</td>
                    <td className="px-2 py-2.5">
                      <button onClick={() => handleDelete(post.id)}
                        className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddPostModal onClose={() => setShowAdd(false)} onSave={handleAdd} />}
    </div>
  );
}

function AddPostModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => void }) {
  const [platform, setPlatform] = useState('instagram');
  const [postType, setPostType] = useState('organic');
  const [caption, setCaption] = useState('');
  const [postDate, setPostDate] = useState(new Date().toISOString().split('T')[0]);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState(0);
  const [shares, setShares] = useState(0);
  const [reach, setReach] = useState(0);
  const [adSpend, setAdSpend] = useState(0);
  const [adRevenue, setAdRevenue] = useState(0);

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-cream border border-neutral-200 rounded-lg w-full max-w-lg p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">Log a post</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-ink transition"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold">
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Type</label>
              <select value={postType} onChange={(e) => setPostType(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold">
                <option value="organic">Organic</option>
                <option value="paid">Paid</option>
                <option value="story">Story</option>
                <option value="reel">Reel</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Date</label>
              <input type="date" value={postDate} onChange={(e) => setPostDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Caption</label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold resize-y" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Likes</label>
              <input type="number" min="0" value={likes} onChange={(e) => setLikes(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Comments</label>
              <input type="number" min="0" value={comments} onChange={(e) => setComments(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Shares</label>
              <input type="number" min="0" value={shares} onChange={(e) => setShares(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Reach</label>
              <input type="number" min="0" value={reach} onChange={(e) => setReach(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
            </div>
          </div>
          {postType === 'paid' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Ad spend ($)</label>
                <input type="number" min="0" step="0.01" value={adSpend} onChange={(e) => setAdSpend(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Revenue ($)</label>
                <input type="number" min="0" step="0.01" value={adRevenue} onChange={(e) => setAdRevenue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
              </div>
            </div>
          )}
          <button
            onClick={() => onSave({ platform, post_type: postType, caption, post_date: postDate, likes, comments, shares, reach, ad_spend: adSpend, ad_revenue: adRevenue })}
            className="w-full bg-ink text-cream py-2.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition">
            Log post
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========== CAMPAIGNS TAB ========== */
function CampaignsTab({ campaigns, setCampaigns }: { campaigns: Campaign[]; setCampaigns: (fn: (c: Campaign[]) => Campaign[]) => void }) {
  const [showAdd, setShowAdd] = useState(false);

  async function handleAdd(data: any) {
    const res = await fetch('/api/marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _table: 'campaigns', ...data }),
    });
    if (res.ok) {
      const created = await res.json();
      setCampaigns((prev) => [created, ...prev]);
    }
    setShowAdd(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this campaign?')) return;
    const res = await fetch('/api/marketing', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, _table: 'campaigns' }),
    });
    if (res.ok) setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-6">
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-gold text-ink px-4 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-gold/80 transition">
          <Plus size={14} strokeWidth={2} /> New campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded p-10 text-center">
          <p className="text-sm text-neutral-500">No campaigns yet. Create one to start tracking ad performance.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const roas = c.spent > 0 ? (c.revenue / c.spent).toFixed(1) : '--';
            const Icon = PLATFORM_ICONS[c.platform] ?? TrendingUp;
            return (
              <div key={c.id} className="bg-white border border-neutral-200 rounded p-5 group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest', PLATFORM_COLORS[c.platform])}>
                        <Icon size={10} /> {c.platform}
                      </span>
                      <span className={cn('text-[10px] uppercase tracking-widest px-2 py-0.5 rounded',
                        c.status === 'active' ? 'bg-green-50 text-green-700' :
                        c.status === 'paused' ? 'bg-amber-50 text-amber-700' :
                        'bg-neutral-100 text-neutral-500'
                      )}>{c.status}</span>
                    </div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {new Date(c.start_date + 'T00:00:00').toLocaleDateString()} — {c.end_date ? new Date(c.end_date + 'T00:00:00').toLocaleDateString() : 'Ongoing'}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-4 text-center">
                  <div>
                    <p className="text-xs text-neutral-500">Budget</p>
                    <p className="font-medium">${c.budget.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Spent</p>
                    <p className="font-medium">${c.spent.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Clicks</p>
                    <p className="font-medium">{c.clicks.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Revenue</p>
                    <p className="font-medium">${c.revenue.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">ROAS</p>
                    <p className="font-medium">{roas}x</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4" onClick={() => setShowAdd(false)}>
          <CampaignForm onClose={() => setShowAdd(false)} onSave={handleAdd} />
        </div>
      )}
    </div>
  );
}

function CampaignForm({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => void }) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [budget, setBudget] = useState(0);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="bg-cream border border-neutral-200 rounded-lg w-full max-w-md p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-xl">New campaign</h2>
        <button onClick={onClose} className="text-neutral-400 hover:text-ink transition"><X size={18} /></button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Campaign name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
            placeholder="e.g. Summer Pizza Promo" className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold">
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="tiktok">TikTok</option>
              <option value="google">Google</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Budget ($)</label>
            <input type="number" min="0" value={budget} onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
          </div>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
        </div>
        <button onClick={() => { if (name.trim()) onSave({ name: name.trim(), platform, budget, start_date: startDate, status: 'active' }); }}
          className="w-full bg-ink text-cream py-2.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition">
          Create campaign
        </button>
      </div>
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
