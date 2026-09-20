-- Limited launch offer: first 30 paid guilds, one redemption per owner/guild.
-- Reservations expire so abandoned checkouts do not permanently consume slots.

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_billing_period_check;

alter table public.billing_subscriptions
  add constraint billing_subscriptions_billing_period_check
  check (billing_period in ('monthly','quarterly','annual'));

create table if not exists public.billing_promotions (
  code text primary key,
  name text not null,
  active boolean not null default true,
  max_redemptions integer not null check (max_redemptions > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_promotions(code,name,active,max_redemptions)
values ('launch30','HeadlessGM Launch 30',true,30)
on conflict (code) do update set
  name=excluded.name,
  max_redemptions=excluded.max_redemptions,
  updated_at=now();

create table if not exists public.billing_promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_code text not null references public.billing_promotions(code),
  guild_id uuid not null references public.guilds(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  plan_code text not null check (plan_code in ('guild','commander')),
  status text not null default 'reserved' check (status in ('reserved','redeemed','released')),
  reserved_until timestamptz,
  provider_customer_id text,
  provider_subscription_id text,
  provider_order_id text,
  paid_at timestamptz,
  term_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(promotion_code,guild_id),
  unique(promotion_code,user_id)
);

alter table public.billing_promotions enable row level security;
alter table public.billing_promotion_redemptions enable row level security;
revoke all on table public.billing_promotions from anon,authenticated;
revoke all on table public.billing_promotion_redemptions from anon,authenticated;

create or replace function public.get_billing_promotion_status(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_promo public.billing_promotions%rowtype;
  v_redeemed integer;
  v_reserved integer;
begin
  select * into v_promo from public.billing_promotions where code=lower(btrim(p_code));
  if not found then return null; end if;
  select count(*) into v_redeemed from public.billing_promotion_redemptions
    where promotion_code=v_promo.code and status='redeemed';
  select count(*) into v_reserved from public.billing_promotion_redemptions
    where promotion_code=v_promo.code and status='reserved' and reserved_until > now();
  return jsonb_build_object(
    'code',v_promo.code,
    'name',v_promo.name,
    'active',v_promo.active
      and (v_promo.starts_at is null or v_promo.starts_at <= now())
      and (v_promo.ends_at is null or v_promo.ends_at > now()),
    'max_redemptions',v_promo.max_redemptions,
    'redeemed',v_redeemed,
    'reserved',v_reserved,
    'available',greatest(0,v_promo.max_redemptions-v_redeemed-v_reserved)
  );
end;
$function$;

revoke all on function public.get_billing_promotion_status(text) from public,anon;
grant execute on function public.get_billing_promotion_status(text) to authenticated;

create or replace function public.reserve_billing_promotion(p_code text,p_guild_id uuid,p_plan_code text)
returns uuid
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_promo public.billing_promotions%rowtype;
  v_id uuid;
  v_used integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_plan_code not in ('guild','commander') then raise exception 'Invalid promotional plan'; end if;
  if not exists(select 1 from public.guilds g where g.id=p_guild_id and g.owner_user_id=v_user_id) then
    raise exception 'Guild owner access required';
  end if;

  perform pg_advisory_xact_lock(hashtext('billing-promotion:'||lower(btrim(p_code))));
  select * into v_promo from public.billing_promotions where code=lower(btrim(p_code)) for update;
  if not found or not v_promo.active
    or (v_promo.starts_at is not null and v_promo.starts_at > now())
    or (v_promo.ends_at is not null and v_promo.ends_at <= now()) then
    raise exception 'This launch offer is not active';
  end if;

  if exists(select 1 from public.billing_promotion_redemptions r where r.promotion_code=v_promo.code and (r.user_id=v_user_id or r.guild_id=p_guild_id) and r.status='redeemed') then
    raise exception 'This account or guild has already used the launch offer';
  end if;

  select id into v_id from public.billing_promotion_redemptions r
    where r.promotion_code=v_promo.code
      and (r.user_id=v_user_id or r.guild_id=p_guild_id)
      and r.status='reserved' and r.reserved_until > now()
    order by r.created_at desc limit 1;
  if v_id is not null then return v_id; end if;

  delete from public.billing_promotion_redemptions r
    where r.promotion_code=v_promo.code
      and (r.user_id=v_user_id or r.guild_id=p_guild_id)
      and r.status <> 'redeemed';

  select count(*) into v_used from public.billing_promotion_redemptions r
    where r.promotion_code=v_promo.code
      and (r.status='redeemed' or (r.status='reserved' and r.reserved_until > now()));
  if v_used >= v_promo.max_redemptions then raise exception 'All launch offer slots have been claimed'; end if;

  insert into public.billing_promotion_redemptions(promotion_code,guild_id,user_id,plan_code,status,reserved_until)
  values(v_promo.code,p_guild_id,v_user_id,p_plan_code,'reserved',now()+interval '30 minutes')
  returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.reserve_billing_promotion(text,uuid,text) from public,anon;
grant execute on function public.reserve_billing_promotion(text,uuid,text) to authenticated;

create or replace function public.release_billing_promotion(p_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then return; end if;
  update public.billing_promotion_redemptions
    set status='released',reserved_until=null,updated_at=now()
  where id=p_redemption_id and user_id=v_user_id and status='reserved';
end;
$function$;

revoke all on function public.release_billing_promotion(uuid) from public,anon;
grant execute on function public.release_billing_promotion(uuid) to authenticated;

create index if not exists billing_promotion_redemptions_status_idx
  on public.billing_promotion_redemptions(promotion_code,status,reserved_until);
create index if not exists billing_promotion_redemptions_provider_customer_idx
  on public.billing_promotion_redemptions(provider_customer_id)
  where provider_customer_id is not null;
