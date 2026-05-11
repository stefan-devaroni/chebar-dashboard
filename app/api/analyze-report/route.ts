import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a restaurant operations analyst for Che Bar, a breakfast-by-day / pizza-and-cocktails-by-night restaurant in Aruba. The owner is uploading financial documents for you to analyze.

When given a document (PnL statement, sales report, product mix report, or other financial data), provide:

1. **Key Numbers** — Revenue, COGS, labor, net profit (or whatever applies). Show the most important figures front and center.
2. **Trends & Comparisons** — Period-over-period changes, seasonality, day-of-week patterns. Call out what's improving and what's declining.
3. **Product Insights** — Best/worst sellers, margin winners, items to consider cutting or promoting. Especially flag low-volume items that complicate prep.
4. **Daypart Breakdown** — If data allows, split insights into Mornings (breakfast/brunch) vs Nights (pizza/cocktails/music).
5. **Action Items** — 3-5 specific, actionable recommendations. Be concrete ("Reprice X from $14 to $16" not "consider adjusting prices").
6. **Red Flags** — Anything concerning: cost overruns, shrinking margins, anomalies.

Keep it concise and practical. Use AWG (Aruban Florin) or USD as the document indicates. Format with markdown.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured. Add it to your .env.local file.' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const userMessage = (formData.get('message') as string) || 'Analyze this report.';

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
    }

    const contentBlocks: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const mimeType = file.type;

      if (mimeType === 'application/pdf') {
        contentBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64,
          },
        } as any);
      } else if (mimeType.startsWith('image/')) {
        const imageType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageType,
            data: base64,
          },
        });
      } else if (
        mimeType === 'text/csv' ||
        mimeType === 'text/plain' ||
        mimeType === 'application/vnd.ms-excel' ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.tsv')
      ) {
        const text = new TextDecoder().decode(bytes);
        contentBlocks.push({
          type: 'text',
          text: `--- File: ${file.name} ---\n${text}`,
        });
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.name.endsWith('.xlsx')
      ) {
        contentBlocks.push({
          type: 'text',
          text: `[Excel file: ${file.name} — ${(bytes.byteLength / 1024).toFixed(0)} KB. For best results, export as CSV and re-upload.]`,
        });
      } else {
        contentBlocks.push({
          type: 'text',
          text: `[Unsupported file type: ${file.name} (${mimeType}). Supported: PDF, CSV, TXT, PNG, JPG]`,
        });
      }
    }

    contentBlocks.push({
      type: 'text',
      text: userMessage,
    });

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contentBlocks }],
    });

    const analysisText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return NextResponse.json({ analysis: analysisText });
  } catch (err: any) {
    console.error('Analysis error:', err);
    return NextResponse.json(
      { error: err.message || 'Analysis failed.' },
      { status: 500 }
    );
  }
}
