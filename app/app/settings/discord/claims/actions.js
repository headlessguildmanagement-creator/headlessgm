'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/server'
import { sendDirectMessage } from '../../../../../lib/discord/server'

function safeMessage(value) {
  return encodeURIComponent(String(value || '').slice(0, 240))
}

export async function approveClaim(formData) {
  const claimId = String(formData.get('claim_id') || '')
  const guildId = String(formData.get('guild_id') || '')
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect('/login')

  let redirectUrl
  try {
    const { data: claim } = await supabase
      .from('discord_character_claims')
      .select('discord_user_id, guild_member_id')
      .eq('id', claimId)
      .single()

    const { data: member } = claim?.guild_member_id
      ? await supabase.from('guild_members').select('ign').eq('id', claim.guild_member_id).single()
      : { data: null }

    const { data: guild } = await supabase.from('guilds').select('name').eq('id', guildId).single()

    const { error } = await supabase.rpc('approve_discord_character_claim', { p_claim_id: claimId })
    if (error) throw error

    if (claim?.discord_user_id) {
      try {
        await sendDirectMessage(claim.discord_user_id, {
          embeds: [{
            title: 'Character link approved',
            description: `Your Discord account is now linked to **${member?.ign || 'your character'}** in **${guild?.name || 'HeadlessGM'}**.`,
            footer: { text: 'Headless Guild Management' },
          }],
          allowed_mentions: { parse: [] },
        })
      } catch {
        // Approval must remain successful even if the member has DMs disabled.
      }
    }

    revalidatePath('/app/settings/discord/claims')
    revalidatePath('/app/members')
    redirectUrl = `/app/settings/discord/claims?guild=${encodeURIComponent(guildId)}&success=${safeMessage('Character link approved.')}`
  } catch (error) {
    redirectUrl = `/app/settings/discord/claims?guild=${encodeURIComponent(guildId)}&error=${safeMessage(error.message || 'Could not approve claim.')}`
  }

  redirect(redirectUrl)
}

export async function rejectClaim(formData) {
  const claimId = String(formData.get('claim_id') || '')
  const guildId = String(formData.get('guild_id') || '')
  const reason = String(formData.get('reason') || '').trim()
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect('/login')

  let redirectUrl
  try {
    const { error } = await supabase.rpc('reject_discord_character_claim', {
      p_claim_id: claimId,
      p_rejection_reason: reason || null,
    })
    if (error) throw error
    revalidatePath('/app/settings/discord/claims')
    redirectUrl = `/app/settings/discord/claims?guild=${encodeURIComponent(guildId)}&success=${safeMessage('Character link rejected.')}`
  } catch (error) {
    redirectUrl = `/app/settings/discord/claims?guild=${encodeURIComponent(guildId)}&error=${safeMessage(error.message || 'Could not reject claim.')}`
  }

  redirect(redirectUrl)
}
