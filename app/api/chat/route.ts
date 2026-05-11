import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a restaurant operations analyst for Ché Bar, a breakfast-by-day / pizza-and-cocktails-by-night restaurant in Aruba. The owner is asking you questions about their business performance.

You have access to their daily sales metrics data which is provided below. Use this data to answer questions accurately. When referencing numbers, be specific — cite dates, amounts, and percentages.

Keep answers concise and practical. Use AWG or USD as appropriate. Format with markdown when helpful (bold key numbers, use bullet points for lists).

If the data doesn't contain enough information to answer a question, say so honestly and suggest what data would help.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { question, history } = await request.json();
    if (!question) {
      return NextResponse.json({ error: 'No question provided.' }, { status: 400 });
    }

    const { data: metrics } = await supabase
      .from('daily_metrics')
      .select('*')
      .order('date', { ascending: false })
      .limit(90);

    const { data: recentIngestions } = await supabase
      .from('report_ingestions')
      .select('received_at, report_type, status, file_name, ai_summary')
      .eq('status', 'processed')
      .order('received_at', { ascending: false })
      .limit(10);

    let dataContext = '';

    if (metrics && metrics.length > 0) {
      const rows = metrics.map((m: any) =>
        `${m.date} | rev: $${m.revenue_total ?? 0} (bkfst: $${m.revenue_breakfast ?? 0}, lunch: $${m.revenue_lunch ?? 0}, dinner: $${m.revenue_dinner ?? 0}) | covers: ${m.covers_total ?? 0} | labor: $${m.labor_cost ?? 0}${m.music_night ? ' | music night' : ''}`
      );
      dataContext += `\n\nDAILY METRICS (last ${metrics.length} days, newest first):\n${rows.join('\n')}`;
    } else {
      dataContext += '\n\nNo daily metrics data available yet.';
    }

    if (recentIngestions && recentIngestions.length > 0) {
      const summaries = recentIngestions
        .filter((r: any) => r.ai_summary)
        .map((r: any) => `[${r.received_at}] ${r.report_type}: ${r.ai_summary}`)
        .join('\n');
      if (summaries) {
        dataContext += `\n\nRECENT REPORT SUMMARIES:\n${summaries}`;
      }
    }

    const messages: Anthropic.MessageParam[] = [];

    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: question });

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT + dataContext,
      messages,
    });

    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error('Chat error:', err);
    return NextResponse.json({ error: err.message || 'Chat failed.' }, { status: 500 });
  }
}
