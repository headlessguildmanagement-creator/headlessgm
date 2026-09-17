create table if not exists public.event_absences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.guild_events(id) on delete cascade,
  guild_member_id uuid not null references public.guild_members(id) on delete cascade,
  reason text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, guild_member_id)
);

alter table public.event_absences enable row level security;
create policy "guild users read event absences" on public.event_absences for select to authenticated using (exists (select 1 from public.guild_events e where e.id=event_absences.event_id and (private.is_guild_member(e.guild_id) or private.is_guild_owner(e.guild_id))));
create policy "guild managers manage event absences" on public.event_absences for all to authenticated using (exists (select 1 from public.guild_events e where e.id=event_absences.event_id and (private.is_guild_owner(e.guild_id) or exists(select 1 from public.guild_users gu where gu.guild_id=e.guild_id and gu.user_id=auth.uid() and gu.role in ('owner','officer'))))) with check (exists (select 1 from public.guild_events e where e.id=event_absences.event_id and (private.is_guild_owner(e.guild_id) or exists(select 1 from public.guild_users gu where gu.guild_id=e.guild_id and gu.user_id=auth.uid() and gu.role in ('owner','officer')))));

create or replace function public.sync_member_puppet_queue() returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_next integer;
begin
  if new.status='active' then
    if exists(select 1 from public.puppet_queue where guild_id=new.guild_id and guild_member_id=new.id) then
      update public.puppet_queue set is_active=true,updated_at=now() where guild_id=new.guild_id and guild_member_id=new.id;
    else
      select coalesce(max(position),0)+1 into v_next from public.puppet_queue where guild_id=new.guild_id;
      insert into public.puppet_queue(guild_id,guild_member_id,position,is_active) values(new.guild_id,new.id,v_next,true);
    end if;
  else
    update public.puppet_queue set is_active=false,updated_at=now() where guild_id=new.guild_id and guild_member_id=new.id;
  end if;
  return new;
end;$function$;

drop trigger if exists guild_members_sync_puppet_queue on public.guild_members;
create trigger guild_members_sync_puppet_queue after insert or update of status on public.guild_members for each row execute function public.sync_member_puppet_queue();

with maxpos as (select guild_id,coalesce(max(position),0) max_position from public.puppet_queue group by guild_id), missing as (
  select gm.guild_id,gm.id guild_member_id,row_number() over(partition by gm.guild_id order by gm.puppet_order nulls last,gm.created_at,gm.id) rn,coalesce(mp.max_position,0) max_position,gm.status='active' is_active
  from public.guild_members gm left join maxpos mp on mp.guild_id=gm.guild_id
  where not exists(select 1 from public.puppet_queue pq where pq.guild_id=gm.guild_id and pq.guild_member_id=gm.id)
)
insert into public.puppet_queue(guild_id,guild_member_id,position,is_active) select guild_id,guild_member_id,max_position+rn,is_active from missing on conflict do nothing;

create unique index if not exists auction_allocations_one_member_category on public.auction_allocations(auction_run_id,guild_member_id,category);

create or replace function public.guard_auction_allocation_edit() returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_run_id uuid; v_status text;
begin
  v_run_id:=coalesce(new.auction_run_id,old.auction_run_id);
  select status into v_status from public.auction_runs where id=v_run_id;
  if v_status<>'draft' then raise exception 'Published or completed auction allocations are immutable'; end if;
  return coalesce(new,old);
end;$function$;

drop trigger if exists auction_allocations_guard_edit on public.auction_allocations;
create trigger auction_allocations_guard_edit before insert or update or delete on public.auction_allocations for each row execute function public.guard_auction_allocation_edit();

create or replace function public.publish_auction_run(p_run_id uuid) returns void language plpgsql security definer set search_path to 'public','auth','pg_temp' as $function$
declare v_user uuid:=auth.uid(); v_guild uuid; v_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select e.guild_id,ar.status into v_guild,v_status from public.auction_runs ar join public.guild_events e on e.id=ar.event_id where ar.id=p_run_id for update;
  if v_guild is null then raise exception 'Auction run not found'; end if;
  if not (private.is_guild_owner(v_guild) or exists(select 1 from public.guild_users gu where gu.guild_id=v_guild and gu.user_id=v_user and gu.role in ('owner','officer'))) then raise exception 'Officer access required'; end if;
  if v_status<>'draft' then raise exception 'Only draft auctions can be published'; end if;
  update public.auction_runs set status='published',published_at=now(),published_by_user_id=v_user,updated_at=now() where id=p_run_id;
end;$function$;
revoke all on function public.publish_auction_run(uuid) from public;
grant execute on function public.publish_auction_run(uuid) to authenticated;

create or replace function public.finalize_auction_run(p_run_id uuid) returns void language plpgsql security definer set search_path to 'public','auth','pg_temp' as $function$
declare v_user uuid:=auth.uid(); v_guild uuid; v_event uuid; v_status text; v_ids uuid[]; v_id uuid; v_pos integer:=0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select e.guild_id,e.id,ar.status into v_guild,v_event,v_status from public.auction_runs ar join public.guild_events e on e.id=ar.event_id where ar.id=p_run_id for update;
  if v_guild is null then raise exception 'Auction run not found'; end if;
  if not (private.is_guild_owner(v_guild) or exists(select 1 from public.guild_users gu where gu.guild_id=v_guild and gu.user_id=v_user and gu.role in ('owner','officer'))) then raise exception 'Officer access required'; end if;
  if v_status<>'published' then raise exception 'Auction must be published before finalization'; end if;

  select array_agg(pq.guild_member_id order by case when pq.is_active then 0 else 2 end, case when exists(select 1 from public.auction_allocations aa where aa.auction_run_id=p_run_id and aa.guild_member_id=pq.guild_member_id and aa.category in ('puppet_fragment','puppet') and aa.quantity>0) then 1 else 0 end,pq.position)
  into v_ids from public.puppet_queue pq where pq.guild_id=v_guild;

  update public.puppet_queue set position=position+1000000,updated_at=now() where guild_id=v_guild;
  if v_ids is not null then
    foreach v_id in array v_ids loop
      v_pos:=v_pos+1;
      update public.puppet_queue set position=v_pos,updated_at=now() where guild_id=v_guild and guild_member_id=v_id;
      update public.guild_members set puppet_order=v_pos,updated_at=now() where guild_id=v_guild and id=v_id;
    end loop;
  end if;

  update public.auction_runs set status='completed',completed_at=now(),completed_by_user_id=v_user,updated_at=now() where id=p_run_id;
  update public.guild_events set status='completed',updated_at=now() where id=v_event;
end;$function$;
revoke all on function public.finalize_auction_run(uuid) from public;
grant execute on function public.finalize_auction_run(uuid) to authenticated;
