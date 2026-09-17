create or replace function public.import_guild_roster(p_guild_id uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan_limit integer;
  v_existing_active integer;
  v_import_active integer;
  v_preset_id text;
  v_feather_mode text;
  v_puppet_mode text;
  v_inserted integer := 0;
  r record;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Roster payload must be an array'; end if;

  if not (
    private.is_guild_owner(p_guild_id)
    or exists (
      select 1 from public.guild_users gu
      where gu.guild_id = p_guild_id and gu.user_id = v_user_id and gu.role in ('owner','officer')
    )
  ) then raise exception 'Officer access required'; end if;

  select g.game_preset_id, p.active_member_limit
    into v_preset_id, v_plan_limit
  from public.guilds g
  join public.plans p on p.code = g.plan_code
  where g.id = p_guild_id;

  if v_preset_id is null then raise exception 'Guild not found'; end if;

  select feather_mode, puppet_mode into v_feather_mode, v_puppet_mode
  from public.guild_auction_rules where guild_id = p_guild_id;

  select count(*) into v_existing_active from public.guild_members where guild_id = p_guild_id and status = 'active';
  select count(*) into v_import_active
  from jsonb_to_recordset(p_rows) as x(status text)
  where coalesce(x.status, 'active') = 'active';

  if v_existing_active + v_import_active > v_plan_limit then
    raise exception 'Import would exceed active member limit of %', v_plan_limit;
  end if;

  if exists (
    select 1 from (
      select lower(btrim(x.ign)) ign_key, count(*) c
      from jsonb_to_recordset(p_rows) as x(ign text)
      group by lower(btrim(x.ign)) having count(*) > 1
    ) d
  ) then raise exception 'Import contains duplicate IGN values'; end if;

  if exists (
    select 1 from jsonb_to_recordset(p_rows) as x(ign text)
    join public.guild_members gm on gm.guild_id = p_guild_id and lower(gm.ign) = lower(btrim(x.ign))
  ) then raise exception 'One or more IGN values already exist in this guild'; end if;

  for r in
    select * from jsonb_to_recordset(p_rows) as x(
      ign text,
      job_code text,
      combat_role text,
      guild_role text,
      feather_group integer,
      puppet_order integer,
      status text
    )
  loop
    r.ign := btrim(r.ign);
    if r.ign is null or char_length(r.ign) < 1 or char_length(r.ign) > 80 then raise exception 'Every row needs a valid IGN'; end if;
    if r.status is null then r.status := 'active'; end if;
    if r.status not in ('active','pending') then raise exception 'Import status must be active or pending'; end if;
    if r.combat_role is not null and r.combat_role not in ('DPS','Support','Utility','Tank') then raise exception 'Invalid combat role for %', r.ign; end if;
    if r.job_code is not null and not exists (
      select 1 from public.game_jobs j where j.game_preset_id = v_preset_id and j.code = r.job_code and j.is_active
    ) then raise exception 'Unknown class/job code % for %', r.job_code, r.ign; end if;
    if v_feather_mode = 'four_group' and (r.feather_group is null or r.feather_group not between 1 and 4) then
      raise exception 'FeatherGroup 1-4 is required for % because this guild uses 4 Group Division', r.ign;
    end if;
    if r.puppet_order is not null and r.puppet_order < 1 then raise exception 'PuppetOrder must be 1 or greater for %', r.ign; end if;

    insert into public.guild_members(
      guild_id, ign, job_code, combat_role, guild_role, feather_group, puppet_order, status, is_officer
    ) values (
      p_guild_id, r.ign, r.job_code, r.combat_role, nullif(btrim(r.guild_role), ''), r.feather_group, r.puppet_order, r.status,
      lower(coalesce(r.guild_role,'')) in ('officer','commander','vice guild leader','guild leader')
    );
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$function$;

revoke all on function public.import_guild_roster(uuid,jsonb) from public;
grant execute on function public.import_guild_roster(uuid,jsonb) to authenticated;
