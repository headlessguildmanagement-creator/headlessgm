create or replace function public.invalidate_auction_draft(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_guild uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select guild_id into v_guild from public.guild_events where id=p_event_id;
  if v_guild is null then raise exception 'Event not found'; end if;
  if not private.is_guild_manager(v_guild) then raise exception 'Officer access required'; end if;
  delete from public.auction_runs where event_id=p_event_id and status='draft';
end;
$function$;

revoke all on function public.invalidate_auction_draft(uuid) from public,anon;
grant execute on function public.invalidate_auction_draft(uuid) to authenticated;
