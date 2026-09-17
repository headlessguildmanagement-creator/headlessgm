create index if not exists discord_character_claims_reviewed_by_user_id_idx
  on public.discord_character_claims(reviewed_by_user_id);

drop policy if exists "officers can read guild character claims" on public.discord_character_claims;
create policy "officers can read guild character claims"
on public.discord_character_claims for select to authenticated
using (
  private.is_guild_owner(guild_id)
  or exists (
    select 1
    from public.guild_users gu
    where gu.guild_id = discord_character_claims.guild_id
      and gu.user_id = (select auth.uid())
      and gu.role in ('owner','officer')
  )
);

revoke all on function public.submit_discord_character_claim(uuid, uuid, text, text) from public;
revoke all on function public.submit_discord_character_claim(uuid, uuid, text, text) from anon;
grant execute on function public.submit_discord_character_claim(uuid, uuid, text, text) to authenticated;
grant execute on function public.submit_discord_character_claim(uuid, uuid, text, text) to service_role;

revoke all on function public.approve_discord_character_claim(uuid) from public;
revoke all on function public.approve_discord_character_claim(uuid) from anon;
grant execute on function public.approve_discord_character_claim(uuid) to authenticated;
grant execute on function public.approve_discord_character_claim(uuid) to service_role;

revoke all on function public.reject_discord_character_claim(uuid, text) from public;
revoke all on function public.reject_discord_character_claim(uuid, text) from anon;
grant execute on function public.reject_discord_character_claim(uuid, text) to authenticated;
grant execute on function public.reject_discord_character_claim(uuid, text) to service_role;
