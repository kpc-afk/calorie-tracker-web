create table public.saved_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  serving_size text not null,
  serving_unit text not null,
  calories numeric not null,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  sugar numeric not null default 0,
  sodium numeric not null default 0,
  saturated_fat numeric not null default 0,
  cholesterol numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.saved_foods enable row level security;
create policy "own saved foods" on public.saved_foods for all using (auth.uid() = user_id);

create index idx_saved_foods_user on public.saved_foods(user_id, created_at desc);

grant all on public.saved_foods to authenticated;
