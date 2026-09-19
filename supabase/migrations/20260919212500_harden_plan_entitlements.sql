-- Harden plan entitlements against direct REST/table writes.

-- Workspace creation must go through create_guild_workspace so callers cannot
-- choose plan_code, owner_user_id, slug or other protected columns directly.
revoke insert on table public.guilds from anon, authenticated;
revoke update on table public.guilds from anon, authenticated;
grant update (
  name,
  timezone,
  status,
  logo_url,
  attendance_mode,
  loa_deadline_local_time,
  onboarding_completed_at,
  settings,
  updated_at
) on table public.guilds to authenticated;

-- Auction-rule writes must go through update_guild_auction_rules, where the
-- FREE/GUILD/COMMANDER matrix is enforced server-side.
revoke insert, update, delete on table public.guild_auction_rules from anon, authenticated;
grant select on table public.guild_auction_rules to authenticated;

create or replace function private.enforce_discord_plan()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_plan text;
begin
  select g.plan_code into v_plan from public.guilds g where g.id = new.guild_id;
  if v_plan not in ('guild','commander','beta') then
    raise exception 'Discord operations require the GUILD plan';
  end if;
  return new;
end;
$function$;

drop trigger if exists enforce_discord_plan on public.discord_connections;
create trigger enforce_discord_plan
before insert or update on public.discord_connections
for each row execute function private.enforce_discord_plan();

revoke all on function private.enforce_discord_plan() from public, anon, authenticated;

create or replace function private.normalize_rules_after_plan_change()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  if new.plan_code = 'free' and old.plan_code is distinct from new.plan_code then
    update public.guild_auction_rules
    set
      feather_mode = case when feather_mode in ('ffa','random') then feather_mode else 'ffa' end,
      puppet_mode = case when puppet_mode in ('ffa','random') then puppet_mode else 'ffa' end,
      light_dark_feather_cap = null,
      time_space_feather_cap = null,
      puppet_fragment_cap = null,
      illusion_fragment_cap = null,
      version = version + 1,
      updated_at = now()
    where guild_id = new.id;

    delete from public.discord_connections where guild_id = new.id;
  end if;
  return new;
end;
$function$;

drop trigger if exists normalize_rules_after_plan_change on public.guilds;
create trigger normalize_rules_after_plan_change
after update of plan_code on public.guilds
for each row execute function private.normalize_rules_after_plan_change();

revoke all on function private.normalize_rules_after_plan_change() from public, anon, authenticated;
