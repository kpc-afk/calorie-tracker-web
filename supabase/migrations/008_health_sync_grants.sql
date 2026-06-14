-- service_role (used by the health-sync endpoint's admin client) was never
-- granted table privileges, matching the pattern in 003_grant_authenticated.sql.
grant all on public.user_profiles to service_role;
grant all on public.daily_activity to service_role;
grant all on public.weight_entries to service_role;
