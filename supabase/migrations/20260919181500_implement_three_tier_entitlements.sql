-- Three-tier entitlements: FREE, GUILD, COMMANDER.

update public.plans
set features = jsonb_build_object(
  'basic_roster', true,
  'basic_events', true,
  'basic_attendance', true,
  'basic_lineup', true,
  'basic_auction', true,
  'headlessgm_branding', true
)
where code = 'free';

update public.plans
set features = jsonb_build_object(
  'full_lineups', true,
  'full_attendance', true,
  'reward_queues', true,
  'reward_caps', true,
  'public_recruitment', true,
  'discord_connection', true,
  'discord_workflows', true,
  'history', true,
  'backup_export', true,
  'standard_auction_presets', true,
  'headlessgm_branding', true,
  'custom_auction_rules', false
)
where code = 'guild';

update public.plans
set features = jsonb_build_object(
  'full_lineups', true,
  'full_attendance', true,
  'reward_queues', true,
  'reward_caps', true,
  'public_recruitment', true,
  'discord_connection', true,
  'discord_workflows', true,
  'history', true,
  'backup_export', true,
  'standard_auction_presets', true,
  'custom_auction_rules', true,
  'brand_studio', true,
  'custom_overview', true,
  'advanced_automation', true,
  'audit_logs', true,
  'api_access', true
)
where code = 'commander';

create or replace function public.update_guild_auction_rules(
  p_guild_id uuid,
  p_feather_mode text,
  p_puppet_mode text,
  p_light_dark_feather_cap integer default null,
  p_time_space_feather_cap integer default null,
  p_puppet_fragment_cap integer default null,
  p_illusion_fragment_cap integer default null
)
returns void
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan_code text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not (
    private.is_guild_owner(p_guild_id)
    or exists (
      select 1 from public.guild_users gu
      where gu.guild_id = p_guild_id and gu.user_id = v_user_id and gu.role in ('owner','officer')
    )
  ) then raise exception 'Officer access required'; end if;

  select plan_code into v_plan_code from public.guilds where id = p_guild_id;
  if v_plan_code is null then raise exception 'Guild not found'; end if;

  if p_feather_mode not in ('ffa','four_group','random','custom') then raise exception 'Invalid feather mode'; end if;
  if p_puppet_mode not in ('ffa','round_robin','random','custom') then raise exception 'Invalid puppet mode'; end if;

  if v_plan_code = 'free' then
    if p_feather_mode not in ('ffa','random') or p_puppet_mode not in ('ffa','random') then
      raise exception 'FREE includes FFA and Random. Upgrade to GUILD for persistent Feather/Puppet presets';
    end if;
    if p_light_dark_feather_cap is not null
      or p_time_space_feather_cap is not null
      or p_puppet_fragment_cap is not null
      or p_illusion_fragment_cap is not null then
      raise exception 'Per-person reward caps require the GUILD plan';
    end if;
  end if;

  if (p_feather_mode = 'custom' or p_puppet_mode = 'custom') and v_plan_code not in ('commander','beta') then
    raise exception 'Custom auction rules require the COMMANDER plan';
  end if;

  if coalesce(p_light_dark_feather_cap,0) < 0
    or coalesce(p_time_space_feather_cap,0) < 0
    or coalesce(p_puppet_fragment_cap,0) < 0
    or coalesce(p_illusion_fragment_cap,0) < 0 then
    raise exception 'Caps cannot be negative';
  end if;

  insert into public.guild_auction_rules(
    guild_id, feather_mode, puppet_mode,
    light_dark_feather_cap, time_space_feather_cap,
    puppet_fragment_cap, illusion_fragment_cap,
    version, updated_at
  ) values (
    p_guild_id, p_feather_mode, p_puppet_mode,
    p_light_dark_feather_cap, p_time_space_feather_cap,
    p_puppet_fragment_cap, p_illusion_fragment_cap,
    1, now()
  )
  on conflict (guild_id) do update set
    feather_mode = excluded.feather_mode,
    puppet_mode = excluded.puppet_mode,
    light_dark_feather_cap = excluded.light_dark_feather_cap,
    time_space_feather_cap = excluded.time_space_feather_cap,
    puppet_fragment_cap = excluded.puppet_fragment_cap,
    illusion_fragment_cap = excluded.illusion_fragment_cap,
    version = public.guild_auction_rules.version + 1,
    updated_at = now();
end;
$function$;

revoke all on function public.update_guild_auction_rules(uuid,text,text,integer,integer,integer,integer) from public;
grant execute on function public.update_guild_auction_rules(uuid,text,text,integer,integer,integer,integer) to authenticated;

create or replace function public.get_public_recruitment_page(p_guild_slug text)
returns jsonb
language sql
security definer
set search_path to 'public','pg_temp'
as $function$
  select jsonb_build_object(
    'guild', jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'slug', g.slug,
      'timezone', g.timezone,
      'game_preset_id', g.game_preset_id,
      'plan_code', g.plan_code,
      'logo_url', g.logo_url,
      'settings', g.settings,
      'active_members', (select count(*) from public.guild_members gm where gm.guild_id = g.id and gm.status = 'active'),
      'active_member_limit', p.active_member_limit
    ),
    'recruitment', jsonb_build_object(
      'is_open', rs.is_open,
      'title', rs.title,
      'intro', rs.intro,
      'discord_required', rs.discord_required,
      'form_config', rs.form_config
    ),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object('code', j.code, 'label', j.label) order by j.sort_order, j.label)
      from public.game_jobs j
      where j.game_preset_id = g.game_preset_id and j.is_active = true
    ), '[]'::jsonb)
  )
  from public.guilds g
  join public.plans p on p.code = g.plan_code
  join public.recruitment_settings rs on rs.guild_id = g.id
  where g.slug = lower(btrim(p_guild_slug))
    and g.status = 'active'
    and g.plan_code in ('guild','commander','beta')
  limit 1;
$function$;

revoke all on function public.get_public_recruitment_page(text) from public;
grant execute on function public.get_public_recruitment_page(text) to anon, authenticated;

create or replace function public.submit_guild_application(
  p_guild_slug text,
  p_ign text,
  p_job_code text default null::text,
  p_email text default null::text,
  p_previous_guild text default null::text,
  p_answers jsonb default '{}'::jsonb
)
returns table(application_id uuid, token text)
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_guild_id uuid;
  v_token text;
  v_id uuid;
begin
  select g.id into v_guild_id
  from public.guilds g
  join public.recruitment_settings rs on rs.guild_id = g.id
  where g.slug = lower(btrim(p_guild_slug))
    and g.status = 'active'
    and g.plan_code in ('guild','commander','beta')
    and rs.is_open = true;

  if v_guild_id is null then raise exception 'Recruitment is not open for this guild'; end if;
  if char_length(btrim(coalesce(p_ign,''))) < 2 then raise exception 'Enter your current in-game name'; end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.guild_applications(
    guild_id, token_hash, ign, job_code, email, previous_guild, answers, status
  ) values (
    v_guild_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    left(btrim(p_ign), 80),
    nullif(left(btrim(p_job_code), 80), ''),
    nullif(left(btrim(p_email), 320), ''),
    nullif(left(btrim(p_previous_guild), 120), ''),
    coalesce(p_answers, '{}'::jsonb),
    'new'
  ) returning id into v_id;

  insert into public.application_messages(application_id, sender_type, sender_name, message)
  values (v_id, 'system', 'HeadlessGM', 'Application submitted. Connect Discord so officers can keep this identity attached through onboarding.');

  return query select v_id, v_token;
end;
$function$;

revoke all on function public.submit_guild_application(text,text,text,text,text,jsonb) from public;
grant execute on function public.submit_guild_application(text,text,text,text,text,jsonb) to anon, authenticated;
