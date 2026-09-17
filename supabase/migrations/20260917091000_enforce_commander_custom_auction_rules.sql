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
  v_plan_code text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not (
    private.is_guild_owner(p_guild_id)
    or exists (
      select 1 from public.guild_users gu
      where gu.guild_id = p_guild_id and gu.user_id = v_user_id and gu.role in ('owner','officer')
    )
  ) then raise exception 'Officer access required'; end if;

  select plan_code into v_plan_code from public.guilds where id=p_guild_id;
  if v_plan_code is null then raise exception 'Guild not found'; end if;

  if p_feather_mode not in ('ffa','four_group','random','custom') then raise exception 'Invalid feather mode'; end if;
  if p_puppet_mode not in ('ffa','round_robin','random','custom') then raise exception 'Invalid puppet mode'; end if;
  if (p_feather_mode='custom' or p_puppet_mode='custom') and v_plan_code not in ('commander','beta') then
    raise exception 'Custom auction rules require the COMMANDER plan';
  end if;
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
