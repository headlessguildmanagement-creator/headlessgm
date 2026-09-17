create or replace function public.replace_auction_draft(
  p_event_id uuid,
  p_input_data jsonb,
  p_generated_output jsonb,
  p_allocations jsonb default '[]'::jsonb,
  p_active_feather_group_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_guild uuid;
  v_run uuid;
  v_status text;
  a record;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select guild_id into v_guild from public.guild_events where id=p_event_id;
  if v_guild is null then raise exception 'Event not found'; end if;
  if not (private.is_guild_owner(v_guild) or exists(select 1 from public.guild_users gu where gu.guild_id=v_guild and gu.user_id=v_user and gu.role in ('owner','officer'))) then raise exception 'Officer access required'; end if;

  select id,status into v_run,v_status from public.auction_runs where event_id=p_event_id for update;
  if v_run is not null and v_status <> 'draft' then raise exception 'Published/completed auctions cannot be regenerated'; end if;

  if v_run is null then
    insert into public.auction_runs(event_id,status,active_feather_group_id,input_data,generated_output,generated_by_user_id,generated_at,updated_at)
    values(p_event_id,'draft',p_active_feather_group_id,coalesce(p_input_data,'{}'::jsonb),coalesce(p_generated_output,'{}'::jsonb),v_user,now(),now())
    returning id into v_run;
  else
    update public.auction_runs set active_feather_group_id=p_active_feather_group_id,input_data=coalesce(p_input_data,'{}'::jsonb),generated_output=coalesce(p_generated_output,'{}'::jsonb),generated_by_user_id=v_user,generated_at=now(),updated_at=now() where id=v_run;
    delete from public.auction_allocations where auction_run_id=v_run;
  end if;

  for a in select * from jsonb_to_recordset(coalesce(p_allocations,'[]'::jsonb)) as x(guild_member_id uuid,category text,quantity integer,source text,metadata jsonb)
  loop
    if not exists(select 1 from public.guild_members gm where gm.id=a.guild_member_id and gm.guild_id=v_guild) then raise exception 'Allocation member does not belong to event guild'; end if;
    insert into public.auction_allocations(auction_run_id,guild_member_id,category,quantity,source,metadata)
    values(v_run,a.guild_member_id,a.category,a.quantity,coalesce(a.source,'base'),coalesce(a.metadata,'{}'::jsonb));
  end loop;

  return v_run;
end;
$function$;

revoke all on function public.replace_auction_draft(uuid,jsonb,jsonb,jsonb,uuid) from public;
grant execute on function public.replace_auction_draft(uuid,jsonb,jsonb,jsonb,uuid) to authenticated;
