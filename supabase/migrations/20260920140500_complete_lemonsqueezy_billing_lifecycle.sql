-- Bring the already-applied Lemon Squeezy billing schema up to the
-- full lifecycle implementation without replaying the original migration.

alter table public.billing_subscriptions
  add column if not exists payment_status text,
  add column if not exists refunded_at timestamptz,
  add column if not exists last_event_name text,
  add column if not exists last_event_at timestamptz;

alter table public.billing_webhook_events
  add column if not exists event_key text,
  add column if not exists resource_type text,
  add column if not exists resource_id text,
  add column if not exists guild_id uuid references public.guilds(id) on delete set null,
  add column if not exists processing_status text not null default 'processing',
  add column if not exists retry_count integer not null default 0,
  add column if not exists error_message text,
  add column if not exists processed_at timestamptz;

update public.billing_webhook_events
set event_key = coalesce(
  event_key,
  provider || ':' || event_name || ':legacy:' || id::text
)
where event_key is null;

alter table public.billing_webhook_events
  alter column event_key set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.billing_webhook_events'::regclass
      and conname = 'billing_webhook_events_event_key_key'
  ) then
    alter table public.billing_webhook_events
      add constraint billing_webhook_events_event_key_key unique (event_key);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.billing_webhook_events'::regclass
      and conname = 'billing_webhook_events_processing_status_check'
  ) then
    alter table public.billing_webhook_events
      add constraint billing_webhook_events_processing_status_check
      check (processing_status in ('processing','processed','failed'));
  end if;
end
$$;

drop policy if exists "guild owners read billing subscription" on public.billing_subscriptions;
create policy "guild owners read billing subscription"
on public.billing_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.guilds g
    where g.id = billing_subscriptions.guild_id
      and g.owner_user_id = (select auth.uid())
  )
);

create index if not exists billing_webhook_events_guild_idx
  on public.billing_webhook_events(guild_id);

create index if not exists billing_webhook_events_status_idx
  on public.billing_webhook_events(processing_status);
