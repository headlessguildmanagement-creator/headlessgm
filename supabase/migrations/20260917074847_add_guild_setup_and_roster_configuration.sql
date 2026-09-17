alter table public.guilds
  add column if not exists logo_url text,
  add column if not exists attendance_mode text not null default 'assume_attending',
  add column if not exists loa_deadline_local_time time not null default '19:30:00',
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists settings jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.guilds add constraint guilds_attendance_mode_check
    check (attendance_mode in ('assume_attending','rsvp_required','custom'));
exception when duplicate_object then null; end $$;

alter table public.guild_members
  add column if not exists combat_role text,
  add column if not exists feather_group integer,
  add column if not exists puppet_order integer;

do $$ begin
  alter table public.guild_members add constraint guild_members_combat_role_check
    check (combat_role is null or combat_role in ('DPS','Support','Utility','Tank'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.guild_members add constraint guild_members_feather_group_check
    check (feather_group is null or feather_group between 1 and 4);
exception when duplicate_object then null; end $$;

create unique index if not exists guild_members_unique_puppet_order_active
  on public.guild_members(guild_id, puppet_order)
  where puppet_order is not null and status = 'active';
