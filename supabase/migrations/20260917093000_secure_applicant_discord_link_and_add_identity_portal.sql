create or replace function public.link_application_discord(p_guild_slug text, p_token text)
returns uuid
language plpgsql
security definer
set search_path to 'public','auth','extensions','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_discord_user_id text;
  v_username text;
  v_display_name text;
  v_app_id uuid;
  v_guild_id uuid;
  v_existing_discord text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select i.provider_id,nullif(i.identity_data->>'user_name',''),coalesce(nullif(i.identity_data->>'full_name',''),nullif(i.identity_data->>'name',''),nullif(i.identity_data->>'user_name',''))
    into v_discord_user_id,v_username,v_display_name
  from auth.identities i where i.user_id=v_user_id and i.provider='discord' order by i.created_at desc limit 1;
  if v_discord_user_id is null then raise exception 'Discord account is not linked to this HeadlessGM login'; end if;

  select a.id,a.guild_id,a.discord_user_id into v_app_id,v_guild_id,v_existing_discord
  from public.guild_applications a join public.guilds g on g.id=a.guild_id
  where g.slug=lower(btrim(p_guild_slug)) and a.token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex')
  for update of a limit 1;
  if v_app_id is null then raise exception 'Application link is invalid or expired'; end if;
  if v_existing_discord is not null and v_existing_discord<>v_discord_user_id then raise exception 'This application is already linked to a different Discord account'; end if;
  if exists(select 1 from public.guild_applications a where a.guild_id=v_guild_id and a.discord_user_id=v_discord_user_id and a.id<>v_app_id and a.status not in ('rejected','joined')) then raise exception 'This Discord account is already attached to another active application'; end if;

  if v_existing_discord is null then
    update public.guild_applications set discord_user_id=v_discord_user_id,discord_username=v_username,discord_display_name=v_display_name,updated_at=now() where id=v_app_id;
    insert into public.application_messages(application_id,sender_type,sender_name,message) values(v_app_id,'system','HeadlessGM','Discord identity connected to this application.');
  end if;
  return v_app_id;
end;$function$;
revoke all on function public.link_application_discord(text,text) from public,anon;
grant execute on function public.link_application_discord(text,text) to authenticated;

create or replace function public.get_my_application(p_guild_slug text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_discord_user_id text;
  v_app public.guild_applications%rowtype;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select i.provider_id into v_discord_user_id from auth.identities i where i.user_id=v_user_id and i.provider='discord' order by i.created_at desc limit 1;
  if v_discord_user_id is null then raise exception 'Discord account is not linked to this HeadlessGM login'; end if;

  select a.* into v_app from public.guild_applications a join public.guilds g on g.id=a.guild_id
  where g.slug=lower(btrim(p_guild_slug)) and a.discord_user_id=v_discord_user_id
  order by case when a.status in ('rejected','joined') then 1 else 0 end,a.submitted_at desc limit 1;
  if not found then return null; end if;

  select jsonb_build_object(
    'application',jsonb_build_object('id',v_app.id,'status',v_app.status,'ign',v_app.ign,'job_code',v_app.job_code,'email',v_app.email,'previous_guild',v_app.previous_guild,'answers',v_app.answers,'discord_linked',true,'discord_display_name',v_app.discord_display_name,'submitted_at',v_app.submitted_at,'decision_note',v_app.decision_note,'closed_at',v_app.closed_at),
    'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'sender_type',m.sender_type,'sender_name',m.sender_name,'message',m.message,'created_at',m.created_at) order by m.created_at) from public.application_messages m where m.application_id=v_app.id),'[]'::jsonb),
    'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'message_id',f.message_id,'url',f.url,'original_name',f.original_name,'content_type',f.content_type,'created_at',f.created_at) order by f.created_at) from public.application_attachments f where f.application_id=v_app.id),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;$function$;
revoke all on function public.get_my_application(text) from public,anon;
grant execute on function public.get_my_application(text) to authenticated;
