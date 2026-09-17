'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'

async function getAuthenticatedGuild(supabase, guildId) {
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) {
    redirect('/login')
  }

  const { data: guild } = await supabase
    .from('guilds')
    .select('id, plan_code')
    .eq('id', guildId)
    .single()

  if (!guild) {
    redirect('/app')
  }

  return guild
}

async function getActiveLimit(supabase, planCode) {
  const { data: plan } = await supabase
    .from('plans')
    .select('active_member_limit')
    .eq('code', planCode)
    .single()

  return plan?.active_member_limit ?? 80
}

async function activeMemberCount(supabase, guildId) {
  const { count } = await supabase
    .from('guild_members')
    .select('id', { count: 'exact', head: true })
    .eq('guild_id', guildId)
    .eq('status', 'active')

  return count ?? 0
}

export async function addMember(formData) {
  const supabase = await createClient()
  const guildId = String(formData.get('guild_id') || '')
  const ign = String(formData.get('ign') || '').trim()
  const jobCode = String(formData.get('job_code') || '').trim() || null
  const guildRole = String(formData.get('guild_role') || '').trim() || null
  const discordUserId = String(formData.get('discord_user_id') || '').trim() || null
  const requestedStatus = String(formData.get('status') || 'active')
  const status = requestedStatus === 'pending' ? 'pending' : 'active'

  if (!guildId || ign.length < 1 || ign.length > 80) {
    redirect('/app/members?error=Enter%20a%20valid%20IGN.')
  }

  const guild = await getAuthenticatedGuild(supabase, guildId)

  if (status === 'active') {
    const [limit, currentCount] = await Promise.all([
      getActiveLimit(supabase, guild.plan_code),
      activeMemberCount(supabase, guild.id),
    ])

    if (currentCount >= limit) {
      redirect(`/app/members?error=Active%20member%20limit%20reached%20(${limit}).`)
    }
  }

  const { error } = await supabase.from('guild_members').insert({
    guild_id: guild.id,
    ign,
    job_code: jobCode,
    guild_role: guildRole,
    discord_user_id: discordUserId,
    status,
  })

  if (error) {
    redirect('/app/members?error=Could%20not%20add%20that%20member.')
  }

  revalidatePath('/app/members')
  redirect('/app/members?success=Member%20added.')
}

export async function updateMemberStatus(formData) {
  const supabase = await createClient()
  const guildId = String(formData.get('guild_id') || '')
  const memberId = String(formData.get('member_id') || '')
  const requestedStatus = String(formData.get('status') || '')
  const allowedStatuses = new Set(['active', 'pending', 'inactive', 'left'])

  if (!guildId || !memberId || !allowedStatuses.has(requestedStatus)) {
    redirect('/app/members?error=Invalid%20member%20update.')
  }

  const guild = await getAuthenticatedGuild(supabase, guildId)

  if (requestedStatus === 'active') {
    const { data: member } = await supabase
      .from('guild_members')
      .select('status')
      .eq('id', memberId)
      .eq('guild_id', guild.id)
      .single()

    if (member?.status !== 'active') {
      const [limit, currentCount] = await Promise.all([
        getActiveLimit(supabase, guild.plan_code),
        activeMemberCount(supabase, guild.id),
      ])

      if (currentCount >= limit) {
        redirect(`/app/members?error=Active%20member%20limit%20reached%20(${limit}).`)
      }
    }
  }

  const { error } = await supabase
    .from('guild_members')
    .update({ status: requestedStatus, updated_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('guild_id', guild.id)

  if (error) {
    redirect('/app/members?error=Could%20not%20update%20that%20member.')
  }

  revalidatePath('/app/members')
  redirect('/app/members')
}
