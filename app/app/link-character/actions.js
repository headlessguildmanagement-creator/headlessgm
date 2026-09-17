'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'

function message(value) {
  return encodeURIComponent(String(value || '').slice(0, 240))
}

export async function submitCharacterClaim(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const memberId = String(formData.get('guild_member_id') || '')
  const discordUsername = String(formData.get('discord_username') || '')
  const discordDisplayName = String(formData.get('discord_display_name') || '')

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect('/login')

  let destination

  try {
    const { error } = await supabase.rpc('submit_discord_character_claim', {
      p_guild_id: guildId,
      p_guild_member_id: memberId,
      p_discord_username: discordUsername,
      p_discord_display_name: discordDisplayName,
    })

    if (error) throw error

    destination = `/app/link-character?guild=${encodeURIComponent(guildId)}&success=${message('Claim submitted. An officer must approve the link before it becomes active.')}`
  } catch (error) {
    destination = `/app/link-character?guild=${encodeURIComponent(guildId)}&error=${message(error.message || 'Could not submit character claim.')}`
  }

  redirect(destination)
}
