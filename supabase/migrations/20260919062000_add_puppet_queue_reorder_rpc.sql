create or replace function public.move_puppet_queue_member(p_guild_id uuid, p_member_id uuid, p_direction text)
returns void
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_current_position integer;
  v_target_member uuid;
  v_target_position integer;
  v_temp_position integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_direction not in ('up','down') then raise exception 'Direction must be up or down'; end if;
  if not (private.is_guild_owner(p_guild_id) or exists(
    select 1 from public.guild_users gu
    where gu.guild_id=p_guild_id and gu.user_id=v_user and gu.role in ('owner','officer')
  )) then raise exception 'Officer access required'; end if;

  select position into v_current_position
  from public.puppet_queue
  where guild_id=p_guild_id and guild_member_id=p_member_id and is_active
  for update;
  if v_current_position is null then raise exception 'Active Puppet queue member not found'; end if;

  if p_direction='up' then
    select guild_member_id,position into v_target_member,v_target_position
    from public.puppet_queue
    where guild_id=p_guild_id and is_active and position<v_current_position
    order by position desc limit 1 for update;
  else
    select guild_member_id,position into v_target_member,v_target_position
    from public.puppet_queue
    where guild_id=p_guild_id and is_active and position>v_current_position
    order by position asc limit 1 for update;
  end if;

  if v_target_member is null then return; end if;

  select coalesce(max(position),0)+1000000 into v_temp_position
  from public.puppet_queue where guild_id=p_guild_id;

  update public.puppet_queue set position=v_temp_position,updated_at=now()
  where guild_id=p_guild_id and guild_member_id=p_member_id;
  update public.puppet_queue set position=v_current_position,updated_at=now()
  where guild_id=p_guild_id and guild_member_id=v_target_member;
  update public.puppet_queue set position=v_target_position,updated_at=now()
  where guild_id=p_guild_id and guild_member_id=p_member_id;

  update public.guild_members set puppet_order=v_target_position,updated_at=now()
  where guild_id=p_guild_id and id=p_member_id;
  update public.guild_members set puppet_order=v_current_position,updated_at=now()
  where guild_id=p_guild_id and id=v_target_member;
end;
$function$;

revoke all on function public.move_puppet_queue_member(uuid,uuid,text) from public, anon;
grant execute on function public.move_puppet_queue_member(uuid,uuid,text) to authenticated;
