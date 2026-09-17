create or replace function public.post_my_application_message(p_guild_slug text, p_message text)
returns uuid
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_discord_user_id text;
  v_app_id uuid;
  v_status text;
  v_message text:=btrim(coalesce(p_message,''));
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(v_message)<1 or char_length(v_message)>3000 then raise exception 'Message must be between 1 and 3000 characters'; end if;
  select i.provider_id into v_discord_user_id from auth.identities i where i.user_id=v_user_id and i.provider='discord' order by i.created_at desc limit 1;
  if v_discord_user_id is null then raise exception 'Discord account is not linked to this HeadlessGM login'; end if;
  select a.id,a.status into v_app_id,v_status from public.guild_applications a join public.guilds g on g.id=a.guild_id where g.slug=lower(btrim(p_guild_slug)) and a.discord_user_id=v_discord_user_id order by case when a.status in ('rejected','joined') then 1 else 0 end,a.submitted_at desc limit 1;
  if v_app_id is null then raise exception 'No application is linked to this Discord account'; end if;
  if v_status in ('rejected','joined') then raise exception 'This recruitment conversation is closed'; end if;
  insert into public.application_messages(application_id,sender_type,sender_user_id,sender_name,message) values(v_app_id,'applicant',v_user_id,'Applicant',v_message);
  return v_app_id;
end;$function$;
revoke all on function public.post_my_application_message(text,text) from public,anon;
grant execute on function public.post_my_application_message(text,text) to authenticated;
