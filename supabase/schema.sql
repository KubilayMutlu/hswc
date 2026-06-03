-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES (linked to auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade,
  full_name text,
  avatar_initials text,
  is_admin boolean default false,
  primary key (id)
);

-- MATCHES
create table if not exists matches (
  id uuid default gen_random_uuid() primary key,
  phase text,
  team_home text,
  team_away text,
  flag_home text,
  flag_away text,
  kickoff_at timestamptz,
  score_home integer,
  score_away integer,
  is_finished boolean default false
);

-- PREDICTIONS
create table if not exists predictions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  match_id uuid references matches(id) on delete cascade,
  predicted_home integer,
  predicted_away integer,
  predicted_winner text,
  points_earned integer default 0,
  created_at timestamptz default now(),
  unique(user_id, match_id)
);

-- ROW LEVEL SECURITY
alter table profiles enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;

-- PROFILES policies
create policy "Users can view all profiles"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- MATCHES policies
create policy "Authenticated users can view matches"
  on matches for select
  to authenticated
  using (true);

create policy "Admins can insert matches"
  on matches for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admins can update matches"
  on matches for update
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- PREDICTIONS policies
create policy "Users can view all predictions"
  on predictions for select
  to authenticated
  using (true);

create policy "Users can insert their own predictions"
  on predictions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own predictions"
  on predictions for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can update any prediction (for scoring)"
  on predictions for update
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- TRIGGER: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_initials, is_admin)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_initials',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
