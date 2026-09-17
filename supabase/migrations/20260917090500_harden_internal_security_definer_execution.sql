revoke all on function public.enforce_auction_allocation_cap() from public, anon, authenticated;
revoke all on function public.guard_auction_allocation_edit() from public, anon, authenticated;
revoke all on function public.snapshot_auction_run_rules() from public, anon, authenticated;
revoke all on function public.sync_member_puppet_queue() from public, anon, authenticated;

grant execute on function public.enforce_auction_allocation_cap() to service_role;
grant execute on function public.guard_auction_allocation_edit() to service_role;
grant execute on function public.snapshot_auction_run_rules() to service_role;
grant execute on function public.sync_member_puppet_queue() to service_role;

revoke all on function public.create_guild_workspace(text,text) from public, anon;
grant execute on function public.create_guild_workspace(text,text) to authenticated, service_role;

revoke all on function public.current_guild_auction_rules(uuid) from public, anon;
grant execute on function public.current_guild_auction_rules(uuid) to authenticated, service_role;

revoke all on function public.import_guild_roster(uuid,jsonb) from public, anon;
grant execute on function public.import_guild_roster(uuid,jsonb) to authenticated, service_role;

revoke all on function public.replace_auction_draft(uuid,jsonb,jsonb,jsonb,uuid) from public, anon;
grant execute on function public.replace_auction_draft(uuid,jsonb,jsonb,jsonb,uuid) to authenticated, service_role;

revoke all on function public.publish_auction_run(uuid) from public, anon;
grant execute on function public.publish_auction_run(uuid) to authenticated, service_role;

revoke all on function public.finalize_auction_run(uuid) from public, anon;
grant execute on function public.finalize_auction_run(uuid) to authenticated, service_role;

revoke all on function public.update_guild_auction_rules(uuid,text,text,integer,integer,integer,integer) from public, anon;
grant execute on function public.update_guild_auction_rules(uuid,text,text,integer,integer,integer,integer) to authenticated, service_role;
