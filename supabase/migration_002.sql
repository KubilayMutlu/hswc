-- Leagues
create table if not exists leagues (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  code text not null unique,
  created_by uuid references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

-- League members
create table if not exists league_members (
  id uuid default gen_random_uuid() primary key,
  league_id uuid references leagues(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(league_id, user_id)
);

-- RLS
alter table leagues enable row level security;
alter table league_members enable row level security;

create policy "Authenticated users can view leagues"
  on leagues for select to authenticated using (true);

create policy "Authenticated users can create leagues"
  on leagues for insert to authenticated
  with check (auth.uid() = created_by);

create policy "Users can view league members"
  on league_members for select to authenticated using (true);

create policy "Users can join leagues"
  on league_members for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can leave leagues"
  on league_members for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert on leagues to authenticated;
grant select, insert, delete on league_members to authenticated;
