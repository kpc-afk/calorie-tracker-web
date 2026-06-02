create table public.meal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  items jsonb not null default '[]',
  total_calories numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.meal_templates enable row level security;
create policy "own meal templates" on public.meal_templates for all using (auth.uid() = user_id);
create index idx_meal_templates_user on public.meal_templates(user_id, created_at desc);
grant all on public.meal_templates to authenticated;
