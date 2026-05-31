create table public.user_profiles (
  id text primary key default 'me',
  user_id uuid references auth.users(id) on delete cascade not null,
  date_of_birth date not null,
  sex text not null check (sex in ('male','female')),
  height_cm numeric not null,
  weight_kg numeric not null,
  height_unit text not null default 'cm' check (height_unit in ('cm','ft')),
  weight_unit text not null default 'kg' check (weight_unit in ('kg','lbs')),
  goal text not null check (goal in ('lose','maintain','gain')),
  bmr numeric not null default 0,
  deficit_amount numeric not null default 0,
  target_calories numeric not null default 0,
  protein_target_g numeric not null default 0,
  carbs_target_g numeric not null default 0,
  fat_target_g numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  name text not null,
  brand text,
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
  note text,
  image_url text,
  commentary text,
  source text not null default 'manual' check (source in ('ai_search','ai_vision','manual')),
  created_at timestamptz not null default now()
);

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  weight_kg numeric not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  steps_count integer not null default 0,
  steps_calories numeric not null default 0,
  workout_calories numeric not null default 0,
  workout_description text,
  workout_image_urls text[] default '{}',
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

alter table public.user_profiles enable row level security;
alter table public.food_entries enable row level security;
alter table public.weight_entries enable row level security;
alter table public.daily_activity enable row level security;

create policy "own profile" on public.user_profiles for all using (auth.uid() = user_id);
create policy "own food" on public.food_entries for all using (auth.uid() = user_id);
create policy "own weight" on public.weight_entries for all using (auth.uid() = user_id);
create policy "own activity" on public.daily_activity for all using (auth.uid() = user_id);
