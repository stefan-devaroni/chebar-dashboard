-- Run this in Supabase SQL Editor to add department column to team_members

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT 'foh';
