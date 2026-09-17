create table if not exists public.guild_auction_rules (
  guild_id uuid primary key references public.guilds(id) on delete cascade,
  feather_mode text not null default 'ffa',
  puppet_mode text not null default 'round_robin',
  light_dark_feather_cap integer,
  time_space_feather_cap integer,
  puppet_fragment_cap integer,
  illusion_fragment_cap integer,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_auction_rules_feather_mode_check check (feather_mode in ('ffa','four_group','random','custom')),
  constraint guild_auction_rules_puppet_mode_check check (puppet_mode in ('ffa','round_robin','random','custom')),
  constraint guild_auction_rules_ld_cap_check check (light_dark_feather_cap is null or light_dark_feather_cap >= 0),
  constraint guild_auction_rules_ts_cap_check check (time_space_feather_cap is null or time_space_feather_cap >= 0),
  constraint guild_auction_rules_puppet_cap_check check (puppet_fragment_cap is null or puppet_fragment_cap >= 0),
  constraint guild_auction_rules_illusion_cap_check check (illusion_fragment_cap is null or illusion_fragment_cap >= 0)
);

alter table public.guild_auction_rules enable row level security;

create policy "guild users read auction rules"
on public.guild_auction_rules for select to authenticated
using (private.is_guild_member(guild_id) or private.is_guild_owner(guild_id));

create policy "guild managers manage auction rules"
on public.guild_auction_rules for all to authenticated
using (
  private.is_guild_owner(guild_id)
  or exists (
    select 1 from public.guild_users gu
    where gu.guild_id = guild_auction_rules.guild_id
      and gu.user_id = auth.uid()
      and gu.role in ('owner','officer')
  )
)
with check (
  private.is_guild_owner(guild_id)
  or exists (
    select 1 from public.guild_users gu
    where gu.guild_id = guild_auction_rules.guild_id
      and gu.user_id = auth.uid()
      and gu.role in ('owner','officer')
  )
);

insert into public.guild_auction_rules(guild_id, feather_mode, puppet_mode)
select g.id,
       case when lower(g.name) = 'havoc' then 'four_group' else 'ffa' end,
       'round_robin'
from public.guilds g
on conflict (guild_id) do nothing;

alter table public.auction_runs
  add column if not exists rules_snapshot jsonb not null default '{}'::jsonb;

create or replace function public.current_guild_auction_rules(p_guild_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select jsonb_build_object(
    'version', r.version,
    'feather_mode', r.feather_mode,
    'puppet_mode', r.puppet_mode,
    'caps', jsonb_build_object(
      'light_dark_feather', r.light_dark_feather_cap,
      'time_space_feather', r.time_space_feather_cap,
      'puppet_fragment', r.puppet_fragment_cap,
      'illusion_fragment', r.illusion_fragment_cap
    ),
    'snapshotted_at', now()
  )
  from public.guild_auction_rules r
  where r.guild_id = p_guild_id
$function$;

revoke all on function public.current_guild_auction_rules(uuid) from public;
grant execute on function public.current_guild_auction_rules(uuid) to authenticated;

create or replace function public.snapshot_auction_run_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_guild_id uuid;
  v_rules jsonb;
begin
  if new.rules_snapshot is null or new.rules_snapshot = '{}'::jsonb then
    select e.guild_id into v_guild_id from public.guild_events e where e.id = new.event_id;
    if v_guild_id is null then raise exception 'Event not found'; end if;
    select public.current_guild_auction_rules(v_guild_id) into v_rules;
    if v_rules is null then
      v_rules := jsonb_build_object(
        'version', 1,
        'feather_mode', 'ffa',
        'puppet_mode', 'round_robin',
        'caps', jsonb_build_object(
          'light_dark_feather', null,
          'time_space_feather', null,
          'puppet_fragment', null,
          'illusion_fragment', null
        ),
        'snapshotted_at', now()
      );
    end if;
    new.rules_snapshot := v_rules;
  end if;
  return new;
end;
$function$;

drop trigger if exists auction_runs_snapshot_rules on public.auction_runs;
create trigger auction_runs_snapshot_rules
before insert on public.auction_runs
for each row execute function public.snapshot_auction_run_rules();

create or replace function public.enforce_auction_allocation_cap()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_key text;
  v_cap integer;
  v_existing integer;
  v_snapshot jsonb;
begin
  v_key := case new.category
    when 'light_dark_feather' then 'light_dark_feather'
    when 'ld_feather' then 'light_dark_feather'
    when 'light_dark' then 'light_dark_feather'
    when 'time_space_feather' then 'time_space_feather'
    when 'ts_feather' then 'time_space_feather'
    when 'time_space' then 'time_space_feather'
    when 'puppet_fragment' then 'puppet_fragment'
    when 'puppet' then 'puppet_fragment'
    when 'illusion_fragment' then 'illusion_fragment'
    when 'illusion' then 'illusion_fragment'
    else null
  end;

  if v_key is null then return new; end if;

  select ar.rules_snapshot into v_snapshot
  from public.auction_runs ar where ar.id = new.auction_run_id;

  v_cap := nullif(v_snapshot #>> array['caps', v_key], '')::integer;
  if v_cap is null then return new; end if;

  select coalesce(sum(a.quantity), 0) into v_existing
  from public.auction_allocations a
  where a.auction_run_id = new.auction_run_id
    and a.guild_member_id = new.guild_member_id
    and a.id <> new.id
    and (case a.category
      when 'light_dark_feather' then 'light_dark_feather'
      when 'ld_feather' then 'light_dark_feather'
      when 'light_dark' then 'light_dark_feather'
      when 'time_space_feather' then 'time_space_feather'
      when 'ts_feather' then 'time_space_feather'
      when 'time_space' then 'time_space_feather'
      when 'puppet_fragment' then 'puppet_fragment'
      when 'puppet' then 'puppet_fragment'
      when 'illusion_fragment' then 'illusion_fragment'
      when 'illusion' then 'illusion_fragment'
      else null end) = v_key;

  if v_existing + new.quantity > v_cap then
    raise exception 'Allocation exceeds % cap of % per person for this auction', v_key, v_cap;
  end if;

  return new;
end;
$function$;

drop trigger if exists auction_allocations_enforce_cap on public.auction_allocations;
create trigger auction_allocations_enforce_cap
before insert or update on public.auction_allocations
for each row execute function public.enforce_auction_allocation_cap();

create or replace function public.update_guild_auction_rules(
  p_guild_id uuid,
  p_feather_mode text,
  p_puppet_mode text,
  p_light_dark_feather_cap integer default null,
  p_time_space_feather_cap integer default null,
  p_puppet_fragment_cap integer default null,
  p_illusion_fragment_cap integer default null
)
returns void
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not (
    private.is_guild_owner(p_guild_id)
    or exists (
      select 1 from public.guild_users gu
      where gu.guild_id = p_guild_id and gu.user_id = v_user_id and gu.role in ('owner','officer')
    )
  ) then raise exception 'Officer access required'; end if;

  if p_feather_mode not in ('ffa','four_group','random','custom') then raise exception 'Invalid feather mode'; end if;
  if p_puppet_mode not in ('ffa','round_robin','random','custom') then raise exception 'Invalid puppet mode'; end if;
  if coalesce(p_light_dark_feather_cap,0) < 0 or coalesce(p_time_space_feather_cap,0) < 0 or coalesce(p_puppet_fragment_cap,0) < 0 or coalesce(p_illusion_fragment_cap,0) < 0 then
    raise exception 'Caps cannot be negative';
  end if;

  insert into public.guild_auction_rules(
    guild_id, feather_mode, puppet_mode,
    light_dark_feather_cap, time_space_feather_cap,
    puppet_fragment_cap, illusion_fragment_cap,
    version, updated_at
  ) values (
    p_guild_id, p_feather_mode, p_puppet_mode,
    p_light_dark_feather_cap, p_time_space_feather_cap,
    p_puppet_fragment_cap, p_illusion_fragment_cap,
    1, now()
  )
  on conflict (guild_id) do update set
    feather_mode = excluded.feather_mode,
    puppet_mode = excluded.puppet_mode,
    light_dark_feather_cap = excluded.light_dark_feather_cap,
    time_space_feather_cap = excluded.time_space_feather_cap,
    puppet_fragment_cap = excluded.puppet_fragment_cap,
    illusion_fragment_cap = excluded.illusion_fragment_cap,
    version = public.guild_auction_rules.version + 1,
    updated_at = now();
end;
$function$;

revoke all on function public.update_guild_auction_rules(uuid,text,text,integer,integer,integer,integer) from public;
grant execute on function public.update_guild_auction_rules(uuid,text,text,integer,integer,integer,integer) to authenticated;
