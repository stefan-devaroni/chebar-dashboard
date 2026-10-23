import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseRevelCsv } from '@/lib/revel-parser';
import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL } from '@/lib/ai';
import { readInboundEmail, type InboundFile } from '@/lib/inbound-email';

// SendGrid Inbound Parse webhook endpoint for mail to anything@ingest.chebararuba.com
// (MX -> mx.sendgrid.net). Receives multipart/form-data with email fields + attachments.
// Docs: https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook

export async function POST(request: NextRequest) {
  // Verify shared secret (passed as query param or header)
  const secret = request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.INGEST_EMAIL_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const formData = await request.formData();

    const from = (formData.get('from') as string) ?? '';
    const subject = (formData.get('subject') as string) ?? '';
    const { files, text: textBody } = await readInboundEmail(formData);

    // If no attachments, keep the body and the fields SendGrid sent, to see what arrived
    if (files.length === 0) {
      await supabase.from('report_ingestions').insert({
        sender_email: from,
        subject,
        report_type: 'unknown',
        status: 'skipped',
        file_name: null,
        records_written: 0,
        error_message: `No attachments found in email (fields received: ${Array.from(new Set(formData.keys())).join(', ')}).`,
        raw_data: textBody.slice(0, 5000),
      });

      return NextResponse.json({ status: 'skipped', reason: 'no attachments' });
    }

    const results: { file: string; status: string; records?: number; error?: string }[] = [];

    // Process each attachment
    for (const attachment of files) {
      const fileName = attachment.name;
      const isCSV =
        attachment.type === 'text/csv' ||
        attachment.type === 'application/csv' ||
        fileName.endsWith('.csv') ||
        fileName.endsWith('.tsv') ||
        fileName.endsWith('.txt');

      const isPDF =
        attachment.type === 'application/pdf' || fileName.endsWith('.pdf');

      if (isPDF) {
        const pdfResult = await parsePdfWithClaude(attachment, from, subject, supabase);
        results.push(pdfResult);
        continue;
      }

      if (!isCSV) {
        const rawPreview = new TextDecoder('utf-8', { fatal: false }).decode(attachment.bytes).slice(0, 2000);

        await supabase.from('report_ingestions').insert({
          sender_email: from,
          subject,
          report_type: 'unknown',
          status: 'skipped',
          file_name: fileName,
          records_written: 0,
          error_message: `Unsupported file type (${attachment.type}). Upload manually on the Reports page.`,
          raw_data: rawPreview,
        });

        results.push({ file: fileName, status: 'skipped', error: 'Unsupported file type' });
        continue;
      }

      const csvText = new TextDecoder('utf-8').decode(attachment.bytes);
      const parsed = parseRevelCsv(csvText, fileName);

      if (parsed.type === 'daily_sales') {
        let recordsWritten = 0;
        const errors: string[] = [];

        for (const day of parsed.data) {
          const { error } = await supabase.from('daily_metrics').upsert(
            {
              date: day.date,
              revenue_total: day.revenue_total,
              revenue_breakfast: day.revenue_breakfast,
              revenue_lunch: day.revenue_lunch,
              revenue_dinner: day.revenue_dinner,
              covers_total: day.covers_total,
              covers_breakfast: day.covers_breakfast,
              covers_lunch: day.covers_lunch,
              covers_dinner: day.covers_dinner,
              labor_cost: day.labor_cost,
              entered_by: 'revel-auto',
            },
            { onConflict: 'date' }
          );
          if (error) {
            errors.push(`${day.date}: ${error.message}`);
          } else {
            recordsWritten++;
          }
        }

        await supabase.from('report_ingestions').insert({
          sender_email: from,
          subject,
          report_type: 'daily_sales',
          status: errors.length > 0 ? 'failed' : 'processed',
          file_name: fileName,
          records_written: recordsWritten,
          error_message: errors.length > 0 ? errors.join('; ') : null,
          raw_data: csvText.slice(0, 5000),
        });

        results.push({ file: fileName, status: 'processed', records: recordsWritten });

      } else if (parsed.type === 'product_mix') {
        // Store product mix data as raw for now (can build a product_mix table later)
        const summary = parsed.data.items
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10)
          .map((item) => `${item.name}: ${item.quantity} sold, $${item.revenue.toFixed(0)}`)
          .join('\n');

        await supabase.from('report_ingestions').insert({
          sender_email: from,
          subject,
          report_type: 'product_mix',
          status: 'processed',
          file_name: fileName,
          records_written: parsed.data.items.length,
          ai_summary: `Top 10 items:\n${summary}`,
          raw_data: csvText.slice(0, 200000),
        });

        results.push({ file: fileName, status: 'processed', records: parsed.data.items.length });

      } else {
        await supabase.from('report_ingestions').insert({
          sender_email: from,
          subject,
          report_type: 'unknown',
          status: 'skipped',
          file_name: fileName,
          records_written: 0,
          error_message: 'Could not identify report format. Upload manually on the Reports page.',
          raw_data: csvText.slice(0, 5000),
        });

        results.push({ file: fileName, status: 'skipped', error: 'Unknown format' });
      }
    }

    return NextResponse.json({ status: 'ok', results });
  } catch (err: any) {
    console.error('Ingest error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function parsePdfWithClaude(
  attachment: InboundFile,
  from: string,
  subject: string,
  supabase: any
) {
  const fileName = attachment.name;
  const base64 = Buffer.from(attachment.bytes).toString('base64');

  const anthropic = new Anthropic({ apiKey: process.env.API_KEY_ANTHROPIC! });

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text: `Extract structured data from this Revel POS restaurant report PDF.

Determine the report type and return ONLY valid JSON (no markdown, no backticks):

For a daily sales / sales summary report:
{
  "type": "daily_sales",
  "data": [
    {
      "date": "YYYY-MM-DD",
      "revenue_total": number,
      "revenue_breakfast": number or 0,
      "revenue_lunch": number or 0,
      "revenue_dinner": number or 0,
      "covers_total": number or 0,
      "covers_breakfast": number or 0,
      "covers_lunch": number or 0,
      "covers_dinner": number or 0,
      "labor_cost": number or 0
    }
  ]
}

For a product mix report:
{
  "type": "product_mix",
  "items": [
    { "name": "Item Name", "category": "Category", "quantity": number, "revenue": number }
  ]
}

If you can't determine the type or extract data, return:
{ "type": "unknown", "summary": "brief description of what the PDF contains" }

Rules:
- Use net sales for revenue when available, otherwise gross sales
- Daypart names vary: morning/breakfast, lunch/afternoon, dinner/evening — map accordingly
- If only a single total revenue is shown without daypart breakdown, put it in revenue_total and set dayparts to 0
- Dates must be ISO format YYYY-MM-DD
- Return raw numbers, no currency symbols or commas`,
          },
        ],
      },
    ],
  });

  // Read the text by block type: the reply can start with a thinking block.
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  try {
    const parsed = JSON.parse(text);

    if (parsed.type === 'daily_sales' && Array.isArray(parsed.data)) {
      let recordsWritten = 0;
      const errors: string[] = [];

      for (const day of parsed.data) {
        const { error } = await supabase.from('daily_metrics').upsert(
          {
            date: day.date,
            revenue_total: day.revenue_total ?? 0,
            revenue_breakfast: day.revenue_breakfast ?? 0,
            revenue_lunch: day.revenue_lunch ?? 0,
            revenue_dinner: day.revenue_dinner ?? 0,
            covers_total: day.covers_total ?? 0,
            covers_breakfast: day.covers_breakfast ?? 0,
            covers_lunch: day.covers_lunch ?? 0,
            covers_dinner: day.covers_dinner ?? 0,
            labor_cost: day.labor_cost ?? 0,
            entered_by: 'revel-pdf-auto',
          },
          { onConflict: 'date' }
        );
        if (error) {
          errors.push(`${day.date}: ${error.message}`);
        } else {
          recordsWritten++;
        }
      }

      await supabase.from('report_ingestions').insert({
        sender_email: from,
        subject,
        report_type: 'daily_sales',
        status: errors.length > 0 ? 'failed' : 'processed',
        file_name: fileName,
        records_written: recordsWritten,
        error_message: errors.length > 0 ? errors.join('; ') : null,
        raw_data: text.slice(0, 10000),
      });

      return { file: fileName, status: 'processed', records: recordsWritten };

    } else if (parsed.type === 'product_mix' && Array.isArray(parsed.items)) {
      const summary = parsed.items
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((item: any) => `${item.name}: ${item.quantity} sold, $${item.revenue.toFixed(0)}`)
        .join('\n');

      await supabase.from('report_ingestions').insert({
        sender_email: from,
        subject,
        report_type: 'product_mix',
        status: 'processed',
        file_name: fileName,
        records_written: parsed.items.length,
        ai_summary: `Top 10 items:\n${summary}`,
        raw_data: text.slice(0, 200000),
      });

      return { file: fileName, status: 'processed', records: parsed.items.length };

    } else {
      await supabase.from('report_ingestions').insert({
        sender_email: from,
        subject,
        report_type: 'unknown',
        status: 'processed',
        file_name: fileName,
        records_written: 0,
        ai_summary: parsed.summary ?? text.slice(0, 2000),
        raw_data: text.slice(0, 10000),
      });

      return { file: fileName, status: 'processed', records: 0 };
    }
  } catch {
    await supabase.from('report_ingestions').insert({
      sender_email: from,
      subject,
      report_type: 'unknown',
      status: 'failed',
      file_name: fileName,
      records_written: 0,
      error_message: response.stop_reason === 'refusal'
        ? 'Claude declined to read this PDF.'
        : 'Failed to parse Claude response as JSON',
      raw_data: text.slice(0, 5000),
    });

    return { file: fileName, status: 'failed', error: 'PDF parsing failed' };
  }
}
