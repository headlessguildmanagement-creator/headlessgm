'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/server'

function safeMessage(value) {
  return encodeURIComponent(String(value || '').slice(0, 240))
}

export async function approveClaim(formData) {
  const claimId = String(formData.get('claim_id') || '')
  const guildId = String(formData.get('guild_id') || '')
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect('/login')

  try {
    const { error } = await supabase.rpc('approve_discord_character_claim', { p_claim_id: claimId })
    if (error) throw error
    revalidatePath('/app/settings/discord/claims')
    redirect(`/app/settings/discord/claims?guild=${encodeURIComponent(guildId)}&success=${safeMessage('Character link approved.')}`)
  } catch (error) {
    redirect(`/app/settings/discord/claims?guild=${encodeURIComponent(guildId)}&error=${safeMessage(error.message || 'Could not approve claim.')}`)
  }
}

export async function rejectClaim(formData) {
  const claimId = String(formData.get('claim_id') || '')
  const guildId = String(formData.get('guild_id') || '')
  const reason = String(formData.get('reason') || '').trim()
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect('/login')

  try {
    const { error } = await supabase.rpc('reject_discord_character_claim', {
      p_claim_id: claimId,
      p_rejection_reason: reason || null,
    })
    if (error) throw error
    revalidatePath('/app/settings/discord/claims')
    redirect(`/app/settings/discord/claims?guild=${encodeURIComponent(guildId)}&success=${safeMessage('Character link rejected.')}`)
  } catch (error) {
    redirect(`/app/settings/discord/claims?guild=${encodeURIComponent(guildId)}&error=${safeMessage(error.message || 'Could not reject claim.')}`)
  }
}
