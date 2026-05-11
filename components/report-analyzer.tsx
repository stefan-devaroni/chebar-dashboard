'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Image, X, Loader2, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCEPTED_TYPES = [
  'application/pdf',
  'text/csv',
  'text/plain',
  'text/tab-separated-values',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ACCEPTED_EXTENSIONS = '.pdf,.csv,.txt,.tsv,.png,.jpg,.jpeg,.webp,.xls,.xlsx';

function fileIcon(type: string) {
  if (type === 'application/pdf') return <FileText size={16} className="text-red-600" />;
  if (type.startsWith('image/')) return <Image size={16} className="text-blue-600" />;
  return <FileSpreadsheet size={16} className="text-green-700" />;
}

export function ReportAnalyzer() {
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(newFiles: FileList | File[]) {
    const valid = Array.from(newFiles).filter(
      (f) => ACCEPTED_TYPES.includes(f.type) || f.name.match(/\.(pdf|csv|txt|tsv|png|jpe?g|webp|xlsx?)$/i)
    );
    setFiles((prev) => [...prev, ...valid]);
    setError(null);
    setAnalysis(null);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, []);

  async function handleAnalyze() {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);

    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    formData.append('message', message || 'Analyze these reports and give me a summary with action items.');

    try {
      const res = await fetch('/api/analyze-report', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Analysis failed.');
      } else {
        setAnalysis(data.analysis);
      }
    } catch (err: any) {
      setError(err.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition',
          dragging
            ? 'border-gold bg-gold/5'
            : 'border-neutral-300 hover:border-neutral-400 bg-white'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Upload size={32} className="mx-auto mb-3 text-neutral-400" strokeWidth={1.5} />
        <p className="text-sm text-neutral-700 mb-1">
          Drop your PnL statements, sales reports, or product mix reports here
        </p>
        <p className="text-xs text-neutral-500">
          PDF, CSV, PNG, JPG, XLSX — up to 10 files at once
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded divide-y divide-neutral-100">
            {files.map((file, i) => (
              <div key={`${file.name}-${i}`} className="flex items-center gap-3 px-4 py-3">
                {fileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{file.name}</p>
                  <p className="text-xs text-neutral-500">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="text-neutral-400 hover:text-ink transition"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>

          {/* Optional context */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
              What should I focus on? (optional)
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Compare May vs April, focus on food cost %, which pizzas should I cut?"
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-ink text-cream px-6 py-2.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
            <button
              onClick={() => { setFiles([]); setAnalysis(null); setError(null); }}
              className="text-xs uppercase tracking-widest text-neutral-500 hover:text-ink transition"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Analysis result */}
      {analysis && (
        <section className="bg-white border border-neutral-200 rounded p-6">
          <h2 className="font-display text-xl mb-4">Analysis</h2>
          <div
            className="prose prose-sm max-w-none prose-headings:font-display prose-headings:tracking-wide prose-h2:text-lg prose-h3:text-base prose-strong:text-ink prose-p:text-neutral-700 prose-li:text-neutral-700"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(analysis) }}
          />
        </section>
      )}
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
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      return `<ul class="list-disc pl-5 space-y-1 my-2">${match}</ul>`;
    })
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[hul])/gm, (match) => match ? `<p>${match}` : match)
    .replace(/(<p><\/p>)/g, '');
}
