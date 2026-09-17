create or replace function public.sync_guild_feather_groups()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  if new.feather_mode = 'four_group' then
    insert into public.feather_groups (guild_id, code, label, rotation_order, is_active)
    values
      (new.guild_id, '1', 'Group 1', 1, true),
      (new.guild_id, '2', 'Group 2', 2, true),
      (new.guild_id, '3', 'Group 3', 3, true),
      (new.guild_id, '4', 'Group 4', 4, true)
    on conflict (guild_id, code) do update
      set label = excluded.label,
          rotation_order = excluded.rotation_order,
          is_active = true;
  end if;
  return new;
end;
$function$;

revoke all on function public.sync_guild_feather_groups() from public, anon, authenticated;
grant execute on function public.sync_guild_feather_groups() to service_role;

drop trigger if exists trg_sync_guild_feather_groups on public.guild_auction_rules;
create trigger trg_sync_guild_feather_groups
after insert or update of feather_mode on public.guild_auction_rules
for each row execute function public.sync_guild_feather_groups();

insert into public.feather_groups (guild_id, code, label, rotation_order, is_active)
select r.guild_id, x.code, x.label, x.rotation_order, true
from public.guild_auction_rules r
cross join (values
  ('1','Group 1',1),
  ('2','Group 2',2),
  ('3','Group 3',3),
  ('4','Group 4',4)
) as x(code,label,rotation_order)
where r.feather_mode='four_group'
on conflict (guild_id, code) do update
set label=excluded.label, rotation_order=excluded.rotation_order, is_active=true;

create or replace function public.sync_member_feather_group()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_group_id uuid;
begin
  delete from public.feather_group_members where guild_member_id = new.id;

  if new.status='active' and new.feather_group between 1 and 4 then
    select id into v_group_id
    from public.feather_groups
    where guild_id=new.guild_id and code=new.feather_group::text
    limit 1;

    if v_group_id is not null then
      insert into public.feather_group_members(group_id,guild_member_id)
      values(v_group_id,new.id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_member_feather_group() from public, anon, authenticated;
grant execute on function public.sync_member_feather_group() to service_role;

drop trigger if exists trg_sync_member_feather_group on public.guild_members;
create trigger trg_sync_member_feather_group
after insert or update of feather_group,status on public.guild_members
for each row execute function public.sync_member_feather_group();

insert into public.feather_group_members(group_id,guild_member_id)
select fg.id, gm.id
from public.guild_members gm
join public.feather_groups fg on fg.guild_id=gm.guild_id and fg.code=gm.feather_group::text
where gm.status='active' and gm.feather_group between 1 and 4
on conflict do nothing;
