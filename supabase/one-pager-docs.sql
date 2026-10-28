-- One Pager documents (Oct 2026): PDFs a buyer downloads through their private link (/view/<token>/docs/<name>),
-- each copy with their name on every page. Private bucket and no policies: only the dashboard server (service role)
-- reads it. ~/chebar-sale/publish_one_pager.py uploads the files; a file's name decides its group (docFile in
-- lib/share-sections.ts), and a link only hands out groups it shows.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('one-pager-docs', 'one-pager-docs', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Downloads are logged with the openings: file is the document's name, null for an opening of the page
alter table share_link_views add column if not exists file text;

notify pgrst, 'reload schema';
