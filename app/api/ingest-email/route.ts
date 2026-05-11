import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseRevelCsv } from '@/lib/revel-parser';

// SendGrid Inbound Parse webhook endpoint.
// Receives multipart/form-data with email fields + attachments.
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
    const attachmentCount = parseInt((formData.get('attachments') as string) ?? '0');

    // If no attachments, check for inline text/html body that might contain a report
    if (attachmentCount === 0) {
      const textBody = (formData.get('text') as string) ?? '';
      await supabase.from('report_ingestions').insert({
        sender_email: from,
        subject,
        report_type: 'unknown',
        status: 'skipped',
        file_name: null,
        records_written: 0,
        error_message: 'No CSV attachments found in email.',
        raw_data: textBody.slice(0, 5000),
      });

      return NextResponse.json({ status: 'skipped', reason: 'no attachments' });
    }

    const results: { file: string; status: string; records?: number; error?: string }[] = [];

    // Process each attachment
    for (let i = 1; i <= attachmentCount; i++) {
      const attachment = formData.get(`attachment${i}`) as File | null;
      if (!attachment) continue;

      const fileName = attachment.name ?? `attachment${i}`;
      const isCSV =
        attachment.type === 'text/csv' ||
        attachment.type === 'application/csv' ||
        fileName.endsWith('.csv') ||
        fileName.endsWith('.tsv') ||
        fileName.endsWith('.txt');

      if (!isCSV) {
        // Store non-CSV attachments (PDFs etc.) for manual review on the reports page
        const bytes = await attachment.arrayBuffer();
        const rawPreview = new TextDecoder('utf-8', { fatal: false }).decode(bytes).slice(0, 2000);

        await supabase.from('report_ingestions').insert({
          sender_email: from,
          subject,
          report_type: 'unknown',
          status: 'skipped',
          file_name: fileName,
          records_written: 0,
          error_message: `Non-CSV file (${attachment.type}). Upload manually on the Reports page for AI analysis.`,
          raw_data: rawPreview,
        });

        results.push({ file: fileName, status: 'skipped', error: 'Not a CSV file' });
        continue;
      }

      const csvText = await attachment.text();
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
          raw_data: csvText.slice(0, 10000),
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
