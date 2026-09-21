-- Anti-spy membership enforcement, pre-publication bidder proxying, and auction proof tracking.

create schema if not exists private;

-- One real identity may belong to only one active guild at a time.
create or replace function private.enforce_single_active_member_identity()
returns trigger
language plpgsql
security definer
set search_path to 'public','auth','private','pg_temp'
as $function$
declare
  v_user_id uuid;
begin
  if new.status <> 'active' or new.discord_user_id is null or btrim(new.discord_user_id) = '' then
    return new;
  end if;

  if exists (
    select 1
    from public.guild_members gm
    where gm.id <> new.id
      and gm.guild_id <> new.guild_id
      and gm.status = 'active'
      and gm.discord_user_id = new.discord_user_id
  ) then
    raise exception 'This Discord identity is already active in another guild';
  end if;

  select i.user_id into v_user_id
  from auth.identities i
  where i.provider = 'discord'
    and i.provider_id = new.discord_user_id
  order by i.created_at desc
  limit 1;

  if v_user_id is not null and (
    exists (select 1 from public.guilds g where g.owner_user_id = v_user_id and g.id <> new.guild_id)
    or exists (select 1 from public.guild_users gu where gu.user_id = v_user_id and gu.guild_id <> new.guild_id)
  ) then
    raise exception 'This account is already attached to another guild';
  end if;

  return new;
end;
$function$;

drop trigger if exists guild_members_single_active_identity on public.guild_members;
create trigger guild_members_single_active_identity
before insert or update of status, discord_user_id, guild_id
on public.guild_members
for each row execute function private.enforce_single_active_member_identity();

create or replace function private.enforce_single_guild_user()
returns trigger
language plpgsql
security definer
set search_path to 'public','auth','private','pg_temp'
as $function$
declare
  v_discord_id text;
begin
  if exists (
    select 1 from public.guild_users gu
    where gu.user_id = new.user_id
      and gu.guild_id <> new.guild_id
  ) then
    raise exception 'This account is already attached to another guild';
  end if;

  if exists (
    select 1 from public.guilds g
    where g.owner_user_id = new.user_id
      and g.id <> new.guild_id
  ) then
    raise exception 'This account already owns another guild';
  end if;

  select i.provider_id into v_discord_id
  from auth.identities i
  where i.user_id = new.user_id and i.provider = 'discord'
  order by i.created_at desc
  limit 1;

  if v_discord_id is not null and exists (
    select 1 from public.guild_members gm
    where gm.discord_user_id = v_discord_id
      and gm.status = 'active'
      and gm.guild_id <> new.guild_id
  ) then
    raise exception 'This account is already an active member of another guild';
  end if;

  return new;
end;
$function$;

drop trigger if exists guild_users_single_guild on public.guild_users;
create trigger guild_users_single_guild
before insert or update of user_id, guild_id
on public.guild_users
for each row execute function private.enforce_single_guild_user();

create or replace function private.enforce_single_owned_guild()
returns trigger
language plpgsql
security definer
set search_path to 'public','auth','private','pg_temp'
as $function$
declare
  v_discord_id text;
begin
  if new.owner_user_id is null then return new; end if;

  if exists (
    select 1 from public.guilds g
    where g.owner_user_id = new.owner_user_id
      and g.id <> new.id
  ) then
    raise exception 'This account already owns another guild';
  end if;

  if exists (
    select 1 from public.guild_users gu
    where gu.user_id = new.owner_user_id
      and gu.guild_id <> new.id
  ) then
    raise exception 'This account is already attached to another guild';
  end if;

  select i.provider_id into v_discord_id
  from auth.identities i
  where i.user_id = new.owner_user_id and i.provider = 'discord'
  order by i.created_at desc
  limit 1;

  if v_discord_id is not null and exists (
    select 1 from public.guild_members gm
    where gm.discord_user_id = v_discord_id
      and gm.status = 'active'
      and gm.guild_id <> new.id
  ) then
    raise exception 'This account is already an active member of another guild';
  end if;

  return new;
end;
$function$;

drop trigger if exists guilds_single_owner_guild on public.guilds;
create trigger guilds_single_owner_guild
before insert or update of owner_user_id
on public.guilds
for each row execute function private.enforce_single_owned_guild();

-- Current authenticated user's active roster identity for immediate member-portal revocation.
create or replace function public.get_my_active_guild_member(p_guild_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_discord_id text;
  v_member public.guild_members%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select i.provider_id into v_discord_id
  from auth.identities i
  where i.user_id = v_user_id and i.provider = 'discord'
  order by i.created_at desc
  limit 1;

  if v_discord_id is null then return null; end if;

  select * into v_member
  from public.guild_members gm
  where gm.guild_id = p_guild_id
    and gm.discord_user_id = v_discord_id
    and gm.status = 'active'
  limit 1;

  if not found then return null; end if;

  return jsonb_build_object('id',v_member.id,'guild_id',v_member.guild_id,'ign',v_member.ign);
end;
$function$;

revoke all on function public.get_my_active_guild_member(uuid) from public,anon;
grant execute on function public.get_my_active_guild_member(uuid) to authenticated;

-- Guild-only password used to authorize internal Give/Proxy changes.
create table if not exists public.guild_transfer_security (
  guild_id uuid primary key references public.guilds(id) on delete cascade,
  password_hash text not null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.guild_transfer_security enable row level security;
revoke all on table public.guild_transfer_security from anon,authenticated;

create or replace function public.set_guild_transfer_password(p_guild_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path to 'public','auth','extensions','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_password text := coalesce(p_password,'');
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.guilds g where g.id=p_guild_id and g.owner_user_id=v_user_id) then
    raise exception 'Guild owner access required';
  end if;
  if char_length(v_password) < 4 or char_length(v_password) > 64 then
    raise exception 'Transfer password must be between 4 and 64 characters';
  end if;

  insert into public.guild_transfer_security(guild_id,password_hash,updated_by_user_id,updated_at)
  values(p_guild_id,extensions.crypt(v_password,extensions.gen_salt('bf')),v_user_id,now())
  on conflict(guild_id) do update set
    password_hash=excluded.password_hash,
    updated_by_user_id=excluded.updated_by_user_id,
    updated_at=now();
end;
$function$;

revoke all on function public.set_guild_transfer_password(uuid,text) from public,anon;
grant execute on function public.set_guild_transfer_password(uuid,text) to authenticated;

create or replace function public.guild_transfer_password_configured(p_guild_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then return false; end if;
  if not (
    exists(select 1 from public.guilds g where g.id=p_guild_id and g.owner_user_id=v_user_id)
    or exists(select 1 from public.guild_users gu where gu.guild_id=p_guild_id and gu.user_id=v_user_id and gu.role in ('owner','officer'))
  ) then return false; end if;
  return exists(select 1 from public.guild_transfer_security s where s.guild_id=p_guild_id);
end;
$function$;

revoke all on function public.guild_transfer_password_configured(uuid) from public,anon;
grant execute on function public.guild_transfer_password_configured(uuid) to authenticated;

-- Keep operational allocation ownership intact while allowing a different published bidder.
create table if not exists public.auction_bidder_proxies (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  auction_run_id uuid not null references public.auction_runs(id) on delete cascade,
  allocation_id uuid not null references public.auction_allocations(id) on delete cascade,
  original_member_id uuid not null references public.guild_members(id) on delete restrict,
  bidder_member_id uuid not null references public.guild_members(id) on delete restrict,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(allocation_id)
);

create index if not exists auction_bidder_proxies_run_idx on public.auction_bidder_proxies(auction_run_id);
alter table public.auction_bidder_proxies enable row level security;

create policy "guild managers read auction bidder proxies"
on public.auction_bidder_proxies for select to authenticated
using (
  exists(select 1 from public.guilds g where g.id=guild_id and g.owner_user_id=(select auth.uid()))
  or exists(select 1 from public.guild_users gu where gu.guild_id=auction_bidder_proxies.guild_id and gu.user_id=(select auth.uid()) and gu.role in ('owner','officer'))
);

revoke insert,update,delete on table public.auction_bidder_proxies from anon,authenticated;

create or replace function public.set_auction_proxy_bidder(
  p_allocation_id uuid,
  p_bidder_member_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path to 'public','auth','extensions','pg_temp'
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_guild_id uuid;
  v_run_id uuid;
  v_run_status text;
  v_original_member_id uuid;
  v_hash text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select e.guild_id, ar.id, ar.status, aa.guild_member_id
  into v_guild_id,v_run_id,v_run_status,v_original_member_id
  from public.auction_allocations aa
  join public.auction_runs ar on ar.id=aa.auction_run_id
  join public.guild_events e on e.id=ar.event_id
  where aa.id=p_allocation_id
  for update of ar,aa;

  if v_guild_id is null then raise exception 'Auction allocation not found'; end if;
  if v_run_status <> 'draft' then raise exception 'Give / proxy changes are locked after publication'; end if;
  if not (
    exists(select 1 from public.guilds g where g.id=v_guild_id and g.owner_user_id=v_user_id)
    or exists(select 1 from public.guild_users gu where gu.guild_id=v_guild_id and gu.user_id=v_user_id and gu.role in ('owner','officer'))
  ) then raise exception 'Officer access required'; end if;

  select s.password_hash into v_hash from public.guild_transfer_security s where s.guild_id=v_guild_id;
  if v_hash is null then raise exception 'Set the guild transfer password first'; end if;
  if extensions.crypt(coalesce(p_password,''),v_hash) <> v_hash then raise exception 'Incorrect transfer password'; end if;

  if not exists(
    select 1 from public.guild_members gm
    where gm.id=p_bidder_member_id and gm.guild_id=v_guild_id and gm.status='active'
  ) then raise exception 'Replacement bidder must be an active member of this guild'; end if;

  if p_bidder_member_id=v_original_member_id then
    delete from public.auction_bidder_proxies where allocation_id=p_allocation_id;
    return;
  end if;

  insert into public.auction_bidder_proxies(
    guild_id,auction_run_id,allocation_id,original_member_id,bidder_member_id,created_by_user_id
  ) values(
    v_guild_id,v_run_id,p_allocation_id,v_original_member_id,p_bidder_member_id,v_user_id
  )
  on conflict(allocation_id) do update set
    bidder_member_id=excluded.bidder_member_id,
    created_by_user_id=excluded.created_by_user_id,
    updated_at=now();
end;
$function$;

revoke all on function public.set_auction_proxy_bidder(uuid,uuid,text) from public,anon;
grant execute on function public.set_auction_proxy_bidder(uuid,uuid,text) to authenticated;

-- Proof state only. Screenshot bytes/URLs are intentionally never stored.
create table if not exists public.auction_bid_proofs (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  auction_run_id uuid not null references public.auction_runs(id) on delete cascade,
  bidder_member_id uuid not null references public.guild_members(id) on delete restrict,
  ign_submitted text not null,
  ign_match_key text not null,
  discord_user_id text,
  discord_interaction_id text,
  submitted_at timestamptz not null default now(),
  unique(auction_run_id,bidder_member_id)
);

create index if not exists auction_bid_proofs_run_idx on public.auction_bid_proofs(auction_run_id);
alter table public.auction_bid_proofs enable row level security;

create policy "guild managers read auction bid proofs"
on public.auction_bid_proofs for select to authenticated
using (
  exists(select 1 from public.guilds g where g.id=guild_id and g.owner_user_id=(select auth.uid()))
  or exists(select 1 from public.guild_users gu where gu.guild_id=auction_bid_proofs.guild_id and gu.user_id=(select auth.uid()) and gu.role in ('owner','officer'))
);

revoke insert,update,delete on table public.auction_bid_proofs from anon,authenticated;

create or replace function public.record_auction_bid_proof(
  p_run_id uuid,
  p_bidder_member_id uuid,
  p_ign_submitted text,
  p_ign_match_key text,
  p_discord_user_id text,
  p_discord_interaction_id text
)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_guild_id uuid;
  v_status text;
begin
  select e.guild_id,ar.status into v_guild_id,v_status
  from public.auction_runs ar
  join public.guild_events e on e.id=ar.event_id
  where ar.id=p_run_id;

  if v_guild_id is null then raise exception 'Auction run not found'; end if;
  if v_status <> 'published' then raise exception 'Auction proof is accepted only for a published auction'; end if;

  if not exists(
    select 1
    from public.auction_allocations aa
    left join public.auction_bidder_proxies ap on ap.allocation_id=aa.id
    where aa.auction_run_id=p_run_id
      and coalesce(ap.bidder_member_id,aa.guild_member_id)=p_bidder_member_id
  ) then raise exception 'That IGN is not on the published bidding list'; end if;

  insert into public.auction_bid_proofs(
    guild_id,auction_run_id,bidder_member_id,ign_submitted,ign_match_key,discord_user_id,discord_interaction_id,submitted_at
  ) values(
    v_guild_id,p_run_id,p_bidder_member_id,left(p_ign_submitted,120),left(p_ign_match_key,120),left(p_discord_user_id,40),left(p_discord_interaction_id,80),now()
  )
  on conflict(auction_run_id,bidder_member_id) do update set
    ign_submitted=excluded.ign_submitted,
    ign_match_key=excluded.ign_match_key,
    discord_user_id=excluded.discord_user_id,
    discord_interaction_id=excluded.discord_interaction_id,
    submitted_at=now();
end;
$function$;

revoke all on function public.record_auction_bid_proof(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_auction_bid_proof(uuid,uuid,text,text,text,text) to service_role;
