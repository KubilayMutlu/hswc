-- Migration 001: Add external_id and status columns to matches

alter table matches add column if not exists external_id integer unique;
alter table matches add column if not exists status text default 'SCHEDULED';

-- Index for faster lookups by external_id
create index if not exists matches_external_id_idx on matches(external_id);

-- Update existing rows to have SCHEDULED status if null
update matches set status = 'SCHEDULED' where status is null;
