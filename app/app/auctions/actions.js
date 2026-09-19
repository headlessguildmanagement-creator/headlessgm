'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../lib/supabase/server'

function safe(value) { return encodeURIComponent(String(value || '').slice(0, 220)) }

async function managerContext(guildId) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: guild } = await supabase.from('guilds').select('id,slug,owner_user_id').eq('id', guildId).maybeSingle()
  if (!guild) throw new Error('Guild not found')
  const manager = guild.owner_user_id === userId || Boolean((await supabase.from('guild_users').select('role').eq('guild_id', guildId).eq('user_id', userId).in('role', ['owner','officer']).maybeSingle()).data)
  if (!manager) throw new Error('Officer access required')
  return { supabase, guild }
}

export async function movePuppetQueueMember(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const memberId = String(formData.get('guild_member_id') || '')
  const direction = String(formData.get('direction') || '')
  let slug = ''
  try {
    const { supabase, guild } = await managerContext(guildId)
    slug = guild.slug
    const { error } = await supabase.rpc('move_puppet_queue_member', {
      p_guild_id: guildId,
      p_member_id: memberId,
      p_direction: direction,
    })
    if (error) throw error
    revalidatePath('/app/auctions')
    redirect(`/${slug}/auctions?success=${safe('Puppet rotation updated.')}`)
  } catch (error) {
    if (error?.digest?.startsWith?.('NEXT_REDIRECT')) throw error
    redirect(`/${slug || 'app'}/auctions?error=${safe(error.message || 'Could not update Puppet rotation.')}`)
  }
}

export async function setMemberFeatherGroup(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const memberId = String(formData.get('guild_member_id') || '')
  const group = Number(formData.get('feather_group'))
  let slug = ''
  try {
    const { supabase, guild } = await managerContext(guildId)
    slug = guild.slug
    if (![1,2,3,4].includes(group)) throw new Error('Feather Group must be 1–4')
    const { data: member } = await supabase.from('guild_members').select('id').eq('id', memberId).eq('guild_id', guildId).eq('status', 'active').maybeSingle()
    if (!member) throw new Error('Active guild member not found')
    const { error } = await supabase.from('guild_members').update({ feather_group: group, updated_at: new Date().toISOString() }).eq('id', memberId).eq('guild_id', guildId)
    if (error) throw error
    revalidatePath('/app/auctions')
    revalidatePath('/app/members')
    redirect(`/${slug}/auctions?success=${safe('Permanent Feather Group updated.')}`)
  } catch (error) {
    if (error?.digest?.startsWith?.('NEXT_REDIRECT')) throw error
    redirect(`/${slug || 'app'}/auctions?error=${safe(error.message || 'Could not update Feather Group.')}`)
  }
}
