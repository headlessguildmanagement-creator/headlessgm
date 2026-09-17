create or replace function public.create_guild_workspace(guild_name text, guild_timezone text default 'Asia/Manila'::text)
returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  new_guild_id uuid;
  current_user_id uuid := auth.uid();
  cleaned_name text := btrim(guild_name);
  base_slug text;
  candidate_slug text;
  suffix integer := 1;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(cleaned_name) < 2 or char_length(cleaned_name) > 80 then
    raise exception 'Guild name must be between 2 and 80 characters';
  end if;

  base_slug := lower(regexp_replace(cleaned_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'guild'; end if;
  base_slug := left(base_slug, 48);
  candidate_slug := base_slug;

  while exists (select 1 from public.guilds g where g.slug = candidate_slug) loop
    suffix := suffix + 1;
    candidate_slug := left(base_slug, greatest(1, 48 - length(suffix::text) - 1)) || '-' || suffix::text;
  end loop;

  insert into public.guilds (name, slug, owner_user_id, game_preset_id, plan_code, timezone)
  values (
    cleaned_name,
    candidate_slug,
    current_user_id,
    'rooc',
    'beta',
    coalesce(nullif(btrim(guild_timezone), ''), 'Asia/Manila')
  )
  returning id into new_guild_id;

  insert into public.guild_users (guild_id, user_id, role)
  values (new_guild_id, current_user_id, 'owner');

  insert into public.recruitment_settings (guild_id, title, is_open, discord_required)
  values (new_guild_id, 'Apply to ' || cleaned_name, true, true)
  on conflict (guild_id) do nothing;

  insert into public.guild_auction_rules (guild_id, feather_mode, puppet_mode)
  values (new_guild_id, 'ffa', 'round_robin')
  on conflict (guild_id) do nothing;

  return new_guild_id;
end;
$function$;
