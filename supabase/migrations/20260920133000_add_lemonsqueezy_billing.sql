-- Lemon Squeezy billing state for HeadlessGM.
-- Provider/webhook writes are server-only. Guild owners may read their own subscription state.

create table if not exists public.billing_subscriptions (
  guild_id uuid primary key references public.guilds(id) on delete cascade,
  provider text not null default 'lemonsqueezy' check (provider = 'lemonsqueezy'),
  provider_customer_id text,
  provider_subscription_id text unique,
  provider_order_id text,
  product_id bigint,
  variant_id bigint,
  plan_code text not null check (plan_code in ('guild','commander')),
  billing_period text not null check (billing_period in ('monthly','annual')),
  status text not null default 'pending',
  payment_status text,
  test_mode boolean not null default true,
  cancelled boolean not null default false,
  customer_email text,
  renews_at timestamptz,
  ends_at timestamptz,
  refunded_at timestamptz,
  last_event_name text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_subscriptions enable row level security;

drop policy if exists "guild owners read billing subscription" on public.billing_subscriptions;
create policy "guild owners read billing subscription"
on public.billing_subscriptions
for select
to authenticated
using (
  exists (
    select 1 from public.guilds g
    where g.id = billing_subscriptions.guild_id
      and g.owner_user_id = (select auth.uid())
  )
);

revoke insert, update, delete on table public.billing_subscriptions from anon, authenticated;
grant select on table public.billing_subscriptions to authenticated;

create table if not exists public.billing_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null default 'lemonsqueezy' check (provider = 'lemonsqueezy'),
  event_key text not null unique,
  event_name text not null,
  resource_type text,
  resource_id text,
  guild_id uuid references public.guilds(id) on delete set null,
  payload_hash text not null unique,
  processing_status text not null default 'processing' check (processing_status in ('processing','processed','failed')),
  retry_count integer not null default 0,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.billing_webhook_events enable row level security;
revoke all on table public.billing_webhook_events from anon, authenticated;

create index if not exists billing_subscriptions_provider_subscription_idx on public.billing_subscriptions(provider_subscription_id);
create index if not exists billing_subscriptions_status_idx on public.billing_subscriptions(status);
create index if not exists billing_webhook_events_guild_idx on public.billing_webhook_events(guild_id);
create index if not exists billing_webhook_events_status_idx on public.billing_webhook_events(processing_status);
