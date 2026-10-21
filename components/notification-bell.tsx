'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Briefcase, CalendarCheck, Truck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/lib/notifications';

// The bell for managers: new job applications, online bookings and missing deliveries.
// Checks for new ones every minute while the dashboard is open.

const ICONS: Record<string, typeof Bell> = { application: Briefcase, reservation: CalendarCheck, delivery: Truck };

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NotificationBell({ placement }: { placement: 'header' | 'sidebar' }) {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    // The nav has a bell for phones and one for computers: only the one on screen checks
    if (!buttonRef.current?.getClientRects().length) return;
    const res = await fetch('/api/notifications', { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setItems(data.items ?? []);
    setUnread(data.unread ?? 0);
  }, []);

  useEffect(() => {
    load();
    const refresh = () => {
      if (document.visibilityState === 'visible') load();
    };
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    // Turning an iPad switches between the phone and computer layouts
    const wide = window.matchMedia('(min-width: 1024px)');
    const swap = () => setTimeout(load, 50);
    wide.addEventListener('change', swap);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      wide.removeEventListener('change', swap);
    };
  }, [load]);

  function markRead(body: { id: string } | { all: true }) {
    fetch('/api/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  }

  function openItem(n: AppNotification) {
    if (!n.read_at) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)));
      setUnread((u) => Math.max(0, u - 1));
      markRead({ id: n.id });
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  function readAll() {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })));
    setUnread(0);
    markRead({ all: true });
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => {
          if (!open) load();
          setOpen((o) => !o);
        }}
        aria-label={unread ? `${unread} new notifications` : 'Notifications'}
        className={cn(
          'relative w-10 h-10 flex items-center justify-center rounded-full transition',
          placement === 'header' ? 'text-neutral-300 active:bg-neutral-800' : 'text-neutral-400 hover:text-cream hover:bg-neutral-900'
        )}
      >
        <Bell size={20} strokeWidth={1.5} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'absolute bg-white text-ink shadow-2xl border border-neutral-200 rounded-2xl overflow-hidden flex flex-col',
              placement === 'header' ? 'top-16 inset-x-2 max-h-[70vh]' : 'top-6 left-[15.5rem] w-96 max-h-[80vh]'
            )}
          >
            <div className="flex items-center justify-between pl-4 pr-2 py-2 border-b border-neutral-100">
              <p className="font-medium">Notifications</p>
              <div className="flex items-center">
                {unread > 0 && (
                  <button onClick={readAll} className="text-xs text-neutral-500 hover:text-ink px-2 py-2">
                    Mark all as read
                  </button>
                )}
                <button onClick={() => setOpen(false)} aria-label="Close" className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-ink">
                  <X size={17} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-500">Nothing here yet.</p>
              ) : (
                items.map((n) => {
                  const Icon = ICONS[n.kind] ?? Bell;
                  return (
                    <button
                      key={n.id}
                      onClick={() => openItem(n)}
                      className={cn('w-full flex items-start gap-3 px-4 py-3 text-left border-b border-neutral-100 last:border-0 hover:bg-neutral-50', !n.read_at && 'bg-cream/60')}
                    >
                      <span className={cn('mt-0.5 w-8 h-8 shrink-0 rounded-full flex items-center justify-center', n.read_at ? 'bg-neutral-100 text-neutral-500' : 'bg-ink text-cream')}>
                        <Icon size={15} strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={cn('block text-sm', n.read_at ? 'text-neutral-700' : 'font-semibold')}>{n.title}</span>
                        {n.body && <span className="block text-xs text-neutral-500 truncate">{n.body}</span>}
                        <span className="block text-[11px] text-neutral-400 mt-0.5">{ago(n.created_at)}</span>
                      </span>
                      {!n.read_at && <span className="mt-2 w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
