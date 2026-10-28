-- One Pager documents (Oct 2026): a buyer views them through their private link (/view/<token>/docs/<name>) as
-- pages with their name across them, never as files (Stefan: view, not download). The private bucket holds one JSON
-- file of page images per document (<name>.json, made by ~/chebar-sale/prepare_docs.py and uploaded by
-- publish_one_pager.py), no PDFs. No policies: only the dashboard server (service role) reads it. A file's name
-- decides its group (docFile in lib/share-sections.ts), and a link only shows groups it includes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('one-pager-docs', 'one-pager-docs', false, 10485760, array['application/json'])
on conflict (id) do update set public = false, allowed_mime_types = array['application/json'];

-- Document views are logged with the openings: file is the document's name, null for an opening of the page
alter table share_link_views add column if not exists file text;

notify pgrst, 'reload schema';
