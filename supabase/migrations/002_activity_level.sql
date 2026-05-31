alter table public.user_profiles
  add column if not exists activity_level text not null default 'sedentary'
    check (activity_level in ('sedentary','lightly_active','moderately_active','very_active','extra_active')),
  add column if not exists tdee numeric not null default 0;

-- Back-fill TDEE for any existing rows using sedentary multiplier (1.2)
update public.user_profiles set tdee = round(bmr * 1.2) where tdee = 0;
