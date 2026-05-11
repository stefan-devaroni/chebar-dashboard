'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'How did we do last week?',
  'What day had the highest revenue?',
  'How is dinner performing vs breakfast?',
  'What are our labor costs trending like?',
];

export function ReportChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: question.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg.content, history: messages }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error. Try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg flex flex-col" style={{ minHeight: '500px' }}>
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Sparkles size={32} className="text-gold mb-4" strokeWidth={1.5} />
            <h3 className="font-display text-xl mb-2">Ask anything about your numbers</h3>
            <p className="text-sm text-neutral-500 mb-6 max-w-md">
              I have access to your daily sales, covers, labor costs, and ingested reports. Ask me anything.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs bg-cream border border-neutral-200 rounded-full px-4 py-2 hover:border-gold transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              <div
                className={
                  msg.role === 'user'
                    ? 'bg-ink text-cream rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[75%] text-sm'
                    : 'max-w-[85%] text-sm'
                }
              >
                {msg.role === 'assistant' ? (
                  <div
                    className="prose prose-sm max-w-none prose-headings:font-display prose-strong:text-ink prose-p:text-neutral-700 prose-li:text-neutral-700"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                  />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 size={14} className="animate-spin" />
            Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-neutral-200 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about revenue, trends, products..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-cream border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-gold disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-ink text-cream px-4 py-2.5 rounded-lg hover:bg-neutral-800 transition disabled:opacity-30 flex items-center gap-2"
          >
            <Send size={14} strokeWidth={2} />
          </button>
        </form>
      </div>
    </div>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) =>
      `<ul class="list-disc pl-5 space-y-1 my-2">${match}</ul>`
    )
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}
