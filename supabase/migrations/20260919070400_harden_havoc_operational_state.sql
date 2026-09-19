-- Restrict new Havoc operational state to guild managers; member-specific reads go through guarded portal RPCs.
drop policy if exists "guild users read puppet state" on public.guild_puppet_state;
drop policy if exists "guild users read puppet progress" on public.puppet_cycle_progress;
drop policy if exists "guild users read puppet exclusions" on public.event_puppet_exclusions;
drop policy if exists "guild users read feather exclusions" on public.event_feather_exclusions;
drop policy if exists "guild users read puppet deferred" on public.puppet_deferred_turns;
drop policy if exists "guild users read puppet cycle history" on public.puppet_cycle_history;
drop policy if exists "guild users read puppet appeals" on public.puppet_appeals;
drop policy if exists "guild users read feather officer queue" on public.feather_officer_queue;

create index if not exists puppet_cycle_progress_member_idx on public.puppet_cycle_progress(guild_member_id);
create index if not exists event_puppet_exclusions_member_idx on public.event_puppet_exclusions(guild_member_id);
create index if not exists event_feather_exclusions_member_idx on public.event_feather_exclusions(guild_member_id);
create index if not exists puppet_deferred_member_idx on public.puppet_deferred_turns(guild_member_id);
create index if not exists puppet_deferred_source_event_idx on public.puppet_deferred_turns(source_event_id);
create index if not exists puppet_appeals_member_idx on public.puppet_appeals(guild_member_id);
create index if not exists puppet_appeals_source_event_idx on public.puppet_appeals(source_event_id);
create index if not exists puppet_cycle_history_event_idx on public.puppet_cycle_history(completed_through_event_id);
create index if not exists feather_officer_queue_member_idx on public.feather_officer_queue(guild_member_id);
