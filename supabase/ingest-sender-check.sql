-- Email import sender check (Nov 2026). Every mail to any address @ingest.chebararuba.com reaches
-- /api/ingest-email, so the route only reads mail from Revel's report address and the owners' own
-- addresses (lib/inbound-sender.ts); anything else is logged as skipped and its attachments are
-- never opened or kept.
--
-- A From line can be forged. SendGrid also reports whether SPF and DKIM passed; those results are
-- kept with every email here, so we can see what Revel's mails carry before requiring a pass.
-- Shape: {"spf": "pass", "dkim": "{@revelsystems.com : pass}", "envelope_from": "...",
--         "confirmed_by": ["dkim", "spf"]}   (confirmed_by = which ones vouch for the From domain)

alter table report_ingestions add column if not exists sender_auth jsonb;

comment on column report_ingestions.sender_auth is
  'SPF/DKIM results SendGrid reported for this email, and which of them confirm the From domain (lib/inbound-sender.ts)';
