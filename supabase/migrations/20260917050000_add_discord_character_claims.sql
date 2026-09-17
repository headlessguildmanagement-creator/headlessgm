create table public.discord_character_claims (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  guild_member_id uuid not null references public.guild_members(id) on delete cascade,
  discord_user_id text not null,
  discord_username text,
  discord_display_name text,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discord_character_claims_status_check check (status in ('pending','approved','rejected','cancelled'))
);

create index discord_character_claims_guild_id_idx on public.discord_character_claims(guild_id);
create index discord_character_claims_member_id_idx on public.discord_character_claims(guild_member_id);
create index discord_character_claims_discord_user_id_idx on public.discord_character_claims(discord_user_id);
create index discord_character_claims_guild_status_idx on public.discord_character_claims(guild_id, status);
create unique index discord_character_claims_pending_discord_idx on public.discord_character_claims(guild_id, discord_user_id) where status = 'pending';
create unique index discord_character_claims_pending_member_idx on public.discord_character_claims(guild_id, guild_member_id) where status = 'pending';
create unique index guild_members_guild_discord_user_idx on public.guild_members(guild_id, discord_user_id) where discord_user_id is not null;

alter table public.discord_character_claims enable row level security;

create policy "officers can read guild character claims"
on public.discord_character_claims for select to authenticated
using (
  private.is_guild_owner(guild_id)
  or exists (
    select 1 from public.guild_users gu
    where gu.guild_id = discord_character_claims.guild_id
      and gu.user_id = auth.uid()
      and gu.role in ('owner','officer')
  )
);

create or replace function public.submit_discord_character_claim(p_guild_id uuid, p_guild_member_id uuid, p_discord_username text default null, p_discord_display_name text default null)
returns uuid language plpgsql security definer set search_path to 'public', 'auth', 'pg_temp' as $function$
declare
  v_user_id uuid := auth.uid();
  v_discord_user_id text;
  v_claim_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select i.provider_id into v_discord_user_id from auth.identities i where i.user_id = v_user_id and i.provider = 'discord' order by i.created_at desc limit 1;
  if v_discord_user_id is null or btrim(v_discord_user_id) = '' then raise exception 'Discord account is not linked to this HeadlessGM account'; end if;
  if not exists (select 1 from public.guilds g where g.id = p_guild_id) then raise exception 'Guild not found'; end if;
  if not exists (select 1 from public.guild_members gm where gm.id = p_guild_member_id and gm.guild_id = p_guild_id and gm.status in ('active','pending') and gm.discord_user_id is null) then raise exception 'Character is unavailable for linking'; end if;
  if exists (select 1 from public.guild_members gm where gm.guild_id = p_guild_id and gm.discord_user_id = v_discord_user_id) then raise exception 'Discord account is already linked to a guild member'; end if;
  insert into public.discord_character_claims(guild_id, guild_member_id, discord_user_id, discord_username, discord_display_name)
  values (p_guild_id, p_guild_member_id, v_discord_user_id, nullif(left(btrim(p_discord_username), 120), ''), nullif(left(btrim(p_discord_display_name), 120), ''))
  returning id into v_claim_id;
  return v_claim_id;
exception when unique_violation then raise exception 'You already have a pending character claim in this guild, or that character already has a pending claim';
end;
$function$;
revoke all on function public.submit_discord_character_claim(uuid, uuid, text, text) from public;
grant execute on function public.submit_discord_character_claim(uuid, uuid, text, text) to authenticated;

create or replace function public.approve_discord_character_claim(p_claim_id uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'auth', 'pg_temp' as $function$
declare
  v_user_id uuid := auth.uid();
  v_claim public.discord_character_claims%rowtype;
  v_member public.guild_members%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_claim from public.discord_character_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.status <> 'pending' then raise exception 'Claim is no longer pending'; end if;
  if not (exists (select 1 from public.guilds g where g.id = v_claim.guild_id and g.owner_user_id = v_user_id) or exists (select 1 from public.guild_users gu where gu.guild_id = v_claim.guild_id and gu.user_id = v_user_id and gu.role in ('owner','officer'))) then raise exception 'Officer access required'; end if;
  select * into v_member from public.guild_members where id = v_claim.guild_member_id for update;
  if not found or v_member.guild_id <> v_claim.guild_id then raise exception 'Claim member does not belong to claim guild'; end if;
  if v_member.discord_user_id is not null and v_member.discord_user_id <> v_claim.discord_user_id then raise exception 'Character is already linked to another Discord account'; end if;
  if exists (select 1 from public.guild_members gm where gm.guild_id = v_claim.guild_id and gm.discord_user_id = v_claim.discord_user_id and gm.id <> v_claim.guild_member_id) then raise exception 'Discord account is already linked to another guild member'; end if;
  update public.guild_members set discord_user_id = v_claim.discord_user_id, updated_at = now() where id = v_claim.guild_member_id;
  update public.discord_character_claims set status = 'approved', reviewed_at = now(), reviewed_by_user_id = v_user_id, updated_at = now() where id = p_claim_id;
  return p_claim_id;
end;
$function$;
revoke all on function public.approve_discord_character_claim(uuid) from public;
grant execute on function public.approve_discord_character_claim(uuid) to authenticated;

create or replace function public.reject_discord_character_claim(p_claim_id uuid, p_rejection_reason text default null)
returns uuid language plpgsql security definer set search_path to 'public', 'auth', 'pg_temp' as $function$
declare v_user_id uuid := auth.uid(); v_claim public.discord_character_claims%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_claim from public.discord_character_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.status <> 'pending' then raise exception 'Claim is no longer pending'; end if;
  if not (exists (select 1 from public.guilds g where g.id = v_claim.guild_id and g.owner_user_id = v_user_id) or exists (select 1 from public.guild_users gu where gu.guild_id = v_claim.guild_id and gu.user_id = v_user_id and gu.role in ('owner','officer'))) then raise exception 'Officer access required'; end if;
  update public.discord_character_claims set status = 'rejected', reviewed_at = now(), reviewed_by_user_id = v_user_id, rejection_reason = nullif(left(btrim(p_rejection_reason), 500), ''), updated_at = now() where id = p_claim_id;
  return p_claim_id;
end;
$function$;
revoke all on function public.reject_discord_character_claim(uuid, text) from public;
grant execute on function public.reject_discord_character_claim(uuid, text) to authenticated;
