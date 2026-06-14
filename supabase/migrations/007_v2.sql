-- v2: budget knobs + cached insights

alter table public.user_profiles
  add column if not exists baseline_steps int not null default 5000,
  add column if not exists earn_back_rate numeric not null default 0.75;

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,        -- 'weekly_review' | 'target_suggestion'
  period_key text not null,  -- ISO week, e.g. '2026-W24'
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, type, period_key)
);

alter table public.insights enable row level security;
create policy "own insights" on public.insights for all using (auth.uid() = user_id);
create index idx_insights_user_type_period on public.insights(user_id, type, period_key);
grant all on public.insights to authenticated;
