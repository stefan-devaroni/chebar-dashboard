'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertTriangle, SkipForward, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface Ingestion {
  id: string;
  received_at: string;
  sender_email: string | null;
  subject: string | null;
  report_type: string | null;
  status: string;
  file_name: string | null;
  records_written: number;
  error_message: string | null;
  ai_summary: string | null;
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  processed: { icon: CheckCircle2, color: 'text-green-600', label: 'Processed' },
  failed: { icon: XCircle, color: 'text-red-600', label: 'Failed' },
  skipped: { icon: SkipForward, color: 'text-neutral-400', label: 'Skipped' },
  pending: { icon: AlertTriangle, color: 'text-gold', label: 'Pending' },
};

export function IngestionLog({ ingestions }: { ingestions: Ingestion[] }) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm('Delete this report? Any daily metrics it imported will also be removed.')) return;
    setDeleting(id);
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
    }
    setDeleting(null);
  }

  if (ingestions.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded p-6 text-center">
        <p className="text-sm text-neutral-500">
          No reports received yet. Once Revel starts sending emails, they'll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded divide-y divide-neutral-100">
      {ingestions.map((ing) => {
        const config = statusConfig[ing.status] ?? statusConfig.pending;
        const Icon = config.icon;
        const expanded = expandedId === ing.id;

        return (
          <div key={ing.id}>
            <button
              onClick={() => setExpandedId(expanded ? null : ing.id)}
              className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-cream/50 transition"
            >
              <Icon size={16} className={config.color} strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {ing.file_name ?? ing.subject ?? 'Email report'}
                  </span>
                  <span className={cn(
                    'text-[10px] uppercase tracking-widest px-2 py-0.5 rounded',
                    ing.report_type === 'daily_sales' ? 'bg-blue-50 text-blue-700' :
                    ing.report_type === 'product_mix' ? 'bg-purple-50 text-purple-700' :
                    'bg-neutral-100 text-neutral-500'
                  )}>
                    {ing.report_type === 'daily_sales' ? 'Sales' :
                     ing.report_type === 'product_mix' ? 'Product mix' :
                     'Unknown'}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-neutral-500 mt-0.5">
                  <span>{new Date(ing.received_at).toLocaleString()}</span>
                  {ing.records_written > 0 && (
                    <span>{ing.records_written} records</span>
                  )}
                </div>
              </div>
              {expanded ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
            </button>

            {expanded && (
              <div className="px-5 pb-4 pt-1 space-y-2 text-sm">
                {ing.sender_email && (
                  <div className="flex gap-2">
                    <span className="text-xs uppercase tracking-widest text-neutral-500 w-16 shrink-0">From</span>
                    <span className="text-neutral-700">{ing.sender_email}</span>
                  </div>
                )}
                {ing.subject && (
                  <div className="flex gap-2">
                    <span className="text-xs uppercase tracking-widest text-neutral-500 w-16 shrink-0">Subject</span>
                    <span className="text-neutral-700">{ing.subject}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-xs uppercase tracking-widest text-neutral-500 w-16 shrink-0">Status</span>
                  <span className={config.color}>{config.label}</span>
                </div>
                {ing.error_message && (
                  <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-800">
                    {ing.error_message}
                  </div>
                )}
                {ing.ai_summary && (
                  <div className="bg-cream border border-neutral-200 rounded px-3 py-2 text-xs text-neutral-700 whitespace-pre-wrap">
                    {ing.ai_summary}
                  </div>
                )}
                <button
                  onClick={() => handleDelete(ing.id)}
                  disabled={deleting === ing.id}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition mt-2 disabled:opacity-50"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                  {deleting === ing.id ? 'Deleting...' : 'Delete report'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
