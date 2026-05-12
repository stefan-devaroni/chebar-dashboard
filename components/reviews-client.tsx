'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, Loader2, Send, Copy, Check, Plus, X, MessageSquare } from 'lucide-react';

interface Review {
  id: string;
  platform: 'google' | 'tripadvisor';
  author: string;
  rating: number;
  text: string;
  date: string;
  hasReply: boolean;
  replyText: string | null;
}

export function ReviewsClient({ googleConnected }: { googleConnected: boolean }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddManual, setShowAddManual] = useState(false);

  async function fetchGoogleReviews() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reviews/google');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setReviews((prev) => {
          const googleIds = new Set(data.reviews.map((r: Review) => r.id));
          const nonGoogle = prev.filter((r) => r.platform !== 'google');
          return [...nonGoogle, ...data.reviews];
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function addManualReview(review: Review) {
    setReviews((prev) => [review, ...prev]);
    setShowAddManual(false);
  }

  const unreplied = reviews.filter((r) => !r.hasReply);
  const replied = reviews.filter((r) => r.hasReply);

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {googleConnected ? (
          <button
            onClick={fetchGoogleReviews}
            disabled={loading}
            className="bg-ink text-cream px-5 py-2 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Fetch Google reviews
          </button>
        ) : (
          <div className="bg-white border border-neutral-200 rounded px-4 py-2.5 text-xs text-neutral-500">
            Google not connected — add GOOGLE_ACCOUNT_ID, GOOGLE_LOCATION_ID, GOOGLE_ACCESS_TOKEN to .env.local
          </div>
        )}
        <button
          onClick={() => setShowAddManual(true)}
          className="flex items-center gap-1.5 border border-neutral-300 px-4 py-2 rounded text-xs uppercase tracking-widest hover:bg-white transition"
        >
          <Plus size={14} strokeWidth={2} />
          Add review manually
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Manual add form */}
      {showAddManual && (
        <ManualReviewForm
          onAdd={addManualReview}
          onClose={() => setShowAddManual(false)}
        />
      )}

      {/* Needs reply section */}
      {unreplied.length > 0 && (
        <section>
          <h2 className="font-display text-xl mb-4">
            Needs reply ({unreplied.length})
          </h2>
          <div className="space-y-4">
            {unreplied.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onReplied={(replyText) => {
                  setReviews((prev) =>
                    prev.map((r) =>
                      r.id === review.id
                        ? { ...r, hasReply: true, replyText }
                        : r
                    )
                  );
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Already replied */}
      {replied.length > 0 && (
        <section>
          <h2 className="font-display text-xl mb-4">
            Replied ({replied.length})
          </h2>
          <div className="space-y-4">
            {replied.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </section>
      )}

      {reviews.length === 0 && !loading && (
        <div className="bg-white border border-neutral-200 rounded p-10 text-center">
          <MessageSquare size={32} className="mx-auto mb-3 text-neutral-300" strokeWidth={1.5} />
          <p className="font-display text-xl mb-1">No reviews yet</p>
          <p className="text-sm text-neutral-500">
            Fetch from Google or add reviews manually to get started.
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  review,
  onReplied,
}: {
  review: Review;
  onReplied?: (text: string) => void;
}) {
  const [generatedReply, setGeneratedReply] = useState('');
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReply, setShowReply] = useState(false);

  async function generateReply() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/reviews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: review.author,
          rating: review.rating,
          text: review.text,
          platform: review.platform,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setGeneratedReply(data.reply);
        setShowReply(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function postReply() {
    if (!generatedReply.trim()) return;
    if (review.platform === 'google') {
      setPosting(true);
      setError(null);
      try {
        const res = await fetch('/api/reviews/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewId: review.id, replyText: generatedReply }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error);
        } else {
          onReplied?.(generatedReply);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setPosting(false);
      }
    }
  }

  async function copyReply() {
    await navigator.clipboard.writeText(generatedReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white border border-neutral-200 rounded p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{review.author}</span>
            <span className={cn(
              'text-[10px] uppercase tracking-widest px-2 py-0.5 rounded',
              review.platform === 'google'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-green-50 text-green-700'
            )}>
              {review.platform}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={14}
                className={i < review.rating ? 'text-gold fill-gold' : 'text-neutral-200'}
                strokeWidth={1.5}
              />
            ))}
            {review.date && (
              <span className="text-xs text-neutral-500 ml-2">
                {new Date(review.date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {!review.hasReply && (
          <button
            onClick={generateReply}
            disabled={generating}
            className="bg-gold text-ink px-4 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-gold/80 transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {generating && <Loader2 size={12} className="animate-spin" />}
            {generating ? 'Generating...' : 'Generate reply'}
          </button>
        )}
      </div>

      <p className="text-sm text-neutral-700 mb-3">{review.text}</p>

      {/* Existing reply */}
      {review.hasReply && review.replyText && (
        <div className="bg-cream border border-neutral-200 rounded p-3 mt-3">
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Your reply</p>
          <p className="text-sm text-neutral-700">{review.replyText}</p>
        </div>
      )}

      {/* Generated reply */}
      {showReply && generatedReply && !review.hasReply && (
        <div className="bg-cream border border-neutral-200 rounded p-3 mt-3 space-y-3">
          <p className="text-xs uppercase tracking-widest text-neutral-500">Draft reply</p>
          <textarea
            value={generatedReply}
            onChange={(e) => setGeneratedReply(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold resize-none"
          />
          <div className="flex items-center gap-2">
            {review.platform === 'google' && (
              <button
                onClick={postReply}
                disabled={posting}
                className="bg-ink text-cream px-4 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {posting ? 'Posting...' : 'Post to Google'}
              </button>
            )}
            <button
              onClick={copyReply}
              className="border border-neutral-300 px-4 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-white transition flex items-center gap-1.5"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={generateReply}
              disabled={generating}
              className="text-xs text-neutral-500 hover:text-ink transition uppercase tracking-widest"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-700 mt-2">{error}</p>}
    </div>
  );
}

function ManualReviewForm({
  onAdd,
  onClose,
}: {
  onAdd: (review: Review) => void;
  onClose: () => void;
}) {
  const [platform, setPlatform] = useState<'google' | 'tripadvisor'>('google');
  const [author, setAuthor] = useState('');
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd({
      id: `manual-${Date.now()}`,
      platform,
      author: author || 'Anonymous',
      rating,
      text: text.trim(),
      date,
      hasReply: false,
      replyText: null,
    });
  }

  return (
    <div className="bg-white border border-neutral-200 rounded p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg">Add review</h3>
        <button onClick={onClose} className="text-neutral-400 hover:text-ink transition">
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as any)}
              className="w-full px-3 py-2 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
            >
              <option value="google">Google</option>
              <option value="tripadvisor">TripAdvisor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Author</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Name"
              className="w-full px-3 py-2 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Rating</label>
            <div className="flex items-center gap-1 py-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                >
                  <Star
                    size={20}
                    className={n <= rating ? 'text-gold fill-gold' : 'text-neutral-300'}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Review text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            rows={3}
            placeholder="Paste the review text here..."
            className="w-full px-3 py-2 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-ink text-cream px-5 py-2 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition"
          >
            Add review
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 border border-neutral-300 rounded text-xs uppercase tracking-widest hover:bg-cream transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
